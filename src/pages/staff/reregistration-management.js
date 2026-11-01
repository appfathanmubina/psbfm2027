import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { PENDING:"Menunggu kelengkapan", PAYMENT_PENDING:"Menunggu pembayaran", PAYMENT_VERIFIED:"Pembayaran terverifikasi", COMPLETED:"Selesai" };
const paymentLabels = { UNPAID:"Belum dibayar", PAYMENT_REVIEW:"Menunggu verifikasi", PAID:"Lunas", NOT_CREATED:"Tagihan belum tersedia", SUBMITTED:"Bukti menunggu verifikasi", VERIFIED:"Pembayaran terverifikasi", REJECTED:"Bukti perlu diunggah ulang" };
const money = (value) => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value || 0));

export function mountReregistrationManagementPage(container, { token, onDashboard }) {
  const state = { items:[], summary:{}, canManage:false, loading:true, busyId:"", error:"", notice:"" };

  function render() {
    const cards = state.items.map((item) => {
      const registration = item.registration || {};
      const candidate = item.candidate || {};
      const reregistration = item.reregistration || {};
      const status = String(reregistration.status || (item.needsOpen ? "NEEDS_OPEN" : "PENDING")).toUpperCase();
      const payment = item.payment || null;
      const paymentState = payment?.paymentStatus && payment.paymentStatus !== "VERIFIED" ? payment.paymentStatus : payment?.status;
      const missing = Array.isArray(item.documents?.missing) ? item.documents.missing : [];
      const completed = status === "COMPLETED" || String(registration.status || "").toUpperCase() === "COMPLETED";
      return `<article class="rereg-card"><div class="dashboard-section-head"><div><span class="eyebrow">${esc(registration.registrationNumber || registration.registrationId || "Pendaftaran")}</span><h2>${esc(candidate.fullName || "Calon Santri")}</h2></div><span class="status-badge ${completed ? "verified" : item.needsOpen ? "attention" : ""}">${esc(item.needsOpen ? "Belum dibuka" : statusLabels[status] || status)}</span></div>
        ${item.needsOpen ? `<p class="field-hint">Hasil Lulus sudah diumumkan. Membuka daftar ulang dapat membuat tagihan bila jenis tagihan telah dikonfigurasi.</p>${state.canManage ? `<button class="btn btn-outline" type="button" data-rereg-admin-action="open" data-registration-id="${esc(registration.registrationId)}" ${state.busyId ? "disabled" : ""}>Buka tahap daftar ulang</button>` : ""}` : `<div class="rereg-progress"><div><span>Dokumen wajib</span><b>${Number(item.documents?.verifiedCount || 0)} / ${Number(item.documents?.requiredCount || 0)} terverifikasi</b></div><div><span>Pembayaran</span><b>${payment ? `${esc(money(payment.amount))} · ${esc(paymentLabels[paymentState] || paymentState || "Menunggu")}` : "Tagihan belum tersedia"}</b></div></div>
          ${missing.length ? `<div class="document-revision"><b>Dokumen belum memenuhi syarat</b><p>${missing.map(esc).join(", ")}</p></div>` : ""}
          ${item.readyToComplete && state.canManage && !completed ? `<button class="btn btn-primary" type="button" data-rereg-admin-action="complete" data-registration-id="${esc(registration.registrationId)}" ${state.busyId ? "disabled" : ""}>${state.busyId === String(registration.registrationId) ? "Menyelesaikan…" : "Selesaikan daftar ulang"}</button>` : ""}
          ${item.readyToComplete && !state.canManage && !completed ? `<p class="field-hint">Persyaratan lengkap; proses dapat diselesaikan oleh petugas berwenang.</p>` : ""}`}
      </article>`;
    }).join("");
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Panitia</span><h1 class="page-title">Pengelolaan Daftar Ulang</h1><p class="page-subtitle">Pantau kelengkapan dan selesaikan tahap untuk pendaftar yang memenuhi syarat.</p></div><button class="btn btn-outline" type="button" data-rereg-admin-action="refresh">Muat ulang</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat daftar ulang…</section>` : state.items.length ? `<section class="dashboard-kpi-grid"><article class="dashboard-kpi"><div class="kpi-label">Pendaftar tahap daftar ulang</div><div class="kpi-value">${Number(state.summary.eligible || 0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Selesai</div><div class="kpi-value">${Number(state.summary.completed || 0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Belum selesai</div><div class="kpi-value">${Number(state.summary.pending || 0)}</div></article></section><div class="rereg-list">${cards}</div>` : `<section class="dashboard-section"><h2>Belum ada antrean daftar ulang</h2><p class="field-hint">Pendaftar lulus akan muncul setelah pengumuman hasil dipublikasikan.</p></section>`}`;
  }

  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const result = await apiCall("getReregistrationPageData", token);
      if (!result?.success) throw new Error(result?.message || "Data daftar ulang tidak dapat dimuat.");
      state.items = Array.isArray(result.items) ? result.items : [];
      state.summary = result.summary || {};
      state.canManage = result.canManage === true;
    } catch (error) { state.error = error.message || "Data daftar ulang tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }

  async function mutate(action, registrationId) {
    if (action === "complete" && !window.confirm("Selesaikan daftar ulang ini? Backend akan memeriksa kembali seluruh dokumen dan pembayaran.")) return;
    state.busyId = String(registrationId); state.error = ""; state.notice = ""; render();
    try {
      const rpc = action === "open" ? "openReregistration" : "finalizeReregistration";
      const result = await apiCall(rpc, token, registrationId);
      if (!result?.success) throw new Error(result?.message || "Perubahan daftar ulang tidak dapat disimpan.");
      state.notice = result.message || "Daftar ulang diperbarui.";
      await load();
    } catch (error) { state.error = error.message || "Perubahan daftar ulang tidak dapat disimpan."; }
    finally { state.busyId = ""; render(); }
  }

  const onClick = async (event) => {
    const button = event.target.closest("[data-rereg-admin-action]");
    if (!button) return;
    const action = button.dataset.reregAdminAction;
    if (action === "dashboard") onDashboard?.();
    if (action === "refresh") await load();
    if (["open", "complete"].includes(action)) await mutate(action, button.dataset.registrationId);
  };
  container.addEventListener("click", onClick);
  render();
  load();
  return () => container.removeEventListener("click", onClick);
}

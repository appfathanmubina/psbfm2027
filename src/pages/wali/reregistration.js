import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { PENDING:"Menunggu kelengkapan", PAYMENT_PENDING:"Menunggu pembayaran", PAYMENT_VERIFIED:"Pembayaran terverifikasi", COMPLETED:"Daftar ulang selesai" };
const paymentLabels = { UNPAID:"Belum dibayar", PAYMENT_REVIEW:"Menunggu verifikasi", PAID:"Lunas", NOT_CREATED:"Tagihan belum tersedia", SUBMITTED:"Bukti menunggu verifikasi", VERIFIED:"Pembayaran terverifikasi", REJECTED:"Bukti perlu diunggah ulang" };
const money = (value) => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value || 0));

export function mountReregistrationPage(container, { token, onDashboard }) {
  const state = { items:[], summary:{}, loading:true, openingId:"", error:"", notice:"" };

  function render() {
    const cards = state.items.map((item) => {
      const registration = item.registration || {};
      const candidate = item.candidate || {};
      const reregistration = item.reregistration || {};
      const status = String(reregistration.status || (item.needsOpen ? "NEEDS_OPEN" : "PENDING")).toUpperCase();
      const payment = item.payment || null;
      const paymentStatus = payment?.paymentStatus && payment.paymentStatus !== "VERIFIED" ? payment.paymentStatus : payment?.status;
      const missing = Array.isArray(item.documents?.missing) ? item.documents.missing : [];
      const allDocuments = item.documents?.requiredCount > 0 && missing.length === 0;
      const label = item.needsOpen ? "Belum dibuka" : (statusLabels[status] || status.replaceAll("_", " "));
      return `<article class="rereg-card"><div class="dashboard-section-head"><div><span class="eyebrow">${esc(registration.registrationNumber || registration.registrationId || "Pendaftaran")}</span><h2>${esc(candidate.fullName || "Calon Santri")}</h2></div><span class="status-badge ${status === "COMPLETED" ? "verified" : item.needsOpen ? "attention" : ""}">${esc(label)}</span></div>
        ${item.needsOpen ? `<p class="field-hint">Hasil seleksi calon santri telah diumumkan lulus. Membuka tahap ini akan membuat tagihan daftar ulang jika jenis tagihannya sudah dikonfigurasi.</p><button class="btn btn-primary" type="button" data-rereg-action="open" data-registration-id="${esc(registration.registrationId)}" ${state.openingId ? "disabled" : ""}>${state.openingId === String(registration.registrationId) ? "Membuka…" : "Buka Daftar Ulang"}</button>` : `<div class="rereg-progress"><div><span>Dokumen wajib</span><b>${Number(item.documents?.verifiedCount || 0)} / ${Number(item.documents?.requiredCount || 0)} terverifikasi</b></div><div><span>Pembayaran</span><b>${payment ? `${esc(money(payment.amount))} · ${esc(paymentLabels[paymentStatus] || paymentStatus || "Menunggu")}` : "Tagihan belum tersedia"}</b></div></div>
          ${missing.length ? `<div class="document-revision"><b>Dokumen yang masih perlu dilengkapi</b><p>${missing.map(esc).join(", ")}</p></div>` : allDocuments ? `<p class="form-success">Seluruh dokumen wajib sudah terverifikasi.</p>` : `<p class="field-hint">Panitia belum menetapkan persyaratan dokumen untuk tahap ini.</p>`}
          ${item.readyToComplete ? `<p class="field-hint">Dokumen dan pembayaran sudah lengkap. Panitia akan menyelesaikan daftar ulang.</p>` : ""}`}
      </article>`;
    }).join("");
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Portal Wali Santri</span><h1 class="page-title">Daftar Ulang</h1><p class="page-subtitle">Lihat tahap daftar ulang untuk calon santri yang telah lulus seleksi.</p></div><button class="btn btn-outline" type="button" data-rereg-action="dashboard">Dashboard</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat daftar ulang…</section>` : state.items.length ? `<section class="dashboard-kpi-grid"><article class="dashboard-kpi"><div class="kpi-label">Pendaftar memenuhi tahap</div><div class="kpi-value">${Number(state.summary.eligible || 0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Selesai</div><div class="kpi-value">${Number(state.summary.completed || 0)}</div></article></section><div class="rereg-list">${cards}</div>` : `<section class="dashboard-section"><h2>Belum ada daftar ulang</h2><p class="field-hint">Tahap ini muncul setelah hasil Lulus dipublikasikan oleh Panitia.</p></section>`}
      ${!state.loading ? `<button class="btn btn-ghost" type="button" data-rereg-action="refresh">Muat ulang</button>` : ""}`;
  }

  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const result = await apiCall("getReregistrationPageData", token);
      if (!result?.success) throw new Error(result?.message || "Data daftar ulang tidak dapat dimuat.");
      state.items = Array.isArray(result.items) ? result.items : [];
      state.summary = result.summary || {};
    } catch (error) { state.error = error.message || "Data daftar ulang tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }

  async function open(registrationId) {
    state.openingId = String(registrationId); state.error = ""; state.notice = ""; render();
    try {
      const result = await apiCall("openReregistration", token, registrationId);
      if (!result?.success) throw new Error(result?.message || "Tahap daftar ulang tidak dapat dibuka.");
      state.notice = result.message || "Daftar ulang berhasil dibuka.";
      await load();
    } catch (error) { state.error = error.message || "Tahap daftar ulang tidak dapat dibuka."; }
    finally { state.openingId = ""; render(); }
  }

  const onClick = async (event) => {
    const button = event.target.closest("[data-rereg-action]");
    if (!button) return;
    if (button.dataset.reregAction === "dashboard") onDashboard?.();
    if (button.dataset.reregAction === "refresh") await load();
    if (button.dataset.reregAction === "open") await open(button.dataset.registrationId);
  };
  container.addEventListener("click", onClick);
  render();
  load();
  return () => container.removeEventListener("click", onClick);
}

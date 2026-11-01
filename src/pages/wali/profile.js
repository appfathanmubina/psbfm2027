import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { DRAFT:"Draft", SUBMITTED:"Menunggu verifikasi", UNDER_REVIEW:"Sedang diverifikasi", REVISION:"Perlu perbaikan", VERIFIED:"Terverifikasi", PAYMENT_VERIFIED:"Pembayaran terverifikasi", SELECTION:"Seleksi", PASSED:"Lulus", NOT_PASSED:"Tidak lulus", REREGISTRATION:"Daftar ulang", COMPLETED:"Selesai", CANCELLED:"Dibatalkan" };

export function mountProfilePage(container, { token, user, onDashboard, onRegistration }) {
  const state = { registrations:[], loading:true, error:"" };
  function render() {
    const registrations = state.registrations.length ? state.registrations.map((item) => `<article class="registration-card"><div class="registration-card-copy"><span class="eyebrow">${esc(item.tahunAjaranName || "Tahun ajaran")}${item.jenjangName ? ` · ${esc(item.jenjangName)}` : ""}</span><h2>${esc(item.candidateName || "Calon santri")}</h2><p>${esc(item.registrationNumber || item.registrationId || "")} · ${esc(item.gelombangName || "Gelombang belum ditentukan")}</p></div><span class="status-badge">${esc(statusLabels[String(item.status || "").toUpperCase()] || item.status || "Belum ada status")}</span></article>`).join("") : `<section class="dashboard-section"><b>Belum ada pendaftaran calon santri</b><p class="field-hint">Tambahkan pendaftaran untuk menghubungkan profil Wali dengan calon santri.</p><button class="btn btn-primary" type="button" data-profile-action="registration">Buka pendaftaran</button></section>`;
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Portal Wali Santri</span><h1 class="page-title">Profil & Relasi Santri</h1><p class="page-subtitle">Informasi akun Wali dan calon santri yang terhubung.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-profile-action="dashboard">Dashboard</button><button class="btn btn-primary" type="button" data-profile-action="registration">Kelola pendaftaran</button></div></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}
      <section class="dashboard-section"><div class="dashboard-section-head"><b>Informasi akun Wali</b><span>${esc(user?.status || "")}</span></div><div class="registration-fields"><div><span class="kpi-label">Nama</span><p>${esc(user?.name || "Belum diisi")}</p></div><div><span class="kpi-label">Nomor HP</span><p>${esc(user?.phone || "Belum diisi")}</p></div><div><span class="kpi-label">Email</span><p>${esc(user?.email || "Belum diisi")}</p></div><div><span class="kpi-label">Peran</span><p>Wali Santri</p></div></div><p class="field-hint">Perubahan informasi akun dilakukan melalui Panitia. Data wali pada setiap formulir pendaftaran dapat diperiksa dari menu Pendaftaran.</p></section>
      <section class="dashboard-section"><div class="dashboard-section-head"><b>Calon santri terhubung</b><span>${state.loading ? "Memuat…" : `${state.registrations.length} pendaftaran`}</span></div>${state.loading ? `<div class="dashboard-task-empty" role="status">Memuat relasi calon santri…</div>` : `<div class="registration-list">${registrations}</div>`}</section>`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const result = await apiCall("getMyRegistrations", token);
      if (!result?.success) throw new Error(result?.message || "Relasi calon santri tidak dapat dimuat.");
      state.registrations = Array.isArray(result.registrations) ? result.registrations : [];
    } catch (error) { state.error = error.message || "Relasi calon santri tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = (event) => {
    const action = event.target.closest("[data-profile-action]")?.dataset.profileAction;
    if (action === "dashboard") onDashboard?.();
    if (action === "registration") onRegistration?.();
  };
  container.addEventListener("click", onClick); render(); load();
  return () => container.removeEventListener("click", onClick);
}

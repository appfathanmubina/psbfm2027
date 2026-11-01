import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const number = (value) => Number(value || 0).toLocaleString("id-ID");
const dateLabel = (value) => {
  if (!value) return "Belum tersedia";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Belum tersedia" : new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(date);
};

function metric(label, value, detail = "") {
  return `<article class="dashboard-kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${number(value)}</div>${detail ? `<div class="field-hint">${esc(detail)}</div>` : ""}</article>`;
}

function exceptionList(items, emptyText) {
  if (!items?.length) return `<div class="dashboard-task-empty">${esc(emptyText)}</div>`;
  return `<div class="dashboard-task-list">${items.map((item) => `<article class="dashboard-task-item monitoring-exception"><div class="dashboard-task-copy"><div class="dashboard-task-name">${esc(item.detail || item.label || item.type || "Catatan")}</div><div class="dashboard-task-meta">${esc(item.registrationNumber || item.candidateName || item.recordId || "")}${item.agingLabel ? ` · ${esc(item.agingLabel)}` : ""}${item.ageDays != null ? ` · ${number(item.ageDays)} hari` : ""}</div></div>${item.severity ? `<span class="status-badge ${String(item.severity).toUpperCase() === "ERROR" ? "status-danger" : ""}">${esc(item.severity)}</span>` : ""}</article>`).join("")}</div>`;
}

export function mountMonitoringPage(container, { token, canIncident = false, onDashboard, onIncidents }) {
  const state = { data:null, loading:true, error:"" };
  function render() {
    const data = state.data || {};
    const sla = data.sla || {};
    const reconciliation = data.reconciliation || {};
    const paymentSummary = reconciliation.payments?.summary || {};
    const registrationSummary = reconciliation.registrations?.summary || {};
    const daily = data.daily || {};
    const dailyMetrics = [
      ["Pendaftaran baru", daily.newRegistrations], ["Pendaftaran dikirim", daily.submitted],
      ["Bukti pembayaran", daily.paymentsSubmitted], ["Pembayaran diverifikasi", daily.paymentsVerified],
      ["Peserta seleksi", daily.selectionParticipants], ["Pengumuman", daily.announcements],
      ["Daftar ulang selesai", daily.reregCompleted]
    ];
    const loaded = !state.loading && data.success;
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Panitia</span><h1 class="page-title">Monitoring Operasional</h1><p class="page-subtitle">Antrean, rekonsiliasi, dan aktivitas untuk tahun ajaran ${esc(data.activeYear || "-")}.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-monitor-action="refresh" ${state.loading ? "disabled" : ""}>Muat ulang</button><button class="btn btn-outline" type="button" data-monitor-action="dashboard">Dashboard</button>${canIncident ? `<button class="btn btn-outline" type="button" data-monitor-action="incidents">Insiden (${number(data.incidents?.open)})</button>` : ""}</div></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat monitoring…</section>` : loaded ? `<p class="field-hint">Data diperbarui ${esc(dateLabel(data.generatedAt))}. Tampilan ini hanya membaca data.</p>
      <section class="dashboard-kpi-grid">${metric("Antrean aktif", sla.total)}${metric("Perlu perhatian", sla.counts?.ATTENTION, "Usia antrean 1–2 hari")}${metric("Terlambat", sla.counts?.OVERDUE, "Usia antrean lebih dari 2 hari")}${metric("Pengecualian data", data.exceptions?.total, `${number(data.exceptions?.errors)} kesalahan · ${number(data.exceptions?.warnings)} peringatan`)}</section>
      <section class="dashboard-section"><div class="dashboard-section-head"><b>Antrean melewati SLA</b><span>${number((sla.overdue || []).length)} terlambat · ${number((sla.attention || []).length)} perlu perhatian</span></div><div class="dashboard-ops-grid"><div><h2 class="section-subtitle">Terlambat</h2>${exceptionList(sla.overdue, "Tidak ada antrean yang terlambat.")}</div><div><h2 class="section-subtitle">Perlu perhatian</h2>${exceptionList(sla.attention, "Tidak ada antrean yang perlu perhatian.")}</div></div></section>
      <section class="dashboard-ops-grid"><article class="dashboard-section"><div class="dashboard-section-head"><b>Rekonsiliasi pembayaran</b><span>${number(paymentSummary.total)} catatan</span></div><div class="report-rates"><div><span>Kesalahan</span><b>${number(paymentSummary.errors)}</b></div><div><span>Peringatan</span><b>${number(paymentSummary.warnings)}</b></div></div>${exceptionList(reconciliation.payments?.exceptions, "Tidak ada pengecualian pembayaran.")}</article><article class="dashboard-section"><div class="dashboard-section-head"><b>Integritas pendaftaran</b><span>${number(registrationSummary.total)} catatan</span></div><div class="report-rates"><div><span>Kesalahan</span><b>${number(registrationSummary.errors)}</b></div><div><span>Peringatan</span><b>${number(registrationSummary.warnings)}</b></div></div>${exceptionList(reconciliation.registrations?.exceptions, "Tidak ada pengecualian relasi data.")}</article></section>
      <section class="dashboard-section"><div class="dashboard-section-head"><b>Aktivitas hari ini</b><span>${esc(daily.date || "-")}</span></div><div class="report-kpi-grid">${dailyMetrics.map(([label, value]) => metric(label, value)).join("")}</div></section>` : ""}`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const result = await apiCall("getMonitoringPageData", token);
      if (!result?.success) throw new Error(result?.message || "Data monitoring tidak dapat dimuat.");
      state.data = result;
    } catch (error) { state.error = error.message || "Data monitoring tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = (event) => {
    const action = event.target.closest("[data-monitor-action]")?.dataset.monitorAction;
    if (action === "refresh") load();
    if (action === "dashboard") onDashboard?.();
    if (action === "incidents" && canIncident) onIncidents?.();
  };
  container.addEventListener("click", onClick);
  render(); load();
  return () => container.removeEventListener("click", onClick);
}

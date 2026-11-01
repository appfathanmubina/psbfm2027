import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const money = (value) => new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value || 0));
const metrics = [["registrations","Pendaftaran"],["submitted","Dikirim"],["verified","Terverifikasi"],["paymentVerified","Pembayaran terverifikasi"],["selection","Peserta seleksi"],["announced","Hasil diumumkan"],["passed","Lulus"],["reregistration","Daftar ulang"],["completed","Daftar ulang selesai"]];

export function mountReportingPage(container, { token, onDashboard }) {
  const state = { options:{}, filters:{}, data:null, loading:true, exporting:false, error:"", notice:"" };
  function render() {
    const data = state.data || {};
    const funnel = data.funnel || {};
    const conversions = data.conversion || {};
    const trendMax = Math.max(1, ...(data.trends || []).map((item) => Number(item.registrations || 0)));
    const trends = (data.trends || []).length ? data.trends.map((item) => `<div class="report-trend-row"><span>${esc(item.month)}</span><div class="report-trend-track"><i style="width:${Math.max(2, Number(item.registrations || 0) / trendMax * 100)}%"></i></div><b>${Number(item.registrations || 0)}</b></div>`).join("") : `<p class="field-hint">Belum ada tren pada periode terpilih.</p>`;
    const breakdown = (items) => items?.length ? `<div class="report-breakdown-list">${items.map((item) => `<div><span>${esc(item.label)}</span><b>${Number(item.count || 0)}</b></div>`).join("")}</div>` : `<p class="field-hint">Belum ada data.</p>`;
    const options = state.options || {};
    const yearOptions = (options.tahunAjaran || []).map((item) => `<option value="${esc(item.tahunAjaranId)}" ${String(state.filters.tahunAjaranId || options.activeYearId || "") === String(item.tahunAjaranId) ? "selected" : ""}>${esc(item.name || item.tahunAjaranId)}</option>`).join("");
    const waveOptions = (options.gelombang || []).map((item) => `<option value="${esc(item.gelombangId)}" ${String(state.filters.gelombangId || "") === String(item.gelombangId) ? "selected" : ""}>${esc(item.name || item.gelombangId)}</option>`).join("");
    const levelOptions = (options.jenjang || []).map((item) => `<option value="${esc(item.jenjangId)}" ${String(state.filters.jenjangId || "") === String(item.jenjangId) ? "selected" : ""}>${esc(item.name || item.jenjangId)}</option>`).join("");
    const statusOptions = (options.statuses || []).map((item) => `<option value="${esc(item)}" ${String(state.filters.status || "") === String(item) ? "selected" : ""}>${esc(item.replaceAll("_", " "))}</option>`).join("");
    const kpis = metrics.map(([key,label]) => [label, funnel[key]]);
    const rates = [["Verifikasi",conversions.verificationRate],["Pembayaran",conversions.paymentRate],["Masuk seleksi",conversions.selectionRate],["Kelulusan",conversions.passRate],["Penyelesaian daftar ulang",conversions.reregistrationCompletionRate]];
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Laporan Operasional</span><h1 class="page-title">Laporan &amp; Analitik PSB</h1><p class="page-subtitle">Pantau alur pendaftaran, hasil seleksi, pembayaran, dan penyelesaian daftar ulang.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-report-action="export" ${state.exporting || !state.data ? "disabled" : ""}>${state.exporting ? "Menyiapkan…" : "Ekspor CSV"}</button><button class="btn btn-outline" type="button" data-report-action="refresh">Muat ulang</button><button class="btn btn-outline" type="button" data-report-action="dashboard">Dashboard</button></div></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}<section class="dashboard-section"><div class="dashboard-section-head"><b>Filter laporan</b><span>Tahun ajaran ${esc(data.activeYear || "-")}</span></div><form id="report-filter-form" class="report-filter-grid"><div class="field"><label for="report-year">Tahun ajaran</label><select id="report-year" name="tahunAjaranId"><option value="">Tahun aktif</option>${yearOptions}</select></div><div class="field"><label for="report-wave">Gelombang</label><select id="report-wave" name="gelombangId"><option value="">Semua gelombang</option>${waveOptions}</select></div><div class="field"><label for="report-level">Jenjang</label><select id="report-level" name="jenjangId"><option value="">Semua jenjang</option>${levelOptions}</select></div><div class="field"><label for="report-gender">Kelompok</label><select id="report-gender" name="gender"><option value="">Semua</option><option value="L" ${state.filters.gender === "L" ? "selected" : ""}>Putra</option><option value="P" ${state.filters.gender === "P" ? "selected" : ""}>Putri</option></select></div><div class="field"><label for="report-status">Status</label><select id="report-status" name="status"><option value="">Semua status</option>${statusOptions}</select></div><div class="field"><label for="report-from">Dibuat sejak</label><input id="report-from" name="fromDate" type="date" value="${esc(state.filters.fromDate || "")}"></div><div class="field"><label for="report-to">Sampai</label><input id="report-to" name="toDate" type="date" value="${esc(state.filters.toDate || "")}"></div><button class="btn btn-primary" type="submit" ${state.loading ? "disabled" : ""}>Terapkan filter</button></form></section>${state.loading ? `<section class="dashboard-section" role="status">Memuat analitik…</section>` : data.funnel ? `<section class="dashboard-kpi-grid report-kpi-grid">${kpis.map(([label,value]) => `<article class="dashboard-kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${Number(value || 0).toLocaleString("id-ID")}</div></article>`).join("")}</section><div class="report-grid"><section class="dashboard-section"><div class="dashboard-section-head"><b>Konversi tahapan</b><span>Persentase</span></div><div class="report-rates">${rates.map(([label,value]) => `<div><span>${esc(label)}</span><b>${Number(value || 0).toLocaleString("id-ID")}%</b></div>`).join("")}</div></section><section class="dashboard-section"><div class="dashboard-section-head"><b>Ringkasan keuangan</b><span>${Number(data.finance?.paidBills || 0)} tagihan lunas</span></div><div class="report-money">${esc(money(data.finance?.paidAmount))}</div><p class="field-hint">Akumulasi tagihan berstatus lunas pada filter terpilih.</p></section><section class="dashboard-section"><div class="dashboard-section-head"><b>Pendaftaran per bulan</b><span>Tren</span></div><div class="report-trends">${trends}</div></section><section class="dashboard-section"><div class="dashboard-section-head"><b>Hasil seleksi</b><span>${Number(data.outcome?.passed || 0) + Number(data.outcome?.notPassed || 0) + Number(data.outcome?.waitlist || 0)} hasil</span></div><div class="report-rates"><div><span>Lulus</span><b>${Number(data.outcome?.passed || 0)}</b></div><div><span>Tidak lulus</span><b>${Number(data.outcome?.notPassed || 0)}</b></div><div><span>Daftar tunggu</span><b>${Number(data.outcome?.waitlist || 0)}</b></div><div><span>Belum ditetapkan</span><b>${Number(data.outcome?.pending || 0)}</b></div></div></section><section class="dashboard-section"><div class="dashboard-section-head"><b>Kelompok jenjang &amp; gender</b><span>Jumlah pendaftar</span></div>${breakdown(data.breakdowns?.kelompok)}</section><section class="dashboard-section"><div class="dashboard-section-head"><b>Status pendaftaran</b><span>Jumlah pendaftar</span></div>${breakdown(data.breakdowns?.status)}</section><section class="dashboard-section"><div class="dashboard-section-head"><b>Gelombang</b><span>Jumlah pendaftar</span></div>${breakdown(data.breakdowns?.gelombang)}</section><section class="dashboard-section"><div class="dashboard-section-head"><b>Aktivitas 30 hari</b><span>Terakhir</span></div><div class="report-rates"><div><span>Pendaftaran</span><b>${Number(data.last30?.registrations || 0)}</b></div><div><span>Pembayaran diverifikasi</span><b>${Number(data.last30?.payments || 0)}</b></div><div><span>Hasil diumumkan</span><b>${Number(data.last30?.announcements || 0)}</b></div></div></section></div><p class="field-hint">Dihasilkan ${esc(new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(new Date(data.generatedAt || Date.now())))}. Analitik menggunakan data agregat dan tidak menampilkan identitas pendaftar.</p>` : `<section class="dashboard-section"><p class="field-hint">Laporan belum tersedia.</p></section>`}`;
  }
  async function loadOptions(filters) {
    const result = await apiCall("getReportingPageData", token, Object.assign({}, filters || {}, { optionsOnly:true }));
    if (!result?.success) throw new Error(result?.message || "Opsi laporan tidak dapat dimuat.");
    state.options = result.options || {};
    if (!state.filters.tahunAjaranId) state.filters.tahunAjaranId = result.filters?.tahunAjaranId || "";
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      await loadOptions(state.filters);
      const result = await apiCall("getAdvancedReportingData", token, state.filters);
      if (!result?.success) throw new Error(result?.message || "Analitik tidak dapat dimuat.");
      state.data = result;
    } catch (error) { state.error = error.message || "Laporan tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = async (event) => {
    const button = event.target.closest("[data-report-action]"); if (!button) return;
    if (button.dataset.reportAction === "dashboard") onDashboard?.();
    else if (button.dataset.reportAction === "refresh") await load();
    else if (button.dataset.reportAction === "export") {
      state.exporting = true; state.error = ""; render();
      try {
        const result = await apiCall("exportAdvancedReportingCsv", token, state.filters);
        if (!result?.success) throw new Error(result?.message || "CSV tidak dapat dibuat.");
        const blob = new Blob([result.csv || ""], { type:"text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = result.filename || "laporan-psb.csv"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); state.notice = "CSV laporan berhasil diunduh.";
      } catch (error) { state.error = error.message || "CSV tidak dapat dibuat."; }
      finally { state.exporting = false; render(); }
    }
  };
  const onSubmit = async (event) => {
    if (event.target.id !== "report-filter-form") return;
    event.preventDefault(); const values = new FormData(event.target); state.filters = Object.fromEntries(["tahunAjaranId","gelombangId","jenjangId","gender","status","fromDate","toDate"].map((key) => [key,String(values.get(key) || "").trim()]));
    if (state.filters.fromDate && state.filters.toDate && state.filters.fromDate > state.filters.toDate) { state.error = "Tanggal awal tidak boleh melewati tanggal akhir."; render(); return; }
    await load();
  };
  container.addEventListener("click", onClick); container.addEventListener("submit", onSubmit); render(); load();
  return () => { container.removeEventListener("click", onClick); container.removeEventListener("submit", onSubmit); };
}

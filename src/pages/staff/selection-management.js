import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const resultLabels = { PENDING:"Menunggu hasil", PASSED:"Lulus", NOT_PASSED:"Tidak lulus", WAITLIST:"Cadangan" };
const participantLabels = { SCHEDULED:"Terjadwal", PRESENT:"Hadir", ABSENT:"Tidak hadir", COMPLETED:"Selesai" };
const dateLabel = (value) => {
  const raw = String(value || "").trim();
  const date = raw ? new Date(raw) : null;
  return !date || Number.isNaN(date.getTime()) ? (raw || "Tanggal belum ditetapkan") : new Intl.DateTimeFormat("id-ID", { dateStyle:"long" }).format(date);
};

export function mountSelectionManagementPage(container, { token, onDashboard }) {
  const state = { data:null, announcements:[], selectedId:"", loading:true, busy:"", error:"", notice:"", report:[] };

  function render() {
    const data = state.data || {};
    const schedules = Array.isArray(data.schedules) ? data.schedules : [];
    const registrations = Array.isArray(data.registrations) ? data.registrations : [];
    const participants = Array.isArray(data.participants) ? data.participants : [];
    const selected = data.detail || null;
    const selectedParticipant = selected?.participant || null;
    const selectedRegistration = selected?.registration || {};
    const selectedResult = selected?.result || null;
    const selectedScores = Array.isArray(selected?.scores) ? selected.scores : [];
    const scheduleOptions = schedules.map((item) => `<option value="${esc(item.scheduleId)}">${esc(item.name || "Tes Seleksi")} · ${esc(dateLabel(item.selectionDate))}</option>`).join("");
    const assigned = new Set(participants.map((item) => String(item.registrationId)));
    const activeYearId = String(schedules[0]?.tahunAjaranId || "");
    const eligible = registrations.filter((item) => (!activeYearId || String(item.tahunAjaranId) === activeYearId) && !assigned.has(String(item.registrationId)) && ["VERIFIED", "PAYMENT_VERIFIED", "SELECTION"].includes(String(item.status || "").toUpperCase()));
    const candidateOptions = eligible.map((item) => `<option value="${esc(item.registrationId)}">${esc(item.candidateName || "Calon Santri")} · ${esc(item.registrationNumber || "-")}</option>`).join("");
    const schedulesHtml = schedules.length ? schedules.map((item) => {
      const count = participants.filter((participant) => String(participant.scheduleId) === String(item.scheduleId)).length;
      return `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">Jadwal aktif</span><h2>${esc(item.name || "Tes Seleksi")}</h2><p>${esc(dateLabel(item.selectionDate))}${item.location ? ` · ${esc(item.location)}` : ""} · ${count} peserta</p></div><button class="btn btn-outline" type="button" data-selection-admin-action="deactivate" data-schedule-id="${esc(item.scheduleId)}" ${state.busy ? "disabled" : ""}>Nonaktifkan</button></article>`;
    }).join("") : `<section class="dashboard-section"><p class="field-hint">Belum ada jadwal tes aktif untuk tahun ajaran ini.</p></section>`;
    const participantHtml = participants.length ? participants.map((item) => {
      const status = String(item.status || "SCHEDULED").toUpperCase();
      return `<article class="selection-participant-card"><div><b>${esc(item.candidateName || "Calon Santri")}</b><small>${esc(item.registration?.registrationNumber || item.registrationId || "-")}</small></div><div class="selection-participant-actions"><select aria-label="Status ${esc(item.candidateName || "peserta")}" data-participant-status="${esc(item.participantId)}" ${state.busy ? "disabled" : ""}>${Object.entries(participantLabels).map(([value,label]) => `<option value="${value}" ${value === status ? "selected" : ""}>${label}</option>`).join("")}</select><button class="btn btn-ghost" type="button" data-selection-admin-action="score" data-registration-id="${esc(item.registrationId)}">Nilai & hasil</button></div></article>`;
    }).join("") : `<section class="dashboard-section"><p class="field-hint">Belum ada peserta tes. Buat jadwal lalu tambahkan pendaftar yang memenuhi syarat.</p></section>`;
    const scoreRows = selectedScores.length ? `<div class="score-table-wrap"><table class="score-table"><thead><tr><th>Komponen</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>${selectedScores.map((score) => `<tr><td>${esc(score.component)}</td><td>${esc(score.score)}</td><td>${esc(score.note || "-")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="field-hint">Belum ada nilai untuk peserta ini.</p>`;
    const resultLocked = Boolean(String(selectedResult?.announcementDate || "").trim());
    const announcementItems = Array.isArray(state.announcements) ? state.announcements : [];
    const announcementHtml = announcementItems.length ? announcementItems.map((item) => {
      const status = String(item.status || "PENDING").toUpperCase();
      const ready = ["PASSED", "NOT_PASSED", "WAITLIST"].includes(status) && !item.isPublished;
      return `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">${esc(item.registrationNumber || "Pendaftaran")}</span><h2>${esc(item.candidateName || "Calon Santri")}</h2><p>Status: ${esc(resultLabels[status] || status)}${item.isPublished ? ` · Diumumkan ${esc(dateLabel(item.announcementDate))}` : " · Belum diumumkan"}</p>${item.note ? `<p>${esc(item.note)}</p>` : ""}</div>${ready ? `<button class="btn btn-primary" type="button" data-selection-admin-action="publish" data-registration-id="${esc(item.registrationId)}" ${state.busy ? "disabled" : ""}>Publikasikan</button>` : ""}</article>`;
    }).join("") : `<section class="dashboard-section"><p class="field-hint">Belum ada hasil seleksi untuk diumumkan.</p></section>`;

    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Seleksi</span><h1 class="page-title">Seleksi & Pengumuman</h1><p class="page-subtitle">Kelola jadwal, peserta, nilai, keputusan, dan publikasi hasil seleksi.</p></div><button class="btn btn-outline" type="button" data-selection-admin-action="dashboard">Dashboard</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}${state.report.length ? `<div class="dashboard-section"><b>Rincian penambahan peserta</b><ul>${state.report.map((item) => `<li>${esc(item.name)}: ${esc(item.result)}${item.reason ? ` — ${esc(item.reason)}` : ""}</li>`).join("")}</ul></div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat data seleksi…</section>` : `<section class="dashboard-section"><h2>Buat Jadwal Tes</h2><form id="selection-schedule-form" class="registration-fields"><div class="field"><label for="selection-name">Nama tes *</label><input id="selection-name" name="name" required maxlength="120" placeholder="Contoh: Tes Seleksi Gelombang 1"></div><div class="field"><label for="selection-date">Tanggal tes *</label><input id="selection-date" name="selectionDate" type="date" required></div><div class="field"><label for="selection-location">Lokasi</label><input id="selection-location" name="location" maxlength="200" placeholder="Lokasi atau tautan online"></div><div class="field registration-actions"><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>Simpan jadwal</button></div></form></section>
        <section class="program-section"><div class="dashboard-section-head"><b>Jadwal aktif</b><span>${schedules.length} jadwal</span></div><div class="program-list">${schedulesHtml}</div></section>
        ${schedules.length ? `<section class="dashboard-section"><h2>Tambah Peserta</h2><p class="field-hint">Backend akan memeriksa kelayakan pendaftaran dan pembayaran formulir sebelum menambahkan peserta.</p><div class="registration-fields"><div class="field"><label for="selection-schedule-select">Jadwal</label><select id="selection-schedule-select">${scheduleOptions}</select></div><div class="field"><label for="selection-candidates">Pendaftar (pilih satu atau lebih)</label><select id="selection-candidates" multiple size="5">${candidateOptions}</select></div></div><button class="btn btn-primary" type="button" data-selection-admin-action="add-participants" ${state.busy || !eligible.length ? "disabled" : ""}>Tambahkan peserta terpilih</button>${!eligible.length ? `<p class="field-hint">Tidak ada pendaftar yang belum memiliki jadwal tes.</p>` : ""}</section>` : ""}
        <section class="dashboard-section"><h2>Peserta Tes</h2><div class="selection-participant-list">${participantHtml}</div></section>
        ${selectedParticipant ? `<section class="dashboard-section"><div class="dashboard-section-head"><div><span class="eyebrow">${esc(selectedRegistration.registrationNumber || "Peserta")}</span><h2>${esc(selectedRegistration.candidateName || "Calon Santri")}</h2></div><button class="btn btn-ghost" type="button" data-selection-admin-action="clear-detail">Tutup</button></div><h3>Nilai seleksi</h3>${scoreRows}${resultLocked ? `<p class="field-hint">Hasil telah dipublikasikan; nilai dan keputusan terkunci.</p>` : `<form id="selection-score-form" class="registration-fields"><div class="field"><label for="score-component">Komponen nilai *</label><input id="score-component" name="component" required maxlength="100" placeholder="Nama komponen sesuai ketentuan seleksi"></div><div class="field"><label for="score-value">Nilai (0–100) *</label><input id="score-value" name="score" type="number" min="0" max="100" step="0.01" required></div><div class="field"><label for="score-note">Catatan</label><input id="score-note" name="note" maxlength="500"></div><div class="field registration-actions"><button class="btn btn-outline" type="submit" ${state.busy ? "disabled" : ""}>Simpan nilai</button></div></form><p class="field-hint">Nilai dan bobot kelulusan mengikuti ketentuan seleksi yang ditetapkan Panitia; aplikasi tidak menghitung keputusan otomatis.</p><form id="selection-result-form" class="registration-fields"><div class="field"><label for="selection-result-status">Keputusan *</label><select id="selection-result-status" name="status">${Object.entries(resultLabels).map(([value,label]) => `<option value="${value}" ${String(selectedResult?.status || "PENDING").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="selection-result-note">Catatan keputusan</label><input id="selection-result-note" name="note" maxlength="500" value="${esc(selectedResult?.note || "")}"></div><div class="field registration-actions"><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>Simpan hasil internal</button></div></form><p class="field-hint">Hasil internal belum terlihat oleh Wali sampai dipublikasikan.</p>`}</section>` : ""}
        <section class="program-section"><div class="dashboard-section-head"><b>Pengumuman hasil</b><span>${announcementItems.length} hasil</span></div><div class="program-list">${announcementHtml}</div></section><button class="btn btn-ghost" type="button" data-selection-admin-action="refresh">Muat ulang</button>`}`;
  }

  async function load(registrationId = state.selectedId) {
    state.loading = true; state.error = ""; state.selectedId = String(registrationId || ""); render();
    try {
      const data = await apiCall("getSelectionPageData", token, state.selectedId);
      if (!data?.success) throw new Error(data?.message || "Data seleksi tidak dapat dimuat.");
      const announcements = await apiCall("getAnnouncementPageData", token);
      if (!announcements?.success) throw new Error(announcements?.message || "Data pengumuman tidak dapat dimuat.");
      state.data = data;
      state.announcements = Array.isArray(announcements.items) ? announcements.items : [];
    } catch (error) { state.error = error.message || "Data seleksi tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }

  async function mutate(rpc, payload, successMessage, reloadId = state.selectedId) {
    state.busy = rpc; state.error = ""; state.notice = ""; state.report = []; render();
    try {
      const result = await apiCall(rpc, token, payload);
      if (!result?.success) throw new Error(result?.message || "Perubahan tidak dapat disimpan.");
      state.notice = result.message || successMessage;
      if (rpc === "addSelectionParticipantsBulk") {
        const describe = (row, label) => ({ name:registrationsName(row.registrationId), result:label, reason:row.reason || "" });
        state.report = [...(result.added || []).map((row) => describe(row, "Ditambahkan")), ...(result.skipped || []).map((row) => describe(row, "Dilewati")), ...(result.failed || []).map((row) => describe(row, "Gagal"))];
      }
      await load(reloadId);
    } catch (error) { state.error = error.message || "Perubahan tidak dapat disimpan."; }
    finally { state.busy = ""; render(); }
  }

  function registrationsName(registrationId) {
    return state.data?.registrations?.find((item) => String(item.registrationId) === String(registrationId))?.candidateName || registrationId || "Pendaftar";
  }

  const onSubmit = async (event) => {
    if (event.target.id === "selection-schedule-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      await mutate("createSelectionSchedule", { name:form.get("name"), selectionDate:form.get("selectionDate"), location:form.get("location") }, "Jadwal seleksi dibuat.");
    }
    if (event.target.id === "selection-score-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      await mutate("saveSelectionScore", { participantId:state.data?.detail?.participant?.participantId, component:form.get("component"), score:form.get("score"), note:form.get("note") });
    }
    if (event.target.id === "selection-result-form") {
      event.preventDefault();
      const form = new FormData(event.target);
      await mutate("saveSelectionResult", { registrationId:state.selectedId, status:form.get("status"), note:form.get("note") });
    }
  };
  const onClick = async (event) => {
    const button = event.target.closest("[data-selection-admin-action]");
    if (!button) return;
    const action = button.dataset.selectionAdminAction;
    if (action === "dashboard") onDashboard?.();
    if (action === "refresh") await load(state.selectedId);
    if (action === "deactivate") await mutate("updateSelectionScheduleStatus", { scheduleId:button.dataset.scheduleId, isActive:false }, "Jadwal seleksi dinonaktifkan.");
    if (action === "score") await load(button.dataset.registrationId);
    if (action === "clear-detail") await load("");
    if (action === "add-participants") {
      const registrationIds = [...(container.querySelector("#selection-candidates")?.selectedOptions || [])].map((option) => option.value);
      const scheduleId = container.querySelector("#selection-schedule-select")?.value || "";
      if (!registrationIds.length) { state.error = "Pilih setidaknya satu pendaftar."; render(); return; }
      await mutate("addSelectionParticipantsBulk", { registrationIds, scheduleId });
    }
    if (action === "publish") {
      if (!window.confirm("Publikasikan hasil ini kepada Wali? Hasil yang sudah diumumkan tidak dapat diubah.")) return;
      await mutate("publishAnnouncement", { registrationId:button.dataset.registrationId });
    }
  };
  const onChange = async (event) => {
    if (!event.target.matches("[data-participant-status]")) return;
    await mutate("updateSelectionParticipantStatus", { participantId:event.target.dataset.participantStatus, status:event.target.value });
  };
  container.addEventListener("submit", onSubmit);
  container.addEventListener("click", onClick);
  container.addEventListener("change", onChange);
  render();
  load();
  return () => { container.removeEventListener("submit", onSubmit); container.removeEventListener("click", onClick); container.removeEventListener("change", onChange); };
}

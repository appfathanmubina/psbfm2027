import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const resultLabels = { PASSED:"Lulus", NOT_PASSED:"Tidak lulus", WAITLIST:"Daftar tunggu" };
const participantLabels = { SCHEDULED:"Terjadwal", ATTENDED:"Hadir", ABSENT:"Tidak hadir", COMPLETED:"Selesai" };

function dateLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Tanggal menyusul";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : new Intl.DateTimeFormat("id-ID", { dateStyle:"long" }).format(date);
}

export function mountSelectionPage(container, { token, onDashboard }) {
  const state = { schedules:[], participants:[], announcements:[], loading:true, error:"" };

  function render() {
    const scheduleById = Object.fromEntries(state.schedules.map((item) => [String(item.scheduleId), item]));
    const scheduleCards = state.schedules.length ? state.schedules.map((item) => `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">Jadwal seleksi</span><h2>${esc(item.name || "Tes Seleksi")}</h2><p>${esc(dateLabel(item.selectionDate))}${item.location ? ` · ${esc(item.location)}` : ""}</p></div></article>`).join("") : `<section class="dashboard-section"><h2>Belum ada jadwal seleksi</h2><p class="field-hint">Informasi jadwal akan tampil setelah Panitia menerbitkannya.</p></section>`;
    const participantCards = state.participants.length ? state.participants.map((item) => {
      const schedule = scheduleById[String(item.scheduleId)] || {};
      const status = String(item.status || "SCHEDULED").toUpperCase();
      return `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">${esc(schedule.name || "Tes Seleksi")}</span><h2>${esc(dateLabel(schedule.selectionDate))}</h2><p>${schedule.location ? `${esc(schedule.location)} · ` : ""}${esc(participantLabels[status] || status.replaceAll("_", " "))}</p></div><span class="status-badge">${esc(participantLabels[status] || "Terdaftar")}</span></article>`;
    }).join("") : "";
    const announcementCards = state.announcements.length ? state.announcements.map((item) => {
      const status = String(item.status || "").toUpperCase();
      const label = resultLabels[status] || "Hasil seleksi";
      const badge = status === "PASSED" ? "verified" : status === "WAITLIST" ? "attention" : "";
      return `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">Pengumuman hasil</span><h2>${esc(item.candidateName || "Calon Santri")}</h2><p>${esc(item.registrationNumber || "-")} · Diumumkan ${esc(dateLabel(item.announcementDate))}</p>${item.note ? `<p>${esc(item.note)}</p>` : ""}</div><span class="status-badge ${badge}">${esc(label)}</span></article>`;
    }).join("") : `<section class="dashboard-section"><h2>Belum ada pengumuman</h2><p class="field-hint">Hasil seleksi akan ditampilkan setelah Panitia memublikasikannya.</p></section>`;
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Portal Wali Santri</span><h1 class="page-title">Seleksi &amp; Pengumuman</h1><p class="page-subtitle">Pantau jadwal seleksi dan hasil yang sudah diumumkan untuk pendaftaran Anda.</p></div><button class="btn btn-outline" type="button" data-selection-action="dashboard">Dashboard</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat informasi seleksi…</section>` : `<section class="program-section"><div class="dashboard-section-head"><b>Jadwal Seleksi</b><span>${state.schedules.length} jadwal aktif</span></div><div class="program-list">${scheduleCards}</div></section>${state.participants.length ? `<section class="program-section"><div class="dashboard-section-head"><b>Keikutsertaan Saya</b><span>Status peserta</span></div><div class="program-list">${participantCards}</div></section>` : ""}<section class="program-section"><div class="dashboard-section-head"><b>Hasil Seleksi</b><span>Pengumuman resmi</span></div><div class="program-list">${announcementCards}</div></section><button class="btn btn-ghost" type="button" data-selection-action="refresh">Muat ulang</button>`}`;
  }

  async function load() {
    state.loading = true;
    state.error = "";
    render();
    try {
      const selection = await apiCall("getSelectionPageData", token);
      if (!selection?.success) throw new Error(selection?.message || "Jadwal seleksi tidak dapat dimuat.");
      const announcements = await apiCall("getAnnouncementPageData", token);
      if (!announcements?.success) throw new Error(announcements?.message || "Pengumuman tidak dapat dimuat.");
      state.schedules = Array.isArray(selection.schedules) ? selection.schedules : [];
      state.participants = Array.isArray(selection.participants) ? selection.participants : [];
      state.announcements = (Array.isArray(announcements.items) ? announcements.items : []).filter((item) => item.isPublished && item.announcementDate);
    } catch (error) {
      state.error = error.message || "Informasi seleksi belum dapat dimuat.";
    } finally {
      state.loading = false;
      render();
    }
  }

  const onClick = (event) => {
    const action = event.target.closest("[data-selection-action]")?.dataset.selectionAction;
    if (action === "dashboard") onDashboard?.();
    if (action === "refresh") load();
  };
  container.addEventListener("click", onClick);
  render();
  load();
  return () => container.removeEventListener("click", onClick);
}

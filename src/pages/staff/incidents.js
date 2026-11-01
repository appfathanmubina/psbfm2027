import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { OPEN:"Terbuka", INVESTIGATING:"Ditangani", RESOLVED:"Terselesaikan", CLOSED:"Ditutup" };
const priorityLabels = { LOW:"Rendah", MEDIUM:"Sedang", HIGH:"Tinggi", CRITICAL:"Kritis" };
const dateLabel = (value) => { const date = new Date(value || ""); return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(date); };

export function mountIncidentPage(container, { token, onDashboard }) {
  const state = { items:[], selected:null, loading:true, saving:false, error:"", notice:"" };
  function render() {
    const selected = state.selected;
    const list = state.items.length ? state.items.map((item) => `<article class="program-card"><div class="program-card-copy"><span class="eyebrow">${esc(item.category || "GENERAL")} · ${esc(priorityLabels[item.priority] || item.priority || "Sedang")}</span><h2>${esc(item.title || "Insiden")}</h2><p>${esc(item.description || "")}</p><p>${esc(statusLabels[item.status] || item.status || "Terbuka")} · Diperbarui ${esc(dateLabel(item.updatedAt || item.createdAt))}</p>${item.resolutionNote ? `<p><b>Catatan penyelesaian:</b> ${esc(item.resolutionNote)}</p>` : ""}</div><button class="btn btn-outline" type="button" data-incident-action="edit" data-id="${esc(item.incidentId)}">Ubah</button></article>`).join("") : `<section class="dashboard-section"><h2>Belum ada insiden</h2><p class="field-hint">Insiden operasional yang dicatat akan muncul di sini.</p></section>`;
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Admin</span><h1 class="page-title">Insiden Operasional</h1><p class="page-subtitle">Catat, tangani, dan tutup insiden dengan catatan penyelesaian.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-incident-action="new">Insiden baru</button><button class="btn btn-outline" type="button" data-incident-action="refresh">Muat ulang</button><button class="btn btn-outline" type="button" data-incident-action="dashboard">Dashboard</button></div></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}<div class="verification-layout"><section class="verification-queue"><div class="dashboard-section-head"><b>Daftar insiden</b><span>${state.items.filter((item) => !["CLOSED", "RESOLVED"].includes(String(item.status || "").toUpperCase())).length} belum selesai</span></div>${state.loading ? `<div class="dashboard-section" role="status">Memuat insiden…</div>` : list}</section><section class="verification-detail"><div class="dashboard-section"><div class="dashboard-section-head"><b>${selected ? "Ubah insiden" : "Catat insiden"}</b><span>${selected ? esc(selected.incidentId) : "Formulir baru"}</span></div><form id="incident-form"><div class="field"><label for="incident-title">Judul</label><input id="incident-title" name="title" maxlength="160" required value="${esc(selected?.title || "")}"></div><div class="field"><label for="incident-description">Deskripsi</label><textarea id="incident-description" name="description" maxlength="2000" rows="5" required>${esc(selected?.description || "")}</textarea></div><div class="field"><label for="incident-category">Kategori</label><select id="incident-category" name="category">${["GENERAL","SECURITY","DATA","PAYMENT","REGISTRATION","SELECTION","INFRASTRUCTURE"].map((value) => `<option value="${value}" ${String(selected?.category || "GENERAL").toUpperCase() === value ? "selected" : ""}>${value === "GENERAL" ? "Umum" : value === "SECURITY" ? "Keamanan" : value === "DATA" ? "Data" : value === "PAYMENT" ? "Pembayaran" : value === "REGISTRATION" ? "Pendaftaran" : value === "SELECTION" ? "Seleksi" : "Infrastruktur"}</option>`).join("")}</select></div><div class="field"><label for="incident-priority">Prioritas</label><select id="incident-priority" name="priority">${Object.entries(priorityLabels).map(([value,label]) => `<option value="${value}" ${String(selected?.priority || "MEDIUM").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="incident-status">Status</label><select id="incident-status" name="status">${Object.entries(statusLabels).map(([value,label]) => `<option value="${value}" ${String(selected?.status || "OPEN").toUpperCase() === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="incident-resolution">Catatan penyelesaian (bila ada)</label><textarea id="incident-resolution" name="resolutionNote" maxlength="1000" rows="3">${esc(selected?.resolutionNote || "")}</textarea></div><div class="form-row"><button class="btn btn-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Menyimpan…" : "Simpan insiden"}</button>${selected && !["CLOSED"].includes(String(selected.status || "").toUpperCase()) ? `<button class="btn btn-outline" type="button" data-incident-action="close" data-id="${esc(selected.incidentId)}">Tutup insiden</button>` : ""}</div></form></div></section></div>`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try { const result = await apiCall("getIncidentPageData", token); if (!result?.success) throw new Error(result?.message || "Data insiden tidak dapat dimuat."); state.items = Array.isArray(result.items) ? result.items : []; if (state.selected) state.selected = state.items.find((item) => String(item.incidentId) === String(state.selected.incidentId)) || null; }
    catch (error) { state.error = error.message || "Data insiden tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = async (event) => {
    const button = event.target.closest("[data-incident-action]"); if (!button) return;
    const action = button.dataset.incidentAction;
    if (action === "dashboard") onDashboard?.();
    else if (action === "refresh") await load();
    else if (action === "new") { state.selected = null; state.error = ""; state.notice = ""; render(); }
    else if (action === "edit") { state.selected = state.items.find((item) => String(item.incidentId) === String(button.dataset.id)) || null; state.error = ""; state.notice = ""; render(); }
    else if (action === "close") {
      const incident = state.items.find((item) => String(item.incidentId) === String(button.dataset.id));
      if (!incident || !String(incident.resolutionNote || "").trim()) { state.error = "Isi catatan penyelesaian lalu simpan sebelum menutup insiden."; render(); return; }
      if (!window.confirm(`Tutup insiden “${incident.title}”?`)) return;
      state.saving = true; render();
      try { const result = await apiCall("closeIncident", token, incident.incidentId, incident.resolutionNote); if (!result?.success) throw new Error(result?.message || "Insiden tidak dapat ditutup."); state.notice = result.message || "Insiden ditutup."; await load(); }
      catch (error) { state.error = error.message || "Insiden tidak dapat ditutup."; }
      finally { state.saving = false; render(); }
    }
  };
  const onSubmit = async (event) => {
    if (event.target.id !== "incident-form") return;
    event.preventDefault(); const form = new FormData(event.target);
    const payload = Object.fromEntries(["title","description","category","priority","status","resolutionNote"].map((key) => [key, String(form.get(key) || "").trim()]));
    if (state.selected) payload.incidentId = state.selected.incidentId;
    state.saving = true; state.error = ""; state.notice = ""; render();
    try { const result = await apiCall("saveIncident", token, payload); if (!result?.success) throw new Error(result?.message || "Insiden tidak dapat disimpan."); state.notice = result.message || "Insiden disimpan."; state.selected = result.item || null; await load(); }
    catch (error) { state.error = error.message || "Insiden tidak dapat disimpan."; }
    finally { state.saving = false; render(); }
  };
  container.addEventListener("click", onClick); container.addEventListener("submit", onSubmit); render(); load();
  return () => { container.removeEventListener("click", onClick); container.removeEventListener("submit", onSubmit); };
}

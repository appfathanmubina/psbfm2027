import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const bool = (value) => value === true || String(value).toUpperCase() === "TRUE";

export function mountMasterDataPage(container, { token, onDashboard }) {
  const state = { definitions:{}, data:{}, lifecycle:null, masterKey:"", selected:null, loading:true, saving:false, error:"", notice:"" };
  const currentDefinition = () => state.definitions[state.masterKey] || null;
  function renderField(field) {
    const value = state.selected?.[field.key];
    const id = `master-${field.key}`;
    if (field.type === "boolean" && field.key === "isActive" && state.masterKey === "MASTER_TAHUN_AJARAN") return `<p class="field-hint">Status aktif tahun ajaran diubah melalui tombol “Jadikan aktif”. Status saat ini: ${value === undefined ? "Belum aktif" : bool(value) ? "Aktif" : "Tidak aktif"}.</p>`;
    if (field.type === "boolean") return `<label class="checkline master-boolean"><input id="${id}" name="${esc(field.key)}" type="checkbox" ${value === undefined && !(field.key === "isActive" && state.masterKey === "MASTER_TAHUN_AJARAN") ? "checked" : bool(value) ? "checked" : ""}> ${esc(field.label)}</label>`;
    if (field.type === "select") {
      const definition = state.definitions[field.optionMaster] || {};
      const options = (state.data[field.optionMaster]?.items || []).filter((item) => item.isActive === undefined || bool(item.isActive)).map((item) => {
        const selected = String(item[definition.idField] || "") === String(value || "");
        return `<option value="${esc(item[definition.idField])}" ${selected ? "selected" : ""}>${esc(item.name || item[definition.idField])}</option>`;
      }).join("");
      return `<div class="field"><label for="${id}">${esc(field.label)}</label><select id="${id}" name="${esc(field.key)}" ${field.required ? "required" : ""}><option value="">Pilih ${esc(field.label.toLowerCase())}</option>${options}</select></div>`;
    }
    const type = ["text","date","number"].includes(field.type) ? field.type : "text";
    const inputValue = type === "date" && value ? String(value).slice(0,10) : (value ?? "");
    return `<div class="field"><label for="${id}">${esc(field.label)}</label><input id="${id}" name="${esc(field.key)}" type="${type}" value="${esc(inputValue)}" ${field.required ? "required" : ""} ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ""} ${type === "number" ? "min=\"0\" step=\"any\"" : ""}></div>`;
  }
  function render() {
    const definition = currentDefinition();
    const items = state.data[state.masterKey]?.items || [];
    const fields = Array.isArray(definition?.fields) ? definition.fields : [];
    const idField = definition?.idField || "";
    const cards = items.length ? items.map((item) => {
      const active = item.isActive === undefined || bool(item.isActive);
      const activeYear = state.masterKey === "MASTER_TAHUN_AJARAN" && String(item.tahunAjaranId) === String(state.lifecycle?.activeYearId);
      const details = fields.filter((field) => field.key !== "isActive").map((field) => `<span>${esc(field.label)}: <b>${field.type === "boolean" ? (bool(item[field.key]) ? "Ya" : "Tidak") : esc(item[field.key] ?? "-")}</b></span>`).join("");
      const counts = state.masterKey === "MASTER_TAHUN_AJARAN" ? `<span>Pendaftar: <b>${Number(item.registrationCount || 0)}</b></span><span>Jadwal tes: <b>${Number(item.scheduleCount || 0)}</b></span><span>Tagihan: <b>${Number(item.billCount || 0)}</b></span>` : "";
      return `<article class="master-item-card"><div class="dashboard-section-head"><div><span class="eyebrow">${activeYear ? "Tahun aktif" : active ? "Aktif" : "Nonaktif"}</span><h2>${esc(item.name || item[idField])}</h2></div><span class="field-hint">${esc(item[idField])}</span></div><div class="master-item-details">${details}${counts}</div><div class="form-row"><button class="btn btn-outline" type="button" data-master-action="edit" data-id="${esc(item[idField])}">Ubah</button>${active && fields.some((field) => field.key === "isActive") ? `<button class="btn btn-outline" type="button" data-master-action="deactivate" data-id="${esc(item[idField])}" ${activeYear ? "disabled title=\"Pindahkan tahun aktif terlebih dahulu\"" : ""}>Nonaktifkan</button>` : ""}${state.masterKey === "MASTER_TAHUN_AJARAN" && !activeYear ? `<button class="btn btn-outline" type="button" data-master-action="activate-year" data-id="${esc(item[idField])}">Jadikan aktif</button>` : ""}</div></article>`;
    }).join("") : `<section class="dashboard-section"><h2>Belum ada ${esc(definition?.title?.toLowerCase() || "data")}</h2><p class="field-hint">Tambahkan data menggunakan formulir.</p></section>`;
    const tabs = Object.entries(state.definitions).map(([key, item]) => `<button class="master-tab ${key === state.masterKey ? "active" : ""}" type="button" data-master-action="tab" data-key="${esc(key)}">${esc(item.title)}</button>`).join("");
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Admin</span><h1 class="page-title">Data Master</h1><p class="page-subtitle">Kelola periode, gelombang, jenjang, kelas, persyaratan dokumen, dan jenis pembayaran.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-master-action="refresh">Muat ulang</button><button class="btn btn-outline" type="button" data-master-action="dashboard">Dashboard</button></div></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}${state.loading ? `<section class="dashboard-section" role="status">Memuat data master…</section>` : `<nav class="master-tabs" aria-label="Jenis data master">${tabs}</nav>${state.masterKey === "MASTER_TAHUN_AJARAN" && state.lifecycle ? `<section class="dashboard-section"><b>Tahun ajaran aktif: ${esc(state.lifecycle.activeYearName || "Belum ditentukan")}</b><p class="field-hint">Mengganti periode aktif mengubah periode yang dipakai pendaftaran baru. Pendaftar, jadwal, dan tagihan yang sudah ada tetap terkait dengan periodenya masing-masing.</p></section>` : ""}<div class="master-data-layout"><section class="master-data-list"><div class="dashboard-section-head"><b>${esc(definition?.title || "Data")}</b><span>${items.length} data</span></div>${cards}</section><section class="master-data-form"><div class="dashboard-section"><div class="dashboard-section-head"><b>${state.selected ? "Ubah data" : "Tambah data"}</b><span>${state.selected ? esc(state.selected[idField]) : "Form baru"}</span></div><form id="master-data-form">${fields.map(renderField).join("")}<div class="form-row"><button class="btn btn-primary" type="submit" ${state.saving ? "disabled" : ""}>${state.saving ? "Menyimpan…" : "Simpan data"}</button>${state.selected ? `<button class="btn btn-outline" type="button" data-master-action="new">Batal ubah</button>` : ""}</div></form></div></section></div>`}`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const defsResult = await apiCall("getMasterDefinitions", token);
      if (!defsResult?.success) throw new Error(defsResult?.message || "Daftar data master tidak dapat dimuat.");
      state.definitions = defsResult.definitions || {};
      if (!state.masterKey || !state.definitions[state.masterKey]) state.masterKey = Object.keys(state.definitions)[0] || "";
      const keys = Object.keys(state.definitions);
      const results = await Promise.all(keys.map((key) => apiCall("getMasterData", token, key, true)));
      const nextData = {};
      results.forEach((result, index) => { if (!result?.success) throw new Error(result?.message || `Data ${state.definitions[keys[index]]?.title || keys[index]} tidak dapat dimuat.`); nextData[keys[index]] = result; });
      state.data = nextData;
      const lifecycle = await apiCall("getAcademicYearLifecycleData", token);
      if (!lifecycle?.success) throw new Error(lifecycle?.message || "Status tahun ajaran tidak dapat dimuat.");
      state.lifecycle = lifecycle;
      const lifecycleById = new Map((lifecycle.items || []).map((item) => [String(item.tahunAjaranId), item]));
      if (state.data.MASTER_TAHUN_AJARAN) state.data.MASTER_TAHUN_AJARAN.items = state.data.MASTER_TAHUN_AJARAN.items.map((item) => Object.assign({}, item, lifecycleById.get(String(item.tahunAjaranId)) || {}));
      if (state.selected) state.selected = (state.data[state.masterKey]?.items || []).find((item) => String(item[state.definitions[state.masterKey].idField]) === String(state.selected[state.definitions[state.masterKey].idField])) || null;
    } catch (error) { state.error = error.message || "Data master tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = async (event) => {
    const button = event.target.closest("[data-master-action]"); if (!button) return;
    const action = button.dataset.masterAction;
    if (action === "dashboard") onDashboard?.();
    else if (action === "refresh") await load();
    else if (action === "tab") { state.masterKey = button.dataset.key; state.selected = null; state.error = ""; state.notice = ""; render(); }
    else if (action === "new") { state.selected = null; state.error = ""; state.notice = ""; render(); }
    else if (action === "edit") { state.selected = (state.data[state.masterKey]?.items || []).find((item) => String(item[state.definitions[state.masterKey].idField]) === String(button.dataset.id)) || null; state.error = ""; state.notice = ""; render(); }
    else if (action === "deactivate") {
      const item = (state.data[state.masterKey]?.items || []).find((row) => String(row[state.definitions[state.masterKey].idField]) === String(button.dataset.id));
      if (!item || !window.confirm(`Nonaktifkan “${item.name || item[ state.definitions[state.masterKey].idField]}”? Data ini tidak akan digunakan untuk pilihan baru.`)) return;
      try { const result = await apiCall("deactivateMasterItem", token, state.masterKey, button.dataset.id); if (!result?.success) throw new Error(result?.message || "Data tidak dapat dinonaktifkan."); state.notice = result.message || "Data dinonaktifkan."; await load(); }
      catch (error) { state.error = error.message || "Data tidak dapat dinonaktifkan."; render(); }
    } else if (action === "activate-year") {
      const item = (state.data.MASTER_TAHUN_AJARAN?.items || []).find((row) => String(row.tahunAjaranId) === String(button.dataset.id));
      if (!item) return;
      const impact = `Pendaftar: ${Number(item.registrationCount || 0)}, jadwal tes: ${Number(item.scheduleCount || 0)}, tagihan: ${Number(item.billCount || 0)}. Data yang ada tidak dipindahkan.`;
      if (!window.confirm(`Jadikan ${item.name} periode aktif? ${impact}`)) return;
      try { const result = await apiCall("setActiveAcademicYear", token, item.tahunAjaranId); if (!result?.success) throw new Error(result?.message || "Tahun ajaran aktif tidak dapat diganti."); state.notice = result.message || "Tahun ajaran aktif diperbarui."; await load(); }
      catch (error) { state.error = error.message || "Tahun ajaran aktif tidak dapat diganti."; render(); }
    }
  };
  const onSubmit = async (event) => {
    if (event.target.id !== "master-data-form") return;
    event.preventDefault(); const form = new FormData(event.target); const definition = currentDefinition();
    const payload = {};
    definition.fields.forEach((field) => { if (field.key === "isActive" && state.masterKey === "MASTER_TAHUN_AJARAN") return; payload[field.key] = field.type === "boolean" ? form.has(field.key) : String(form.get(field.key) || "").trim(); });
    if (state.selected) payload[definition.idField] = state.selected[definition.idField];
    if (state.selected && state.masterKey === "MASTER_TAHUN_AJARAN") payload.isActive = bool(state.selected.isActive);
    state.saving = true; state.error = ""; state.notice = ""; render();
    try { const result = await apiCall("saveMasterItem", token, state.masterKey, payload); if (!result?.success) throw new Error(result?.message || "Data master tidak dapat disimpan."); state.notice = result.message || "Data master disimpan."; state.selected = result.item || null; await load(); }
    catch (error) { state.error = error.message || "Data master tidak dapat disimpan."; }
    finally { state.saving = false; render(); }
  };
  container.addEventListener("click", onClick); container.addEventListener("submit", onSubmit); render(); load();
  return () => { container.removeEventListener("click", onClick); container.removeEventListener("submit", onSubmit); };
}

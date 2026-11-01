import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const labels = { DRAFT:"Draft", SUBMITTED:"Menunggu verifikasi", UNDER_REVIEW:"Sedang diverifikasi", REVISION:"Perlu perbaikan", VERIFIED:"Terverifikasi", PAYMENT_VERIFIED:"Pembayaran terverifikasi", SELECTION:"Seleksi", PASSED:"Lulus", NOT_PASSED:"Tidak lulus", REREGISTRATION:"Daftar ulang", COMPLETED:"Selesai", CANCELLED:"Dibatalkan" };

function emptyRegistration(yearId) {
  return {
    registration: { tahunAjaranId: yearId, gelombangId: "", jenjangId: "" },
    candidate: {}, guardian: {}, address: {}, school: {}
  };
}
function field(name, label, value = "", type = "text", required = false, extra = "") {
  return `<div class="field"><label for="reg-${name}">${esc(label)}${required ? " *" : ""}</label><input id="reg-${name}" name="${esc(name)}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${extra}></div>`;
}
function selectField(name, label, value, items, idKey, required = false) {
  const options = (items || []).map((item) => `<option value="${esc(item[idKey])}" ${String(item[idKey]) === String(value || "") ? "selected" : ""}>${esc(item.name || item.label || item[idKey])}</option>`).join("");
  return `<div class="field"><label for="reg-${name}">${esc(label)}${required ? " *" : ""}</label><select id="reg-${name}" name="${esc(name)}" ${required ? "required" : ""}><option value="">Pilih ${esc(label.toLowerCase())}</option>${options}</select></div>`;
}
function registrationId() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return `REG-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
function dateFieldValue(value) {
  const raw = String(value || "");
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

export function mountRegistrationPage(container, { token }) {
  const state = { registrations: [], options: null, selected: null, loading: true, saving: false, error: "", notice: "" };

  function renderList() {
    const items = state.registrations;
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Portal Wali Santri</span><h1 class="page-title">Pendaftaran Saya</h1><p class="page-subtitle">Kelola formulir calon santri dan pantau status verifikasinya.</p></div><button class="btn btn-primary" type="button" data-registration-action="new" ${state.loading || !state.options?.activeYearId ? "disabled" : ""}>Tambah Pendaftaran</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}
      ${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      ${!state.loading && state.options && !state.options.activeYearId ? `<div class="form-error show" role="alert">Tahun ajaran aktif belum dikonfigurasi. Hubungi Panitia.</div>` : ""}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat pendaftaran…</section>` : items.length ? `<div class="registration-list">${items.map((item) => {
        const status = String(item.status || "DRAFT").toUpperCase();
        const editableStatus = ["DRAFT", "REVISION"].includes(status);
        const editable = editableStatus && String(item.tahunAjaranId) === String(state.options?.activeYearId);
        const action = editable ? `<button class="btn btn-outline" type="button" data-registration-action="edit" data-registration-id="${esc(item.registrationId)}">Lanjutkan</button>` : `<span class="field-hint">${editableStatus ? "Tahun ajaran ini tidak aktif untuk perubahan." : "Formulir sudah dikirim"}</span>`;
        return `<article class="registration-card"><div class="registration-card-copy"><span class="status-badge">${esc(labels[status] || status)}</span><h2>${esc(item.candidateName || "Calon Santri")}</h2><p>${esc(item.registrationNumber || item.registrationId || "-")} · ${esc(item.jenjangName || "Jenjang belum dipilih")} · ${esc(item.tahunAjaranName || "Tahun ajaran")}</p></div>${action}</article>`;
      }).join("")}</div>` : `<section class="dashboard-section"><h2>Belum ada pendaftaran</h2><p class="field-hint">Buat formulir calon santri saat periode pendaftaran dan konfigurasi tahun ajaran tersedia.</p></section>`}
      <button class="btn btn-ghost" type="button" data-registration-action="refresh" ${state.loading ? "disabled" : ""}>Muat ulang</button>`;
  }

  function renderForm() {
    const item = state.selected || emptyRegistration(state.options?.activeYearId);
    const reg = item.registration || {};
    const candidate = item.candidate || {};
    const guardian = item.guardian || {};
    const address = item.address || {};
    const school = item.school || {};
    const status = String(reg.status || "DRAFT").toUpperCase();
    const yearId = reg.tahunAjaranId || state.options?.activeYearId || "";
    const yearName = state.options?.years?.find((year) => String(year.tahunAjaranId) === String(yearId))?.name || state.options?.activeYearName || yearId;
    const canSubmit = ["DRAFT", "REVISION"].includes(status);
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Formulir Pendaftaran</span><h1 class="page-title">${reg.registrationId ? "Lanjutkan Pendaftaran" : "Pendaftaran Calon Santri"}</h1><p class="page-subtitle">Lengkapi data dengan benar. Tanda * menunjukkan kolom wajib sebelum dikirim.</p></div><button class="btn btn-outline" type="button" data-registration-action="cancel">Kembali</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}
      ${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      <form id="registration-form" novalidate>
        <section class="dashboard-section"><h2>Informasi Pendaftaran</h2><div class="registration-fields">
          <div class="field"><label for="reg-year-display">Tahun Ajaran *</label><input id="reg-year-display" type="text" value="${esc(yearName)}" readonly><input type="hidden" name="tahunAjaranId" value="${esc(yearId)}"></div>
          ${selectField("gelombangId", "Gelombang", reg.gelombangId, state.options?.waves, "gelombangId", true)}
          ${selectField("jenjangId", "Jenjang", reg.jenjangId, state.options?.jenjang, "jenjangId", true)}
        </div><p class="field-hint">Pilihan tahun dan gelombang mengikuti konfigurasi aktif dari backend.</p></section>
        <section class="dashboard-section"><h2>Data Calon Santri</h2><div class="registration-fields">
          ${field("candidate.fullName", "Nama lengkap", candidate.fullName, "text", true, "autocomplete=\"name\"")}
          ${field("candidate.nik", "NIK calon santri", candidate.nik, "text", false, "inputmode=\"numeric\" maxlength=\"16\"")}
          ${field("candidate.birthPlace", "Tempat lahir", candidate.birthPlace, "text", true)}
          ${field("candidate.birthDate", "Tanggal lahir", dateFieldValue(candidate.birthDate), "date", true)}
          ${selectField("candidate.gender", "Jenis kelamin", candidate.gender, [{value:"L",name:"Laki-laki"},{value:"P",name:"Perempuan"}], "value", true)}
          ${field("candidate.birthOrder", "Anak ke", candidate.birthOrder, "number", false, "min=\"1\"")}
          ${field("candidate.familyStatus", "Status dalam keluarga", candidate.familyStatus)}
        </div></section>
        <section class="dashboard-section"><h2>Data Wali</h2><div class="registration-fields">
          ${selectField("guardian.relationship", "Hubungan wali", guardian.relationship, [{value:"AYAH",name:"Ayah"},{value:"IBU",name:"Ibu"},{value:"WALI",name:"Wali"}], "value", true)}
          ${field("guardian.fullName", "Nama lengkap wali", guardian.fullName, "text", true, "autocomplete=\"name\"")}
          ${field("guardian.nik", "NIK wali", guardian.nik, "text", false, "inputmode=\"numeric\" maxlength=\"16\"")}
          ${field("guardian.phone", "Nomor HP wali", guardian.phone, "tel", true, "autocomplete=\"tel\"")}
          ${field("guardian.email", "Email wali", guardian.email, "email", false, "autocomplete=\"email\"")}
          ${field("guardian.occupation", "Pekerjaan", guardian.occupation)}
          ${field("guardian.education", "Pendidikan terakhir", guardian.education)}
        </div></section>
        <section class="dashboard-section"><h2>Alamat Domisili</h2><div class="registration-fields">
          ${field("address.addressLine", "Alamat lengkap", address.addressLine, "text", true, "autocomplete=\"street-address\"")}
          ${field("address.rt", "RT", address.rt)}${field("address.rw", "RW", address.rw)}
          ${field("address.village", "Desa/Kelurahan", address.village, "text", true)}
          ${field("address.district", "Kecamatan", address.district, "text", true)}
          ${field("address.regency", "Kabupaten/Kota", address.regency, "text", true)}
          ${field("address.province", "Provinsi", address.province, "text", true)}
          ${field("address.postalCode", "Kode pos", address.postalCode, "text", false, "inputmode=\"numeric\"")}
        </div></section>
        <section class="dashboard-section"><h2>Sekolah Asal</h2><div class="registration-fields">
          ${field("school.schoolName", "Nama sekolah", school.schoolName, "text", true)}
          ${field("school.schoolType", "Jenis sekolah", school.schoolType)}
          ${field("school.npsn", "NPSN", school.npsn)}
          ${field("school.address", "Alamat sekolah", school.address)}
          ${field("school.graduationYear", "Tahun lulus", school.graduationYear, "number", true, "min=\"1900\" max=\"2200\"")}
        </div></section>
        <div class="registration-actions"><button class="btn btn-outline" type="button" data-registration-action="save" ${state.saving ? "disabled" : ""}>${state.saving ? "Menyimpan…" : "Simpan Draft"}</button>${canSubmit ? `<button class="btn btn-primary" type="button" data-registration-action="submit" ${state.saving ? "disabled" : ""}>Simpan & Kirim</button>` : ""}</div>
      </form>`;
  }

  async function load() {
    state.loading = true;
    state.error = "";
    renderList();
    try {
      const [list, options] = await Promise.all([apiCall("getMyRegistrations", token), apiCall("getRegistrationFormOptions", token)]);
      if (!list?.success) throw new Error(list?.message || "Daftar pendaftaran tidak dapat dimuat.");
      if (!options?.success) throw new Error(options?.message || "Pilihan formulir tidak dapat dimuat.");
      state.registrations = Array.isArray(list.registrations) ? list.registrations : [];
      state.options = options;
    } catch (error) {
      state.error = error.message || "Terjadi kendala saat memuat pendaftaran.";
    } finally {
      state.loading = false;
      renderList();
    }
  }

  async function openExisting(id) {
    state.error = "";
    try {
      const result = await apiCall("getRegistrationDetail", token, id);
      if (!result?.success || !result.registration) throw new Error(result?.message || "Detail pendaftaran tidak dapat dimuat.");
      state.selected = result;
      renderForm();
    } catch (error) {
      state.error = error.message || "Detail pendaftaran tidak dapat dimuat.";
      renderList();
    }
  }

  function payloadFromForm(form) {
    const data = new FormData(form);
    const get = (key) => String(data.get(key) || "").trim();
    const id = String(state.selected?.registration?.registrationId || registrationId());
    if (state.selected?.registration && !state.selected.registration.registrationId) state.selected.registration.registrationId = id;
    return {
      registrationId: id,
      tahunAjaranId: get("tahunAjaranId"), gelombangId: get("gelombangId"), jenjangId: get("jenjangId"),
      candidate: { fullName:get("candidate.fullName"), nik:get("candidate.nik"), birthPlace:get("candidate.birthPlace"), birthDate:get("candidate.birthDate"), gender:get("candidate.gender"), birthOrder:get("candidate.birthOrder"), familyStatus:get("candidate.familyStatus") },
      guardian: { relationship:get("guardian.relationship"), fullName:get("guardian.fullName"), nik:get("guardian.nik"), phone:get("guardian.phone"), email:get("guardian.email"), occupation:get("guardian.occupation"), education:get("guardian.education") },
      address: { addressLine:get("address.addressLine"), rt:get("address.rt"), rw:get("address.rw"), village:get("address.village"), district:get("address.district"), regency:get("address.regency"), province:get("address.province"), postalCode:get("address.postalCode") },
      school: { schoolName:get("school.schoolName"), schoolType:get("school.schoolType"), npsn:get("school.npsn"), address:get("school.address"), graduationYear:get("school.graduationYear") }
    };
  }

  async function save(intent) {
    const form = container.querySelector("#registration-form");
    if (!form) return;
    if (intent === "submit" && !form.reportValidity()) return;
    const payload = payloadFromForm(form);
    state.saving = true;
    state.error = "";
    renderForm();
    try {
      const result = await apiCall("saveRegistration", token, payload);
      if (!result?.success) throw new Error(result?.message || "Draft pendaftaran tidak dapat disimpan.");
      state.selected = { ...state.selected, ...result, registration:result.registration, candidate:result.candidate, guardian:result.guardian, address:result.address, school:result.school };
      if (intent === "submit") {
        const submitted = await apiCall("submitRegistration", token, result.registration.registrationId);
        if (!submitted?.success) throw new Error(submitted?.message || "Pendaftaran belum dapat dikirim.");
        state.selected = null;
        state.notice = submitted.message || "Pendaftaran berhasil dikirim untuk verifikasi.";
        await load();
      } else {
        state.notice = result.message || "Draft berhasil disimpan.";
        renderForm();
      }
    } catch (error) {
      state.error = error.message || "Pendaftaran tidak dapat disimpan.";
      renderForm();
    } finally {
      state.saving = false;
      if (state.selected) renderForm();
    }
  }

  const onClick = async (event) => {
    const button = event.target.closest("[data-registration-action]");
    if (!button) return;
    const action = button.dataset.registrationAction;
    if (action === "new") { state.selected = emptyRegistration(state.options?.activeYearId); state.error = ""; state.notice = ""; renderForm(); }
    if (action === "edit") { state.notice = ""; await openExisting(button.dataset.registrationId); }
    if (action === "cancel") { state.selected = null; state.error = ""; state.notice = ""; renderList(); }
    if (action === "refresh") await load();
    if (action === "save" || action === "submit") await save(action);
  };
  const onSubmit = (event) => { if (event.target.id === "registration-form") event.preventDefault(); };
  container.addEventListener("click", onClick);
  container.addEventListener("submit", onSubmit);
  renderList();
  load();
  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("submit", onSubmit);
  };
}

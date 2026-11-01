import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { PENDING:"Menunggu verifikasi", VERIFIED:"Terverifikasi", REVISION:"Perlu perbaikan", REJECTED:"Ditolak", REPLACED:"Diganti" };
const maxFallbackBytes = 5 * 1024 * 1024;

function allowedRules(documentType) {
  return String(documentType?.allowedMimeTypes || "").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
}
function mimeAllowed(mime, rules) {
  return !rules.length || rules.some((rule) => rule === mime || (rule.endsWith("/*") && mime.startsWith(rule.slice(0, -1))));
}
function fileUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && url.hostname === "drive.google.com" ? url.href : "";
  } catch { return ""; }
}
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("File tidak dapat dibaca. Pilih ulang dokumen."));
    reader.readAsDataURL(file);
  });
}
function canvasBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
async function compressJpeg(file, maxBytes) {
  if (file.type !== "image/jpeg" || file.size <= maxBytes || typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await canvasBlob(canvas, Math.max(0.5, 0.84 - attempt * 0.06));
      if (!blob) break;
      if (blob.size <= maxBytes) return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg", lastModified: Date.now() });
      scale *= 0.82;
    }
    return file;
  } finally { bitmap.close?.(); }
}
function formatSize(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function mountDocumentsPage(container, { token, onRegistration }) {
  const state = { registrations: [], data: null, selectedId: "", loading: true, uploadingId: "", error: "", notice: "" };

  function render() {
    const registrations = state.registrations;
    const data = state.data;
    const selected = registrations.find((item) => String(item.registrationId) === String(state.selectedId));
    const selection = registrations.length > 1 ? `<div class="field"><label for="document-registration">Pilih calon santri</label><select id="document-registration">${registrations.map((item) => `<option value="${esc(item.registrationId)}" ${String(item.registrationId) === String(state.selectedId) ? "selected" : ""}>${esc(item.candidateName || item.registrationNumber || "Calon Santri")} · ${esc(item.registrationNumber || "-")}</option>`).join("")}</select></div>` : selected ? `<div class="document-registration-note">${esc(selected.candidateName || "Calon Santri")} · ${esc(selected.registrationNumber || "-")}</div>` : "";
    const checklist = Array.isArray(data?.checklist) ? data.checklist : [];
    const cards = checklist.map((item) => {
      const document = item.document;
      const status = String(document?.status || "MISSING").toUpperCase();
      const rules = allowedRules(item);
      const accept = rules.join(",");
      const maxMb = Number(item.maxSizeMb || 0);
      const maxText = maxMb > 0 ? `${maxMb} MB` : "5 MB";
      const link = fileUrl(document?.fileUrl);
      const canUpload = Boolean(data?.canUpload) && !state.uploadingId;
      return `<article class="document-card"><div class="document-card-head"><div><h2>${esc(item.name || item.label || "Dokumen")}${item.isRequired ? " *" : ""}</h2><p>${esc(item.description || "Unggah dokumen sesuai persyaratan.")}</p></div><span class="status-badge ${status === "VERIFIED" ? "verified" : status === "REVISION" || status === "REJECTED" ? "attention" : ""}">${esc(statusLabels[status] || (status === "MISSING" ? "Belum diunggah" : status))}</span></div>
        ${document ? `<div class="document-file"><span>${esc(document.fileName || "Dokumen terunggah")}</span><span>${formatSize(document.fileSize)}</span>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Lihat file</a>` : ""}</div>${document.revisionNote ? `<div class="document-revision"><b>Catatan revisi</b><p>${esc(document.revisionNote)}</p></div>` : ""}` : ""}
        ${data?.canUpload ? `<div class="document-upload"><div class="field"><label for="document-file-${esc(item.documentTypeId)}">File (maks. ${esc(maxText)})</label><input id="document-file-${esc(item.documentTypeId)}" type="file" data-document-file="${esc(item.documentTypeId)}" accept="${esc(accept)}"></div><button class="btn btn-outline" type="button" data-document-action="upload" data-document-type="${esc(item.documentTypeId)}" ${canUpload ? "" : "disabled"}>${state.uploadingId === String(item.documentTypeId) ? "Mengunggah…" : document ? "Ganti Dokumen" : "Unggah Dokumen"}</button></div>` : ""}
        ${item.isRequired ? `<div class="field-hint">Dokumen wajib</div>` : ""}</article>`;
    }).join("");
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Portal Wali Santri</span><h1 class="page-title">Dokumen Persyaratan</h1><p class="page-subtitle">Unggah dokumen untuk setiap calon santri. Tipe dan batas ukuran mengikuti ketentuan Panitia.</p></div><button class="btn btn-outline" type="button" data-document-action="back">Pendaftaran</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      ${selection}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat daftar dokumen…</section>` : !registrations.length ? `<section class="dashboard-section"><h2>Belum ada pendaftaran</h2><p class="field-hint">Buat formulir calon santri sebelum mengunggah dokumen.</p><button class="btn btn-primary" type="button" data-document-action="back">Buka Pendaftaran</button></section>` : !data ? `<section class="dashboard-section"><h2>Daftar dokumen belum tersedia</h2><button class="btn btn-outline" type="button" data-document-action="refresh">Coba lagi</button></section>` : `<div class="document-checklist">${cards || `<section class="dashboard-section">Belum ada jenis dokumen aktif.</section>`}</div>`}
      ${registrations.length && !state.loading ? `<button class="btn btn-ghost" type="button" data-document-action="refresh">Muat ulang</button>` : ""}`;
  }

  async function load(registrationId = state.selectedId) {
    state.loading = true;
    state.error = "";
    state.selectedId = String(registrationId || state.selectedId || "");
    state.data = null;
    render();
    try {
      const result = await apiCall("getDocumentPageData", token, registrationId);
      if (!result?.success) throw new Error(result?.message || "Daftar dokumen tidak dapat dimuat.");
      state.registrations = Array.isArray(result.registrations) ? result.registrations : [];
      state.data = result.documentData || null;
      state.selectedId = String(state.data?.registration?.registrationId || state.registrations[0]?.registrationId || "");
    } catch (error) {
      state.error = error.message || "Terjadi kendala saat memuat dokumen.";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function upload(documentTypeId) {
    const input = container.querySelector(`[data-document-file="${CSS.escape(String(documentTypeId))}"]`);
    const original = input?.files?.[0];
    if (!original) { state.error = "Pilih file dokumen terlebih dahulu."; render(); return; }
    const type = state.data?.documentTypes?.find((item) => String(item.documentTypeId) === String(documentTypeId));
    const rules = allowedRules(type);
    if (!mimeAllowed(original.type.toLowerCase(), rules)) { state.error = "Tipe file tidak diizinkan untuk dokumen ini."; render(); return; }
    const configuredMax = Number(type?.maxSizeMb || 0);
    const maxBytes = configuredMax > 0 ? configuredMax * 1024 * 1024 : maxFallbackBytes;
    state.error = "";
    state.notice = "";
    state.uploadingId = String(documentTypeId);
    render();
    try {
      const file = await compressJpeg(original, maxBytes);
      if (file.size > maxBytes) throw new Error(`Ukuran file melebihi batas ${formatSize(maxBytes)}. Pilih file yang lebih kecil.`);
      if (!mimeAllowed(file.type.toLowerCase(), rules)) throw new Error("Tipe file hasil kompresi tidak diizinkan. Pilih file dengan tipe yang tercantum.");
      const base64 = await readAsBase64(file);
      const result = await apiCall("uploadDocument", token, {
        registrationId: state.selectedId,
        documentTypeId: String(documentTypeId),
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
        base64
      });
      if (!result?.success) throw new Error(result?.message || "Dokumen tidak dapat diunggah.");
      state.notice = original.size !== file.size ? `Dokumen berhasil diunggah dan dikompres dari ${formatSize(original.size)} menjadi ${formatSize(file.size)}.` : (result.message || "Dokumen berhasil diunggah.");
      await load(state.selectedId);
    } catch (error) {
      state.error = error.message || "Dokumen tidak dapat diunggah.";
    } finally {
      state.uploadingId = "";
      render();
    }
  }

  const onClick = async (event) => {
    const button = event.target.closest("[data-document-action]");
    if (!button) return;
    const action = button.dataset.documentAction;
    if (action === "back") onRegistration?.();
    if (action === "refresh") await load(state.selectedId);
    if (action === "upload") await upload(button.dataset.documentType);
  };
  const onChange = async (event) => {
    if (event.target.id === "document-registration") await load(event.target.value);
  };
  container.addEventListener("click", onClick);
  container.addEventListener("change", onChange);
  render();
  load();
  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("change", onChange);
  };
}

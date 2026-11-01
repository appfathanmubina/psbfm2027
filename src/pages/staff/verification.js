import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const statusLabels = { SUBMITTED:"Menunggu verifikasi", UNDER_REVIEW:"Sedang ditinjau", REVISION:"Perlu perbaikan", VERIFIED:"Terverifikasi", REREGISTRATION:"Daftar ulang" };
const isRequired = (item) => item.required === true || String(item.required || "").toUpperCase() === "TRUE";

function safeDriveUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" && ["drive.google.com", "drive.usercontent.google.com"].includes(url.hostname) ? url.href : "";
  } catch { return ""; }
}

export function mountVerificationPage(container, { token }) {
  const state = { registrations:[], detail:null, selectedId:"", loading:true, busy:false, error:"", notice:"", decisionNote:"", revisionNotes:{} };
  const reviewableStatuses = new Set(["SUBMITTED", "UNDER_REVIEW", "REVISION", "REREGISTRATION"]);

  function render() {
    const detail = state.detail;
    const registration = detail?.registration || {};
    const checklist = Array.isArray(detail?.checklist) ? detail.checklist : [];
    const canReview = reviewableStatuses.has(String(registration.status || "").toUpperCase());
    const canDecide = ["SUBMITTED", "UNDER_REVIEW", "REVISION"].includes(String(registration.status || "").toUpperCase());
    const requiredComplete = checklist.filter(isRequired).every((item) => String(item.document?.status || "").toUpperCase() === "VERIFIED");
    const queue = state.registrations.length ? `<div class="verification-queue">${state.registrations.map((item) => {
      const status = String(item.status || "").toUpperCase();
      const selected = String(item.registrationId) === String(state.selectedId);
      return `<button type="button" class="verification-queue-item ${selected ? "selected" : ""}" data-verification-action="open" data-registration-id="${esc(item.registrationId)}"><span class="status-badge">${esc(statusLabels[status] || status)}</span><b>${esc(item.candidateName || "Calon Santri")}</b><small>${esc(item.registrationNumber || item.registrationId || "-")}</small></button>`;
    }).join("")}</div>` : `<section class="dashboard-section"><h2>Antrean kosong</h2><p class="field-hint">Tidak ada pendaftaran pada antrean verifikasi.</p></section>`;
    const documentCards = checklist.map((item) => {
      const doc = item.document;
      const status = String(doc?.status || "MISSING").toUpperCase();
      const fileUrl = safeDriveUrl(doc?.fileUrl);
      const documentId = String(doc?.documentId || "");
      return `<article class="verification-doc-card"><div class="document-card-head"><div><h3>${esc(item.name || "Dokumen")}${isRequired(item) ? " *" : ""}</h3><p>${esc(doc?.fileName || (doc ? "Dokumen tersedia" : "Belum diunggah"))}</p></div><span class="status-badge ${status === "VERIFIED" ? "verified" : status === "REVISION" ? "attention" : ""}">${esc(status === "MISSING" ? "Belum diunggah" : status === "VERIFIED" ? "Terverifikasi" : status === "REVISION" ? "Perlu perbaikan" : "Menunggu pemeriksaan")}</span></div>
        ${fileUrl ? `<a class="btn btn-ghost" href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer">Buka dokumen</a>` : ""}${doc?.revisionNote ? `<p class="field-hint">Catatan sebelumnya: ${esc(doc.revisionNote)}</p>` : ""}
        ${doc && canReview ? `<div class="verification-actions"><div class="field"><label for="revision-${esc(documentId)}">Catatan revisi (wajib jika dikembalikan)</label><textarea id="revision-${esc(documentId)}" data-revision-note="${esc(documentId)}" rows="2" maxlength="500" placeholder="Jelaskan bagian yang perlu diperbaiki">${esc(state.revisionNotes[documentId] || "")}</textarea></div><div class="hero-actions"><button class="btn btn-outline" type="button" data-verification-action="doc-verified" data-document-id="${esc(documentId)}" ${state.busy ? "disabled" : ""}>Setujui dokumen</button><button class="btn btn-outline" type="button" data-verification-action="doc-revision" data-document-id="${esc(documentId)}" ${state.busy ? "disabled" : ""}>Minta revisi</button></div></div>` : ""}</article>`;
    }).join("");
    const candidate = detail?.candidate || {};
    const guardian = detail?.guardian || {};
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Area Panitia</span><h1 class="page-title">Verifikasi Pendaftaran</h1><p class="page-subtitle">Tinjau data calon santri dan periksa dokumen sesuai persyaratan.</p></div><button class="btn btn-outline" type="button" data-verification-action="refresh">Muat ulang</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      <div class="verification-layout"><aside><div class="field"><label for="verification-search">Cari nomor pendaftaran</label><input id="verification-search" type="search" placeholder="Nomor pendaftaran" value="${esc(state.search || "")}"></div><button class="btn btn-ghost" type="button" data-verification-action="search">Cari</button>${state.loading ? `<section class="dashboard-section" role="status">Memuat antrean…</section>` : queue}</aside>
      <section class="verification-detail">${!detail ? `<section class="dashboard-section"><h2>Pilih pendaftaran</h2><p class="field-hint">Pilih satu pendaftar dari antrean untuk meninjau data dan dokumennya.</p></section>` : `<section class="dashboard-section"><div class="dashboard-section-head"><div><span class="eyebrow">${esc(detail.registration?.registrationNumber || detail.registration?.registrationId || "Pendaftaran")}</span><h2>${esc(candidate.fullName || "Calon Santri")}</h2></div><span class="status-badge">${esc(statusLabels[String(registration.status || "").toUpperCase()] || registration.status || "-")}</span></div><div class="registration-fields"><div><b>Jenjang</b><p>${esc(registration.jenjangId || "-")}</p></div><div><b>Wali</b><p>${esc(guardian.fullName || "-")}</p></div><div><b>Telepon Wali</b><p>${esc(guardian.phone || "-")}</p></div><div><b>Sekolah asal</b><p>${esc(detail.school?.schoolName || "-")}</p></div></div></section>
        <section class="dashboard-section"><h2>Dokumen Persyaratan</h2><div class="verification-doc-list">${documentCards || `<p class="field-hint">Belum ada jenis dokumen aktif.</p>`}</div></section>
        ${canDecide ? `<section class="dashboard-section"><h2>Keputusan Pendaftaran</h2><div class="field"><label for="verification-decision-note">Catatan untuk Wali</label><textarea id="verification-decision-note" rows="3" maxlength="1000" placeholder="Catatan keputusan atau hal yang perlu dilengkapi">${esc(state.decisionNote)}</textarea></div><div class="hero-actions"><button class="btn btn-primary" type="button" data-verification-action="approve" ${state.busy || !requiredComplete ? "disabled" : ""}>Tandai terverifikasi</button><button class="btn btn-outline" type="button" data-verification-action="return" ${state.busy ? "disabled" : ""}>Kembalikan untuk perbaikan</button></div>${!requiredComplete ? `<p class="field-hint">Setiap dokumen wajib harus disetujui sebelum pendaftaran dapat diverifikasi.</p>` : ""}</section>` : ""}`}</section></div>`;
  }

  async function loadQueue(search = "") {
    state.loading = true;
    state.error = "";
    state.search = search;
    render();
    try {
      const result = await apiCall("getVerificationQueue", token, { search });
      if (!result?.success) throw new Error(result?.message || "Antrean verifikasi tidak dapat dimuat.");
      state.registrations = Array.isArray(result.registrations) ? result.registrations : [];
      if (!state.registrations.some((item) => String(item.registrationId) === String(state.selectedId))) {
        state.selectedId = "";
        state.detail = null;
      }
      if (state.selectedId) await loadDetail(state.selectedId, false);
    } catch (error) {
      state.error = error.message || "Antrean verifikasi tidak dapat dimuat.";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function loadDetail(registrationId, showLoading = true) {
    if (showLoading) { state.loading = true; state.error = ""; render(); }
    try {
      const result = await apiCall("getVerificationDetail", token, registrationId);
      if (!result?.success) throw new Error(result?.message || "Detail pendaftaran tidak dapat dimuat.");
      state.detail = result;
      state.selectedId = String(registrationId);
      state.decisionNote = "";
      state.revisionNotes = {};
    } catch (error) {
      state.error = error.message || "Detail pendaftaran tidak dapat dimuat.";
      if (showLoading) state.detail = null;
    } finally {
      if (showLoading) state.loading = false;
      render();
    }
  }

  async function reviewDocument(documentId, status) {
    const note = String(state.revisionNotes[documentId] || "").trim();
    if (status === "REVISION" && !note) { state.error = "Isi catatan tentang perbaikan dokumen terlebih dahulu."; render(); return; }
    state.busy = true; state.error = ""; state.notice = ""; render();
    try {
      const result = await apiCall("verifyDocument", token, { documentId, status, note });
      if (!result?.success) throw new Error(result?.message || "Status dokumen tidak dapat disimpan.");
      state.notice = result.message || "Status dokumen berhasil disimpan.";
      await loadDetail(state.selectedId, false);
    } catch (error) { state.error = error.message || "Status dokumen tidak dapat disimpan."; }
    finally { state.busy = false; render(); }
  }

  async function decide(decision) {
    const note = String(state.decisionNote || "").trim();
    if (decision === "REVISION" && !note) { state.error = "Isi catatan sebelum mengembalikan pendaftaran."; render(); return; }
    state.busy = true; state.error = ""; state.notice = ""; render();
    try {
      const result = await apiCall("finalizeVerification", token, { registrationId:state.selectedId, decision, note });
      if (!result?.success) throw new Error(result?.message || "Keputusan verifikasi tidak dapat disimpan.");
      state.notice = result.message || "Keputusan berhasil disimpan.";
      state.selectedId = ""; state.detail = null;
      await loadQueue(state.search || "");
    } catch (error) { state.error = error.message || "Keputusan verifikasi tidak dapat disimpan."; }
    finally { state.busy = false; render(); }
  }

  const onInput = (event) => {
    if (event.target.matches("[data-revision-note]")) state.revisionNotes[event.target.dataset.revisionNote] = event.target.value;
    if (event.target.id === "verification-decision-note") state.decisionNote = event.target.value;
  };
  const onClick = async (event) => {
    const button = event.target.closest("[data-verification-action]");
    if (!button) return;
    const action = button.dataset.verificationAction;
    if (action === "open") await loadDetail(button.dataset.registrationId);
    if (action === "refresh") await loadQueue(state.search || "");
    if (action === "search") await loadQueue(container.querySelector("#verification-search")?.value || "");
    if (action === "doc-verified") await reviewDocument(button.dataset.documentId, "VERIFIED");
    if (action === "doc-revision") await reviewDocument(button.dataset.documentId, "REVISION");
    if (action === "approve") await decide("VERIFIED");
    if (action === "return") await decide("REVISION");
  };
  container.addEventListener("input", onInput);
  container.addEventListener("click", onClick);
  render();
  loadQueue();
  return () => { container.removeEventListener("input", onInput); container.removeEventListener("click", onClick); };
}

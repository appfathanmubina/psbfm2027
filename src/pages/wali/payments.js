import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const statusLabels = { UNPAID:"Belum dibayar", PAYMENT_REVIEW:"Menunggu verifikasi", PAID:"Lunas", REJECTED:"Perlu unggah ulang", SUBMITTED:"Menunggu verifikasi", VERIFIED:"Terverifikasi" };

function formatMoney(value) {
  return new Intl.NumberFormat("id-ID", { style:"currency", currency:"IDR", maximumFractionDigits:0 }).format(Number(value || 0));
}
function safeDriveUrl(value) {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" && url.hostname === "drive.google.com" ? url.href : ""; }
  catch { return ""; }
}
function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Bukti pembayaran tidak dapat dibaca."));
    reader.readAsDataURL(file);
  });
}
function toJpegBlob(canvas, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
async function compressProof(file) {
  if (file.type !== "image/jpeg" || file.size <= MAX_FILE_BYTES || typeof createImageBitmap !== "function") return file;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    let scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha:false });
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await toJpegBlob(canvas, Math.max(0.5, 0.84 - attempt * 0.06));
      if (!blob) break;
      if (blob.size <= MAX_FILE_BYTES) return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type:"image/jpeg", lastModified:Date.now() });
      scale *= 0.82;
    }
    return file;
  } finally { bitmap.close?.(); }
}

export function mountPaymentsPage(container, { token, onDashboard, onRegistration, staff = false }) {
  const state = { registrations:[], data:null, selectedId:"", uploadingId:"", reviewingId:"", notes:{}, loading:true, error:"", notice:"" };

  function render() {
    const selected = state.registrations.find((item) => String(item.registrationId) === String(state.selectedId));
    const data = state.data || {};
    const bills = Array.isArray(data.bills) ? data.bills : [];
    const selector = state.registrations.length > 1 ? `<div class="field"><label for="payment-registration">Pilih ${staff ? "pendaftar" : "calon santri"}</label><select id="payment-registration">${state.registrations.map((item) => `<option value="${esc(item.registrationId)}" ${String(item.registrationId) === String(state.selectedId) ? "selected" : ""}>${esc(item.candidateName || "Calon Santri")} · ${esc(item.registrationNumber || "-")}</option>`).join("")}</select></div>` : selected ? `<div class="document-registration-note">${esc(selected.candidateName || "Calon Santri")} · ${esc(selected.registrationNumber || "-")}</div>` : "";
    const cards = bills.map((bill) => {
      const status = String(bill.status || "UNPAID").toUpperCase();
      const payment = bill.payment || null;
      const paymentStatus = String(payment?.status || "").toUpperCase();
      const paid = status === "PAID" || paymentStatus === "VERIFIED";
      const waiting = status === "PAYMENT_REVIEW" || paymentStatus === "SUBMITTED";
      const cancelled = status === "CANCELLED";
      const needsUpload = !paid && !waiting && !cancelled;
      const displayStatus = paymentStatus === "REJECTED" ? "REJECTED" : (waiting ? "PAYMENT_REVIEW" : (paid ? "PAID" : status));
      const proofUrl = safeDriveUrl(payment?.proofFileUrl);
      const statusText = cancelled ? "Tagihan dibatalkan" : (statusLabels[displayStatus] || displayStatus.replaceAll("_", " "));
      const reviewable = staff && payment && ["SUBMITTED", "UNDER_REVIEW"].includes(paymentStatus);
      return `<article class="payment-card"><div class="payment-card-head"><div><span class="eyebrow">${esc(bill.paymentTypeName || "Tagihan")}</span><h2>${esc(formatMoney(bill.amount))}</h2><p>${bill.dueDate ? `Jatuh tempo ${esc(bill.dueDate)}` : "Batas pembayaran mengikuti informasi Panitia."}</p></div><span class="status-badge ${paid ? "verified" : waiting ? "attention" : displayStatus === "REJECTED" ? "attention" : ""}">${esc(statusText)}</span></div>
        ${payment ? `<div class="document-file"><span>${staff ? `Pembayaran ${esc(payment.paymentId || "")}` : "Bukti pembayaran tersimpan"}</span>${proofUrl ? `<a href="${esc(proofUrl)}" target="_blank" rel="noopener noreferrer">Lihat bukti</a>` : ""}</div>${payment.verificationNote ? `<div class="document-revision"><b>Catatan verifikasi</b><p>${esc(payment.verificationNote)}</p></div>` : ""}` : ""}
        ${reviewable ? `<div class="document-upload"><div class="field"><label for="payment-note-${esc(payment.paymentId)}">Catatan jika bukti ditolak</label><textarea id="payment-note-${esc(payment.paymentId)}" rows="2" maxlength="500" data-payment-note="${esc(payment.paymentId)}" placeholder="Jelaskan alasan penolakan">${esc(state.notes[payment.paymentId] || "")}</textarea></div><div class="hero-actions"><button class="btn btn-primary" type="button" data-payment-action="verify" data-payment-id="${esc(payment.paymentId)}" ${state.reviewingId ? "disabled" : ""}>${state.reviewingId === String(payment.paymentId) ? "Menyimpan…" : "Tandai lunas"}</button><button class="btn btn-outline" type="button" data-payment-action="reject" data-payment-id="${esc(payment.paymentId)}" ${state.reviewingId ? "disabled" : ""}>Tolak bukti</button></div></div>` : ""}
        ${!staff && needsUpload ? `<div class="document-upload"><div class="field"><label for="payment-proof-${esc(bill.billId)}">Bukti pembayaran (JPG, PNG, WEBP, PDF · maks. 5 MB)</label><input id="payment-proof-${esc(bill.billId)}" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" data-payment-file="${esc(bill.billId)}"></div><button class="btn btn-outline" type="button" data-payment-action="upload" data-bill-id="${esc(bill.billId)}" ${state.uploadingId ? "disabled" : ""}>${state.uploadingId === String(bill.billId) ? "Mengunggah…" : payment ? "Kirim Ulang Bukti" : "Unggah Bukti"}</button></div>` : ""}
      </article>`;
    }).join("");
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">${staff ? "Area Keuangan" : "Portal Wali Santri"}</span><h1 class="page-title">${staff ? "Verifikasi Pembayaran" : "Pembayaran"}</h1><p class="page-subtitle">${staff ? "Periksa bukti yang dikirim dan catat keputusan verifikasi." : "Lihat tagihan dan kirim bukti pembayaran untuk diverifikasi."}</p></div><button class="btn btn-outline" type="button" data-payment-action="dashboard">Dashboard</button></div>
      ${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}
      ${selector}
      ${state.loading ? `<section class="dashboard-section" role="status">Memuat pembayaran…</section>` : !state.registrations.length ? `<section class="dashboard-section"><h2>Belum ada pendaftaran</h2><p class="field-hint">Tagihan tersedia setelah pendaftaran calon santri dibuat dan diverifikasi.</p><button class="btn btn-primary" type="button" data-payment-action="registration">Buka Pendaftaran</button></section>` : !state.data ? `<section class="dashboard-section"><h2>Data pembayaran tidak tersedia</h2><button class="btn btn-outline" type="button" data-payment-action="refresh">Coba lagi</button></section>` : bills.length ? `<div class="payment-list">${cards}</div>` : `<section class="dashboard-section"><h2>Belum ada tagihan</h2><p class="field-hint">Tagihan akan muncul setelah Panitia menerbitkannya.</p></section>`}
      ${state.registrations.length && !state.loading ? `<button class="btn btn-ghost" type="button" data-payment-action="refresh">Muat ulang</button>` : ""}`;
  }

  async function load(registrationId = state.selectedId) {
    state.loading = true;
    state.error = "";
    state.selectedId = String(registrationId || state.selectedId || "");
    state.data = null;
    render();
    try {
      if (staff && !state.selectedId) {
        try {
          const dashboard = await apiCall("getDashboardPageData", token);
          state.selectedId = String(dashboard?.operational?.payments?.items?.[0]?.registrationId || "");
        } catch { /* Fall back to the first registration returned by the payment endpoint. */ }
      }
      const result = await apiCall("getPaymentPageData", token, state.selectedId);
      if (!result?.success) throw new Error(result?.message || "Data pembayaran tidak dapat dimuat.");
      state.registrations = Array.isArray(result.registrations) ? result.registrations : [];
      state.data = result.paymentData || null;
      state.selectedId = String(state.data?.registrationId || state.registrations[0]?.registrationId || "");
      state.notes = {};
    } catch (error) {
      state.error = error.message || "Terjadi kendala saat memuat pembayaran.";
    } finally {
      state.loading = false;
      render();
    }
  }

  async function review(paymentId, status) {
    const note = String(state.notes[paymentId] || "").trim();
    if (status === "REJECTED" && !note) { state.error = "Isi alasan penolakan sebelum menolak bukti pembayaran."; render(); return; }
    state.reviewingId = String(paymentId); state.error = ""; state.notice = ""; render();
    try {
      const result = await apiCall("verifyPayment", token, { paymentId, status, note });
      if (!result?.success) throw new Error(result?.message || "Verifikasi pembayaran tidak dapat disimpan.");
      state.notice = result.message || "Verifikasi pembayaran berhasil disimpan.";
      await load(state.selectedId);
    } catch (error) { state.error = error.message || "Verifikasi pembayaran tidak dapat disimpan."; }
    finally { state.reviewingId = ""; render(); }
  }

  async function upload(billId) {
    const input = container.querySelector(`[data-payment-file="${CSS.escape(String(billId))}"]`);
    const original = input?.files?.[0];
    if (!original) { state.error = "Pilih bukti pembayaran terlebih dahulu."; render(); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(original.type.toLowerCase())) { state.error = "Bukti harus berupa JPG, PNG, WEBP, atau PDF."; render(); return; }
    state.error = "";
    state.notice = "";
    state.uploadingId = String(billId);
    render();
    try {
      const file = await compressProof(original);
      if (file.size > MAX_FILE_BYTES) throw new Error("Ukuran bukti pembayaran maksimal 5 MB. Pilih file yang lebih kecil.");
      const base64 = await readAsBase64(file);
      const result = await apiCall("submitPayment", token, { billId:String(billId), fileName:file.name, mimeType:file.type, fileSize:file.size, base64 });
      if (!result?.success) throw new Error(result?.message || "Bukti pembayaran tidak dapat dikirim.");
      state.notice = original.size !== file.size ? `Bukti berhasil dikirim setelah kompresi (${(original.size / 1024 / 1024).toFixed(1)} MB menjadi ${(file.size / 1024 / 1024).toFixed(1)} MB).` : (result.message || "Bukti pembayaran berhasil dikirim.");
      await load(state.selectedId);
    } catch (error) {
      state.error = error.message || "Bukti pembayaran tidak dapat dikirim.";
    } finally {
      state.uploadingId = "";
      render();
    }
  }

  const onClick = async (event) => {
    const button = event.target.closest("[data-payment-action]");
    if (!button) return;
    const action = button.dataset.paymentAction;
    if (action === "dashboard") onDashboard?.();
    if (action === "registration") onRegistration?.();
    if (action === "refresh") await load(state.selectedId);
    if (action === "upload") await upload(button.dataset.billId);
    if (action === "verify") await review(button.dataset.paymentId, "VERIFIED");
    if (action === "reject") await review(button.dataset.paymentId, "REJECTED");
  };
  const onChange = async (event) => { if (event.target.id === "payment-registration") await load(event.target.value); };
  const onInput = (event) => { if (event.target.matches("[data-payment-note]")) state.notes[event.target.dataset.paymentNote] = event.target.value; };
  container.addEventListener("click", onClick);
  container.addEventListener("change", onChange);
  container.addEventListener("input", onInput);
  render();
  load();
  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("change", onChange);
    container.removeEventListener("input", onInput);
  };
}

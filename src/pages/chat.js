import { apiCall } from "../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const dateLabel = (value) => { const date = new Date(value || ""); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(date); };

export function mountChatPage(container, { token, userId, onDashboard }) {
  const state = { threads:[], registrations:[], selectedId:"", detail:null, admin:false, userId:String(userId || ""), loading:true, sending:false, error:"", notice:"" };
  let pollTimer = 0;
  function render() {
    const selected = state.detail?.thread || state.threads.find((item) => String(item.threadId) === state.selectedId) || null;
    const threadCards = state.threads.length ? state.threads.map((item) => `<button class="verification-queue-item ${String(item.threadId) === state.selectedId ? "selected" : ""}" type="button" data-chat-action="select" data-id="${esc(item.threadId)}"><b>${esc(state.admin ? item.candidateName || item.waliName || "Wali Santri" : item.subject || "Pesan PSB")}</b><small>${esc(item.registrationNumber || "Pendaftaran")} · ${esc(dateLabel(item.lastMessageAt || item.updatedAt))}</small>${Number(item.unreadCount || 0) ? `<span class="status-badge attention">${Number(item.unreadCount)} belum dibaca</span>` : ""}</button>`).join("") : `<p class="field-hint">Belum ada percakapan.</p>`;
    const messages = Array.isArray(state.detail?.messages) ? state.detail.messages : [];
    const messagesHtml = messages.map((item) => `<article class="chat-message ${String(item.senderUserId) === String(state.detail?.actorUserId || "") ? "chat-message-own" : ""}"><div class="chat-message-meta">${esc(item.senderRole === "WALI" ? state.detail?.thread?.waliName || "Wali Santri" : "Panitia PSB")} · ${esc(dateLabel(item.createdAt))}</div><p>${esc(item.message || "")}</p>${item.attachmentName ? `<small>Lampiran: ${esc(item.attachmentName)}</small>` : ""}</article>`).join("");
    const registrationOptions = state.registrations.map((item) => `<option value="${esc(item.registrationId)}">${esc(item.candidateName || "Calon Santri")} · ${esc(item.registrationNumber || "Pendaftaran")}${item.hasOpenThread ? " · Percakapan aktif" : ""}</option>`).join("");
    const selectedOpen = String(selected?.status || "").toUpperCase() === "OPEN";
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">${state.admin ? "Area Panitia" : "Portal Wali Santri"}</span><h1 class="page-title">${state.admin ? "Pesan Wali Santri" : "Pesan dengan Panitia"}</h1><p class="page-subtitle">Percakapan terkait pendaftaran Anda. Pesan teks saja.</p></div><button class="btn btn-outline" type="button" data-chat-action="dashboard">Dashboard</button></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}<div class="verification-layout chat-layout"><section class="verification-queue"><div class="dashboard-section-head"><b>Percakapan</b><button class="btn btn-outline" type="button" data-chat-action="refresh">Muat ulang</button></div>${state.admin ? "" : `<form id="chat-open-form"><div class="field"><label for="chat-registration">Pendaftaran</label><select id="chat-registration" name="registrationId" required><option value="">Pilih calon santri</option>${registrationOptions}</select></div><button class="btn btn-outline" type="submit">Buka pesan</button></form>`}${state.loading ? `<div class="dashboard-section" role="status">Memuat percakapan…</div>` : threadCards}</section><section class="verification-detail"><div class="dashboard-section"><div class="dashboard-section-head"><b>${esc(selected ? (state.admin ? selected.candidateName || "Percakapan" : selected.subject || "Percakapan") : "Pilih percakapan")}</b><span>${esc(selected?.status || "")}</span></div>${selected ? `<p class="field-hint">${esc(selected.registrationNumber || "")} ${selected.waliName ? `· Wali ${esc(selected.waliName)}` : ""}</p><div class="chat-message-list">${messagesHtml || `<p class="field-hint">Belum ada pesan. Silakan tulis pesan pertama Anda.</p>`}</div>${selectedOpen ? `<form id="chat-send-form"><div class="field"><label for="chat-message">Pesan</label><textarea id="chat-message" name="message" maxlength="${Number(state.detail?.maxMessageLength || 1000)}" rows="3" required placeholder="Tulis pesan…"></textarea></div><button class="btn btn-primary" type="submit" ${state.sending ? "disabled" : ""}>${state.sending ? "Mengirim…" : "Kirim pesan"}</button></form>` : `<p class="field-hint">Percakapan ini telah ditutup.</p>`}${state.admin && selectedOpen ? `<button class="btn btn-outline" type="button" data-chat-action="close" data-id="${esc(selected.threadId)}">Tutup percakapan</button>` : ""}` : `<p class="field-hint">Pilih percakapan untuk membaca pesan.</p>`}</div></section></div>`;
  }
  async function loadList() {
    try {
      const result = await apiCall("getChatPageData", token);
      if (!result?.success) throw new Error(result?.message || "Daftar percakapan tidak dapat dimuat.");
      state.threads = Array.isArray(result.threads) ? result.threads : [];
      state.registrations = Array.isArray(result.registrations) ? result.registrations : [];
      state.admin = ["SUPERADMIN","ADMIN_PSB"].some((role) => String(result.actorRole || "").toUpperCase().split(",").map((item) => item.trim()).includes(role));
      if (state.selectedId && !state.threads.some((item) => String(item.threadId) === state.selectedId)) { state.selectedId = ""; state.detail = null; }
      if (state.selectedId && state.detail) {
        const detail = await apiCall("getChatThread", token, state.selectedId);
        if (detail?.success) state.detail = Object.assign({}, detail, { actorUserId:state.userId });
      }
      state.error = "";
    } catch (error) { state.error = error.message || "Daftar percakapan tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  async function selectThread(id) {
    state.selectedId = String(id || ""); state.error = ""; state.notice = ""; render();
    try {
      const result = await apiCall("getChatThread", token, state.selectedId);
      if (!result?.success) throw new Error(result?.message || "Percakapan tidak dapat dibuka.");
      state.detail = Object.assign({}, result, { actorUserId:state.userId });
      await apiCall("markChatThreadRead", token, state.selectedId);
      await loadList();
      const fresh = await apiCall("getChatThread", token, state.selectedId);
      if (fresh?.success) state.detail = Object.assign({}, fresh, { actorUserId:state.userId });
      render();
    } catch (error) { state.error = error.message || "Percakapan tidak dapat dibuka."; render(); }
  }
  const onClick = async (event) => {
    const button = event.target.closest("[data-chat-action]"); if (!button) return;
    const action = button.dataset.chatAction;
    if (action === "dashboard") onDashboard?.();
    else if (action === "refresh") await loadList();
    else if (action === "select") await selectThread(button.dataset.id);
    else if (action === "close") {
      if (!window.confirm("Tutup percakapan ini? Wali dapat membuka percakapan baru kapan saja.")) return;
      try { const result = await apiCall("closeChatThread", token, button.dataset.id); if (!result?.success) throw new Error(result?.message || "Percakapan tidak dapat ditutup."); state.notice = result.message || "Percakapan ditutup."; state.detail = null; state.selectedId = ""; await loadList(); }
      catch (error) { state.error = error.message || "Percakapan tidak dapat ditutup."; render(); }
    }
  };
  const onSubmit = async (event) => {
    if (event.target.id === "chat-open-form") {
      event.preventDefault(); const id = String(new FormData(event.target).get("registrationId") || ""); if (!id) return;
      try { const result = await apiCall("openChatThread", token, id); if (!result?.success) throw new Error(result?.message || "Percakapan tidak dapat dibuka."); state.selectedId = String(result.thread?.threadId || ""); await loadList(); await selectThread(state.selectedId); }
      catch (error) { state.error = error.message || "Percakapan tidak dapat dibuka."; render(); }
    }
    if (event.target.id === "chat-send-form") {
      event.preventDefault(); const message = String(new FormData(event.target).get("message") || "").trim(); if (!message) return;
      state.sending = true; state.error = ""; render();
      try { const result = await apiCall("sendChatMessage", token, state.selectedId, message); if (!result?.success) throw new Error(result?.message || "Pesan tidak dapat dikirim."); state.notice = result.message || "Pesan terkirim."; const sent = result.chatMessage; if (sent && state.detail) state.detail.messages = [...(state.detail.messages || []), sent]; await loadList(); const current = await apiCall("getChatThread", token, state.selectedId); if (current?.success) state.detail = Object.assign({}, current, { actorUserId:state.userId }); }
      catch (error) { state.error = error.message || "Pesan tidak dapat dikirim."; }
      finally { state.sending = false; render(); }
    }
  };
  container.addEventListener("click", onClick); container.addEventListener("submit", onSubmit); render(); loadList();
  pollTimer = window.setInterval(() => { if (!document.hidden) loadList(); }, 30000);
  return () => { window.clearInterval(pollTimer); container.removeEventListener("click", onClick); container.removeEventListener("submit", onSubmit); };
}

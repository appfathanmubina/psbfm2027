import { apiCall } from "../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const roles = [["WALI","Wali Santri"],["SUPERADMIN","Superadmin"],["ADMIN_PSB","Admin PSB"],["VERIFIKATOR","Verifikator"],["SELEKSI","Tim Seleksi"],["KEUANGAN","Keuangan"]];
const dateLabel = (value) => { const date = new Date(value || ""); return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("id-ID", { dateStyle:"medium", timeStyle:"short" }).format(date); };

export function mountCommunicationsPage(container, { token, canBroadcast = false, onDashboard }) {
  const state = { items:[], center:null, selected:new Set(), loading:true, sending:false, error:"", notice:"" };
  function render() {
    const notifications = state.items.length ? state.items.map((item) => `<article class="program-card notification-card ${String(item.isRead).toUpperCase() === "TRUE" ? "" : "notification-unread"}"><div class="program-card-copy"><span class="eyebrow">${esc(dateLabel(item.createdAt))}${String(item.isRead).toUpperCase() === "TRUE" ? " · Sudah dibaca" : " · Belum dibaca"}</span><h2>${esc(item.title || "Informasi")}</h2><p>${esc(item.message || "")}</p></div>${String(item.isRead).toUpperCase() === "TRUE" ? "" : `<button class="btn btn-outline" type="button" data-communication-action="read" data-id="${esc(item.notificationId)}">Tandai dibaca</button>`}</article>`).join("") : `<section class="dashboard-section"><h2>Belum ada notifikasi</h2><p class="field-hint">Informasi penting dari PSB akan tampil di sini.</p></section>`;
    const rolesHtml = roles.map(([key,label]) => `<label class="checkline"><input type="checkbox" name="recipientRole" value="${key}" ${state.selected.has(key) ? "checked" : ""}> ${label}${state.center ? ` (${Number(state.center.roleCounts?.[key] || 0)})` : ""}</label>`).join("");
    const broadcast = canBroadcast ? `<section class="dashboard-section"><div class="dashboard-section-head"><b>Kirim pengumuman internal</b><span>${Number(state.center?.activeUsers || 0)} akun aktif</span></div><p class="field-hint">Pengumuman dikirim sebagai notifikasi dalam aplikasi kepada peran yang dipilih.</p><form id="communication-form"><div class="field"><label for="communication-title">Judul</label><input id="communication-title" name="title" maxlength="120" required></div><div class="field"><label for="communication-message">Pesan</label><textarea id="communication-message" name="message" maxlength="1000" rows="4" required></textarea></div><fieldset class="field recipient-field"><legend>Penerima</legend><div class="recipient-role-grid">${rolesHtml}</div></fieldset><div class="field"><label for="communication-type">Jenis notifikasi</label><select id="communication-type" name="type"><option value="INFO">Informasi</option><option value="SUCCESS">Berhasil</option><option value="WARNING">Perhatian</option><option value="ERROR">Penting</option></select></div><button class="btn btn-primary" type="submit" ${state.sending ? "disabled" : ""}>${state.sending ? "Mengirim…" : "Kirim notifikasi"}</button></form></section><section class="dashboard-section"><div class="dashboard-section-head"><b>Otomasi notifikasi</b><span>Aktif di backend</span></div><div class="program-list">${(state.center?.automation || []).map((item) => `<div class="dashboard-task-item"><div class="dashboard-task-copy"><b>${esc(item.event)}</b><div class="dashboard-task-meta">Penerima: ${esc(item.target)}</div></div></div>`).join("")}</div></section>` : "";
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">${canBroadcast ? "Area Panitia" : "Portal PSB"}</span><h1 class="page-title">${canBroadcast ? "Komunikasi & Notifikasi" : "Notifikasi"}</h1><p class="page-subtitle">Lihat pembaruan dan informasi terkait proses penerimaan santri.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-communication-action="refresh">Muat ulang</button><button class="btn btn-outline" type="button" data-communication-action="dashboard">Dashboard</button></div></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}${broadcast}<section class="program-section"><div class="dashboard-section-head"><b>Notifikasi saya</b><span>${state.items.filter((item) => String(item.isRead).toUpperCase() !== "TRUE").length} belum dibaca</span></div>${state.items.some((item) => String(item.isRead).toUpperCase() !== "TRUE") ? `<button class="btn btn-outline" type="button" data-communication-action="read-all">Tandai semua dibaca</button>` : ""}<div class="program-list">${state.loading ? `<section class="dashboard-section" role="status">Memuat notifikasi…</section>` : notifications}</div></section>`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try {
      const requests = [apiCall("getNotifications", token)];
      if (canBroadcast) requests.push(apiCall("getCommunicationCenterData", token));
      const [notifications, center] = await Promise.all(requests);
      if (!notifications?.success) throw new Error(notifications?.message || "Notifikasi tidak dapat dimuat.");
      state.items = Array.isArray(notifications.items) ? notifications.items : [];
      state.center = canBroadcast ? center : null;
      if (canBroadcast && !center?.success) throw new Error(center?.message || "Ringkasan komunikasi tidak dapat dimuat.");
    } catch (error) { state.error = error.message || "Data komunikasi tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  async function act(action, id) {
    try {
      const result = action === "read-all" ? await apiCall("markAllNotificationsRead", token) : await apiCall("markNotificationRead", token, id);
      if (!result?.success) throw new Error(result?.message || "Status notifikasi tidak dapat diperbarui.");
      state.notice = "Notifikasi diperbarui."; await load();
    } catch (error) { state.error = error.message || "Status notifikasi tidak dapat diperbarui."; render(); }
  }
  const onClick = async (event) => {
    const button = event.target.closest("[data-communication-action]"); if (!button) return;
    const action = button.dataset.communicationAction;
    if (action === "dashboard") onDashboard?.();
    else if (action === "refresh") await load();
    else if (["read", "read-all"].includes(action)) await act(action, button.dataset.id);
  };
  const onChange = (event) => { if (event.target.name === "recipientRole") { event.target.checked ? state.selected.add(event.target.value) : state.selected.delete(event.target.value); } };
  const onSubmit = async (event) => {
    if (event.target.id !== "communication-form") return;
    event.preventDefault();
    if (!state.selected.size) { state.error = "Pilih setidaknya satu peran penerima."; render(); return; }
    const form = new FormData(event.target), payload = { title:String(form.get("title") || "").trim(), message:String(form.get("message") || "").trim(), type:String(form.get("type") || "INFO"), roles:[...state.selected] };
    if (!window.confirm(`Kirim notifikasi “${payload.title}” kepada ${payload.roles.map((role) => roles.find(([key]) => key === role)?.[1] || role).join(", ")}?`)) return;
    state.sending = true; state.error = ""; state.notice = ""; render();
    try { const result = await apiCall("sendCommunication", token, payload); if (!result?.success) throw new Error(result?.message || "Notifikasi gagal dikirim."); state.notice = result.message || "Notifikasi berhasil dikirim."; event.target.reset(); state.selected.clear(); await load(); }
    catch (error) { state.error = error.message || "Notifikasi gagal dikirim."; }
    finally { state.sending = false; render(); }
  };
  container.addEventListener("click", onClick);
  container.addEventListener("change", onChange);
  container.addEventListener("submit", onSubmit);
  render(); load();
  return () => {
    container.removeEventListener("click", onClick);
    container.removeEventListener("change", onChange);
    container.removeEventListener("submit", onSubmit);
  };
}

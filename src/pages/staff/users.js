import { apiCall } from "../../api.js";

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const roleLabels = { SUPERADMIN:"Superadmin", ADMIN_PSB:"Admin PSB", VERIFIKATOR:"Verifikator", SELEKSI:"Tim Seleksi", KEUANGAN:"Keuangan", WALI:"Wali Santri" };
const dateLabel = (value) => { const date = new Date(value || ""); return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("id-ID", { dateStyle:"medium" }).format(date); };

export function mountUsersPage(container, { token, onDashboard }) {
  const state = { users:[], roles:[], selected:null, loading:true, busy:false, error:"", notice:"" };
  function render() {
    const cards = state.users.length ? state.users.map((user) => `<article class="master-item-card"><div class="dashboard-section-head"><div><span class="eyebrow">${esc(user.status || "ACTIVE")}${user.mustChangePassword ? " · Ganti password saat masuk" : ""}</span><h2>${esc(user.name || "Pengguna")}</h2></div><span class="field-hint">${esc(dateLabel(user.createdAt))}</span></div><div class="master-item-details"><span>ID: <b>${esc(user.userId)}</b></span><span>HP: <b>${esc(user.phone || "-")}</b></span><span>Email: <b>${esc(user.email || "-")}</b></span><span>Peran: <b>${esc(String(user.role || "").split(",").map((role) => roleLabels[role.trim()] || role.trim()).join(", "))}</b></span></div><button class="btn btn-outline" type="button" data-user-action="select" data-id="${esc(user.userId)}">Reset password</button></article>`).join("") : `<section class="dashboard-section"><h2>Belum ada pengguna</h2></section>`;
    const roleInputs = state.roles.filter((role) => role !== "WALI").map((role) => `<label class="checkline"><input type="checkbox" name="roles" value="${esc(role)}"> ${esc(roleLabels[role] || role)}</label>`).join("");
    const resetForm = state.selected ? `<section class="dashboard-section"><div class="dashboard-section-head"><b>Reset password</b><span>${esc(state.selected.name)} · ${esc(state.selected.userId)}</span></div><p class="field-hint">Semua sesi pengguna akan dicabut dan pengguna wajib mengganti password baru saat masuk.</p><form id="admin-reset-password-form"><div class="field"><label for="reset-password">Password sementara</label><input id="reset-password" name="newPassword" type="password" minlength="6" autocomplete="new-password" required></div><div class="field"><label for="reset-confirm-password">Ulangi password sementara</label><input id="reset-confirm-password" name="confirmPassword" type="password" minlength="6" autocomplete="new-password" required></div><div class="form-row"><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>${state.busy ? "Memproses…" : "Reset password"}</button><button class="btn btn-outline" type="button" data-user-action="cancel">Batal</button></div></form></section>` : "";
    container.innerHTML = `<div class="registration-head"><div><span class="eyebrow">Superadmin</span><h1 class="page-title">Pengguna &amp; Akses</h1><p class="page-subtitle">Buat akun staf dan reset password melalui backend berotorisasi.</p></div><div class="form-row"><button class="btn btn-outline" type="button" data-user-action="refresh">Muat ulang</button><button class="btn btn-outline" type="button" data-user-action="dashboard">Dashboard</button></div></div>${state.error ? `<div class="form-error show" role="alert">${esc(state.error)}</div>` : ""}${state.notice ? `<div class="form-success" role="status">${esc(state.notice)}</div>` : ""}${state.loading ? `<section class="dashboard-section" role="status">Memuat pengguna…</section>` : `<div class="master-data-layout"><section class="master-data-list"><div class="dashboard-section-head"><b>Daftar pengguna</b><span>${state.users.length} akun</span></div>${cards}</section><section class="master-data-form"><div class="dashboard-section"><div class="dashboard-section-head"><b>Buat akun pengguna</b><span>Akun staf</span></div><p class="field-hint">Pengguna wajib mengganti password yang diberikan pada login pertama.</p><form id="admin-create-user-form"><div class="field"><label for="new-user-name">Nama lengkap</label><input id="new-user-name" name="name" maxlength="120" required></div><div class="field"><label for="new-user-phone">Nomor HP (opsional)</label><input id="new-user-phone" name="phone" type="tel" autocomplete="tel"></div><div class="field"><label for="new-user-email">Email (opsional)</label><input id="new-user-email" name="email" type="email" autocomplete="email"></div><fieldset class="field recipient-field"><legend>Peran</legend><div class="recipient-role-grid">${roleInputs}</div></fieldset><div class="field"><label for="new-user-status">Status akun</label><select id="new-user-status" name="status"><option value="ACTIVE">Aktif</option><option value="INACTIVE">Tidak aktif</option></select></div><div class="field"><label for="new-user-password">Password sementara</label><input id="new-user-password" name="password" type="password" minlength="6" autocomplete="new-password" required></div><div class="field"><label for="new-user-confirm">Ulangi password sementara</label><input id="new-user-confirm" name="confirmPassword" type="password" minlength="6" autocomplete="new-password" required></div><button class="btn btn-primary" type="submit" ${state.busy ? "disabled" : ""}>Buat akun</button></form></div>${resetForm}</section></div>`}`;
  }
  async function load() {
    state.loading = true; state.error = ""; render();
    try { const result = await apiCall("getUserManagementData", token); if (!result?.success) throw new Error(result?.message || "Daftar pengguna tidak dapat dimuat."); state.users = Array.isArray(result.users) ? result.users : []; state.roles = Array.isArray(result.roles) ? result.roles : []; if (state.selected) state.selected = state.users.find((user) => String(user.userId) === String(state.selected.userId)) || null; }
    catch (error) { state.error = error.message || "Daftar pengguna tidak dapat dimuat."; }
    finally { state.loading = false; render(); }
  }
  const onClick = (event) => {
    const button = event.target.closest("[data-user-action]"); if (!button) return;
    if (button.dataset.userAction === "dashboard") onDashboard?.();
    else if (button.dataset.userAction === "refresh") load();
    else if (button.dataset.userAction === "cancel") { state.selected = null; state.error = ""; render(); }
    else if (button.dataset.userAction === "select") { state.selected = state.users.find((user) => String(user.userId) === String(button.dataset.id)) || null; state.error = ""; state.notice = ""; render(); }
  };
  const onSubmit = async (event) => {
    if (!["admin-create-user-form", "admin-reset-password-form"].includes(event.target.id)) return;
    event.preventDefault(); const form = new FormData(event.target); let result;
    if (event.target.id === "admin-create-user-form") {
      const roles = form.getAll("roles").map(String);
      if (!roles.length) { state.error = "Pilih sekurangnya satu peran."; render(); return; }
      const payload = { name:String(form.get("name") || "").trim(), phone:String(form.get("phone") || "").trim(), email:String(form.get("email") || "").trim(), roles, status:String(form.get("status") || "ACTIVE"), password:String(form.get("password") || ""), confirmPassword:String(form.get("confirmPassword") || "") };
      if (!payload.phone && !payload.email) { state.error = "Isi nomor HP atau email."; render(); return; }
      if (!window.confirm(`Buat akun ${payload.name} dengan peran ${roles.map((role) => roleLabels[role] || role).join(", ")}?`)) return;
      state.busy = true; state.error = ""; state.notice = ""; render();
      try { result = await apiCall("createManualUser", token, payload); if (!result?.success) throw new Error(result?.message || "Akun tidak dapat dibuat."); state.notice = result.message || "Akun dibuat."; await load(); }
      catch (error) { state.error = error.message || "Akun tidak dapat dibuat."; }
      finally { state.busy = false; render(); }
    } else {
      if (!state.selected) return;
      const payload = { userId:state.selected.userId, newPassword:String(form.get("newPassword") || ""), confirmPassword:String(form.get("confirmPassword") || "") };
      if (!window.confirm(`Reset password untuk ${state.selected.name}? Sesi aktif akan dicabut.`)) return;
      state.busy = true; state.error = ""; state.notice = ""; render();
      try { result = await apiCall("adminResetUserPassword", token, payload); if (!result?.success) throw new Error(result?.message || "Password tidak dapat direset."); state.notice = result.message || "Password direset."; state.selected = null; await load(); }
      catch (error) { state.error = error.message || "Password tidak dapat direset."; }
      finally { state.busy = false; render(); }
    }
  };
  container.addEventListener("click", onClick); container.addEventListener("submit", onSubmit); render(); load();
  return () => { container.removeEventListener("click", onClick); container.removeEventListener("submit", onSubmit); };
}

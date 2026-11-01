import { apiCall, getConfiguredBridgeUrl, saveBridgeUrl, testBackendConnection } from "./api.js";
import { readSession, saveSession, updateSessionUser, clearSession } from "./session.js";
import { normalizeWebAppUrl } from "./bridge-client.js";
import { mountRegistrationPage } from "./pages/wali/registration.js";
import { mountProfilePage } from "./pages/wali/profile.js";
import { mountDocumentsPage } from "./pages/wali/documents.js";
import { mountPaymentsPage } from "./pages/wali/payments.js";
import { mountSelectionPage } from "./pages/wali/selection.js";
import { mountVerificationPage } from "./pages/staff/verification.js";
import { mountReregistrationPage } from "./pages/wali/reregistration.js";
import { mountSelectionManagementPage } from "./pages/staff/selection-management.js";
import { mountReregistrationManagementPage } from "./pages/staff/reregistration-management.js";
import { mountCommunicationsPage } from "./pages/communications.js";
import { mountIncidentPage } from "./pages/staff/incidents.js";
import { mountChatPage } from "./pages/chat.js";
import { mountMasterDataPage } from "./pages/staff/master-data.js";
import { mountUsersPage } from "./pages/staff/users.js";
import { mountReportingPage } from "./pages/staff/reporting.js";
import { mountMonitoringPage } from "./pages/staff/monitoring.js";

const root = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
// PSB 2027–2028 has not opened yet. Keep account creation closed until an approved opening.
const REGISTRATION_OPEN = false;
const state = {
  route: "home",
  user: null,
  token: "",
  remembered: false,
  publicConfig: {},
  busy: false,
  backendStatus: "unknown",
  dashboard: null,
  dashboardLoading: false,
  dashboardError: "",
  pageCleanup: null,
  deferredInstall: null,
  publicGalleryItems: [],
  publicGalleryIndex: 0,
  publicGalleryTimer: null,
  publicVideoIndex: 0
};

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const roleName = (role) => ({ WALI:"Wali Santri", SUPERADMIN:"Superadmin", ADMIN_PSB:"Admin PSB", VERIFIKATOR:"Verifikator", SELEKSI:"Tim Seleksi", KEUANGAN:"Keuangan" }[String(role || "").toUpperCase()] || String(role || "Pengguna"));
const displayName = (user) => user?.name || user?.nama || user?.fullName || user?.email || user?.phone || "Pengguna";

function toast(message, type = "") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toastRegion.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
function setBusy(value) {
  state.busy = value;
  document.querySelectorAll("[data-busy]").forEach((el) => { el.disabled = value; });
}
function header(actions = "") {
  return `<header class="topbar">
    <a class="brand" href="#home" aria-label="PSB Fathan Mubina">
      <span class="brand-mark">FM</span>
      <span class="brand-copy"><strong>PSB Fathan Mubina</strong><span>Penerimaan Santri Baru</span></span>
    </a>
    <div class="top-actions"><button data-install class="btn btn-soft hidden" type="button">Pasang</button>${actions}<button class="icon-btn" type="button" data-action="settings" aria-label="Pengaturan koneksi" title="Pengaturan koneksi">⚙</button></div>
  </header>`;
}
function footer() {
  return `<footer class="footer">© ${new Date().getFullYear()} Pesantren Ciawi Bogor Fathan Mubina · PSB FM</footer>`;
}
function connectionStatus() {
  const label = state.backendStatus === "ok" ? "Backend terhubung" : state.backendStatus === "error" ? "Backend belum terhubung" : "Koneksi belum diuji";
  const dot = state.backendStatus === "ok" ? "ok" : state.backendStatus === "error" ? "bad" : "";
  return `<span class="connection-pill"><i class="dot ${dot}"></i>${label}</span>`;
}
function stopPublicGalleryTimer() {
  if (state.publicGalleryTimer) {
    clearInterval(state.publicGalleryTimer);
    state.publicGalleryTimer = null;
  }
}
function renderHome() {
  stopPublicGalleryTimer();
  state.publicGalleryItems = [];
  state.publicGalleryIndex = 0;
  state.publicVideoIndex = 0;
  root.innerHTML = `${header('<button class="btn btn-ghost" data-action="login">Masuk</button><button class="btn btn-primary" data-action="register">Daftar</button>')}
    <main class="main public-home">
      <section class="hero">
        <div>
          <span class="eyebrow">Pendaftaran Santri Baru · 2027–2028</span>
          <h1>Mulai perjalanan pendidikan bersama <em>Fathan Mubina.</em></h1>
          <p>Portal resmi Penerimaan Santri Baru Pesantren Ciawi Bogor Fathan Mubina. Langkah awal perjalanan menjadi santri berilmu, berakhlak, dan berprestasi.</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-action="register">Buat Akun Wali <span aria-hidden="true">→</span></button>
            <button class="btn btn-outline" data-action="login">Masuk ke Akun</button>
          </div>
          <div class="public-connection">${connectionStatus()}</div>
        </div>
        <aside class="hero-card">
          <div class="mini-label">Pesantren Ciawi Bogor</div>
          <h2>Membentuk generasi berilmu, berakhlak, dan berdaya.</h2>
          <p>Informasi pendaftaran santri baru untuk jenjang SMP dan SMA.</p>
          <div class="year">TAHUN AJARAN 2027–2028</div>
        </aside>
      </section>

      <section class="public-media-section" aria-label="Galeri kegiatan pesantren">
        <div class="public-media-heading"><div><span class="eyebrow">Dokumentasi</span><h2>Galeri Fathan Mubina</h2><p>Potret kegiatan dan kehidupan santri di pesantren.</p></div><span class="public-media-count" id="gallery-count">Memuat…</span></div>
        <div class="public-gallery-frame" id="public-gallery-frame">
          <div class="public-gallery-track" id="public-gallery-track"><div class="public-gallery-empty">Memuat foto kegiatan pesantren…</div></div>
          <div class="public-gallery-controls"><button type="button" data-gallery-step="-1" aria-label="Foto sebelumnya">‹</button><button type="button" data-gallery-step="1" aria-label="Foto berikutnya">›</button></div>
        </div>
        <div class="public-gallery-dots" id="public-gallery-dots"></div>
      </section>

      <section class="public-media-section" aria-label="Video Fathan Mubina">
        <div class="public-media-heading"><div><span class="eyebrow">Video</span><h2>Video Fathan Mubina</h2><p>Kenali lebih dekat lingkungan dan aktivitas pesantren.</p></div><span class="public-media-count" id="public-video-count">1 / 3</span></div>
        <div class="public-video-card" id="public-video-card"><div class="public-video-media" id="public-video-media"></div></div>
        <div class="public-video-controls"><button type="button" data-video-step="-1" aria-label="Video sebelumnya">‹</button><div class="public-video-dots" id="public-video-dots"></div><button type="button" data-video-step="1" aria-label="Video berikutnya">›</button></div>
      </section>

      <section class="public-social-section" aria-label="Media sosial Pesantren">
        <div class="public-social-heading"><h2>Ikuti Media Sosial Pesantren</h2><p>Dapatkan informasi dan dokumentasi terbaru Fathan Mubina.</p></div>
        <div class="public-social-list">
          <a class="public-social-link website" href="https://www.fathanmubina.com" target="_blank" rel="noopener noreferrer"><span class="public-social-icon">◎</span><span>Website</span></a>
          <a class="public-social-link youtube" href="https://www.youtube.com/@fathanmubinaibs0303" target="_blank" rel="noopener noreferrer"><span class="public-social-icon">▶</span><span>YouTube</span></a>
          <a class="public-social-link instagram" href="https://www.instagram.com/pesantrenfathanmubina" target="_blank" rel="noopener noreferrer"><span class="public-social-icon">◎</span><span>Instagram</span></a>
          <a class="public-social-link facebook" href="https://www.facebook.com/fathanmubina.todays" target="_blank" rel="noopener noreferrer"><span class="public-social-icon">f</span><span>Facebook</span></a>
          <a class="public-social-link tiktok" href="https://www.tiktok.com/@pesantrenfathanmubina" target="_blank" rel="noopener noreferrer"><span class="public-social-icon">♪</span><span>TikTok</span></a>
        </div>
      </section>

      <section class="section public-services">
        <div class="section-heading"><h2>Layanan Pendaftaran</h2><p>Seluruh tahapan utama dalam satu portal.</p></div>
        <div class="feature-grid">
          <article class="feature"><div class="feature-icon">01</div><h3>Registrasi Akun</h3><p>Buat akun Wali menggunakan nomor HP atau alamat email yang aktif.</p></article>
          <article class="feature"><div class="feature-icon">02</div><h3>Formulir & Dokumen</h3><p>Lengkapi data calon santri dan unggah dokumen persyaratan dengan mudah.</p></article>
          <article class="feature"><div class="feature-icon">03</div><h3>Pembayaran & Seleksi</h3><p>Pantau tagihan, verifikasi pembayaran, jadwal tes, dan pengumuman hasil seleksi.</p></article>
        </div>
      </section>
    </main>${footer()}`;
  renderPublicVideo(0);
  loadPublicGallery();
}
const PUBLIC_VIDEOS = [
  { id: "HDrWuSwkbak", title: "Video Fathan Mubina 1" },
  { id: "0G0xGqSSI5Y", title: "Video Fathan Mubina 2" },
  { id: "fA63UYz0Jlg", title: "Video Fathan Mubina 3" }
];
function renderPublicVideo(index = 0) {
  const card = document.querySelector("#public-video-card");
  const media = document.querySelector("#public-video-media");
  const dots = document.querySelector("#public-video-dots");
  const count = document.querySelector("#public-video-count");
  if (!card || !media || !dots || !count) return;
  const total = PUBLIC_VIDEOS.length;
  state.publicVideoIndex = ((Number(index) || 0) % total + total) % total;
  const video = PUBLIC_VIDEOS[state.publicVideoIndex];
  count.textContent = `${state.publicVideoIndex + 1} / ${total}`;
  media.innerHTML = `<img src="https://i.ytimg.com/vi/${video.id}/hqdefault.jpg" alt="${esc(video.title)}" loading="lazy" referrerpolicy="no-referrer"><button type="button" class="public-video-play" data-video-play aria-label="Putar ${esc(video.title)}">▶</button><div class="public-video-title">${esc(video.title)}</div>`;
  dots.innerHTML = PUBLIC_VIDEOS.map((item, i) => `<button type="button" class="public-video-dot${i === state.publicVideoIndex ? " active" : ""}" data-video-index="${i}" aria-label="Video ${i + 1}"></button>`).join("");
}
function playPublicVideo() {
  const media = document.querySelector("#public-video-media");
  const video = PUBLIC_VIDEOS[state.publicVideoIndex];
  if (!media || !video) return;
  media.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0" title="${esc(video.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
}
function renderPublicGallery(items) {
  stopPublicGalleryTimer();
  state.publicGalleryItems = Array.isArray(items) ? items.filter((item) => item && item.url) : [];
  state.publicGalleryIndex = 0;
  const track = document.querySelector("#public-gallery-track");
  const dots = document.querySelector("#public-gallery-dots");
  const count = document.querySelector("#gallery-count");
  if (!track || !dots || !count) return;
  if (!state.publicGalleryItems.length) {
    track.innerHTML = '<div class="public-gallery-empty">Foto galeri belum tersedia. Silakan periksa kembali koneksi backend.</div>';
    dots.innerHTML = "";
    count.textContent = "0 foto";
    return;
  }
  count.textContent = `${state.publicGalleryItems.length} foto`;
  track.innerHTML = state.publicGalleryItems.map((item, i) => `<div class="public-gallery-slide"><img src="${esc(item.url)}" alt="${esc(item.name || "Foto kegiatan Fathan Mubina")}" loading="${i === 0 ? "eager" : "lazy"}" referrerpolicy="no-referrer" onerror="this.style.opacity='0.25'"><div class="public-gallery-caption">${esc(item.name || "Kegiatan Fathan Mubina")}</div></div>`).join("");
  dots.innerHTML = state.publicGalleryItems.map((item, i) => `<button type="button" class="public-gallery-dot${i === 0 ? " active" : ""}" data-gallery-index="${i}" aria-label="Foto ${i + 1}"></button>`).join("");
  updatePublicGallery();
  if (state.publicGalleryItems.length > 1) state.publicGalleryTimer = setInterval(() => movePublicGallery(1), 5000);
}
function updatePublicGallery() {
  const track = document.querySelector("#public-gallery-track");
  const dots = document.querySelector("#public-gallery-dots");
  if (!track || !dots || !state.publicGalleryItems.length) return;
  track.style.transform = `translateX(-${state.publicGalleryIndex * 100}%)`;
  Array.from(dots.children).forEach((dot, i) => dot.classList.toggle("active", i === state.publicGalleryIndex));
}
function movePublicGallery(delta) {
  const total = state.publicGalleryItems.length;
  if (!total) return;
  state.publicGalleryIndex = (state.publicGalleryIndex + delta + total) % total;
  updatePublicGallery();
}
async function loadPublicGallery() {
  const track = document.querySelector("#public-gallery-track");
  if (!track) return;
  try {
    const result = await apiCall("getPublicGallery", false);
    if (result?.success) renderPublicGallery(result.items || []);
    else renderPublicGallery([]);
  } catch (error) {
    renderPublicGallery([]);
  }
}
function renderLogin(error = "") {
  root.innerHTML = `${header('<button class="btn btn-ghost" data-action="register">Buat Akun</button>')}
    <main class="auth-wrap"><section class="auth-card">
      <span class="eyebrow">Portal Wali Santri</span>
      <h1>Selamat datang</h1><p class="lead">Masuk menggunakan nomor HP atau email yang terdaftar.</p>
      <form id="login-form">
        <div class="field"><label for="identifier">No. HP atau Email</label><input id="identifier" name="identifier" autocomplete="username" required placeholder="Masukkan No. HP atau Email"></div>
        <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required placeholder="Masukkan password"></div>
        <div class="form-row"><label class="checkline"><input type="checkbox" name="remember"> Ingat saya</label><span class="field-hint">Jangan gunakan perangkat umum.</span></div>
        <div class="form-error ${error ? "show" : ""}" id="form-error">${esc(error)}</div>
        <button class="btn btn-primary btn-block" type="submit" data-busy>Masuk</button>
      </form>
      <div class="auth-foot">Belum memiliki akun? <a class="text-link" href="#register">Daftar akun Wali</a></div>
    </section></main>${footer()}`;
}
function renderRegister(error = "") {
  root.innerHTML = `${header('<button class="btn btn-ghost" data-action="login">Sudah punya akun?</button>')}
    <main class="auth-wrap"><section class="auth-card">
      <span class="eyebrow">Pendaftaran Akun</span>
      <h1>Buat akun Wali</h1><p class="lead">Gunakan data yang aktif agar Panitia dapat menghubungi Anda.</p>${REGISTRATION_OPEN ? "" : '<div class="form-error show">Pendaftaran Tahun Ajaran 2027–2028 belum dibuka. Formulir akun disiapkan lebih awal dan akan diaktifkan setelah ada persetujuan pembukaan.</div>'}
      <form id="register-form">
        <div class="field"><label for="name">Nama lengkap Wali</label><input id="name" name="name" autocomplete="name" required placeholder="Nama sesuai identitas"></div>
        <div class="field"><label for="phone">Nomor HP</label><input id="phone" name="phone" type="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"></div>
        <div class="field"><label for="email">Alamat Email</label><input id="email" name="email" type="email" autocomplete="email" placeholder="nama@email.com"></div>
        <div class="field"><label for="reg-password">Password</label><input id="reg-password" name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Minimal 6 karakter"></div>
        <div class="field"><label for="confirm-password">Konfirmasi Password</label><input id="confirm-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" required placeholder="Ulangi password"></div>
        <p class="field-hint">Nomor HP atau email wajib diisi minimal salah satu.</p>
        <div class="form-error ${error ? "show" : ""}" id="form-error">${esc(error)}</div>
        <button class="btn btn-primary btn-block" type="submit" data-busy ${REGISTRATION_OPEN ? "" : "disabled"}>${REGISTRATION_OPEN ? "Buat Akun Wali" : "Pendaftaran Belum Dibuka"}</button>
      </form>
      <div class="auth-foot">Dengan membuat akun, Anda dapat melanjutkan pengisian data calon santri.</div>
    </section></main>${footer()}`;
}
function dashboardNav(role) {
  const menus = {
    WALI: [
      ["⌂","Dashboard"],["▤","Pendaftaran"],["▧","Dokumen"],["Rp","Pembayaran"],
      ["✓","Seleksi & Pengumuman"],["↻","Daftar Ulang"],["✉","Pesan"],["♢","Notifikasi"],["◉","Profil"]
    ],
    SUPERADMIN: [
      ["⌂","Dashboard"],["▧","Verifikasi Dokumen"],["Rp","Pembayaran"],
      ["✓","Seleksi"],["◉","Pengumuman"],["↻","Daftar Ulang"],["✉","Pesan Wali"],["✉","Komunikasi"],["⚠","Insiden"],["▥","Monitoring"],
      ["▤","Laporan"],["⚙","Data Master"],["♙","Pengguna"],["⚙","Pengaturan"]
    ],
    ADMIN_PSB: [
      ["⌂","Dashboard"],["▧","Verifikasi Dokumen"],["Rp","Pembayaran"],
      ["✓","Seleksi"],["◉","Pengumuman"],["↻","Daftar Ulang"],["✉","Pesan Wali"],["✉","Komunikasi"],["⚠","Insiden"],["▥","Monitoring"],
      ["▤","Laporan"],["⚙","Data Master"]
    ],
    VERIFIKATOR: [
      ["⌂","Dashboard"],["▧","Verifikasi Dokumen"],["↻","Daftar Ulang"],["▥","Monitoring"],["♢","Notifikasi"]
    ],
    SELEKSI: [
      ["⌂","Dashboard"],["✓","Seleksi"],["◉","Pengumuman"],["▥","Monitoring"],["♢","Notifikasi"]
    ],
    KEUANGAN: [
      ["⌂","Dashboard"],["Rp","Pembayaran"],["↻","Daftar Ulang"],["▥","Monitoring"],["▤","Laporan"]
    ]
  };
  return menus[String(role || "").toUpperCase()] || [["⌂","Dashboard"],["◉","Profil"]];
}
function dashboardNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}
function renderWaliDashboard(data) {
  const registrations = Array.isArray(data?.registrations) ? data.registrations : [];
  const cards = registrations.length ? registrations.map((item) => `
    <article class="dashboard-section">
      <div class="dashboard-section-head"><b>${esc(item.candidateName || "Calon Santri")}</b><span>${esc(item.registrationNumber || "-")}</span></div>
      <div><span class="status-badge">${esc(item.statusLabel || item.status || "DRAFT")}</span></div>
      <div class="dashboard-task-item"><div class="dashboard-task-copy"><div class="dashboard-task-name">${esc(item.next?.title || "Pendaftaran")}</div><div class="dashboard-task-meta">${esc(item.next?.description || "Lihat progres pendaftaran calon santri.")}</div></div></div>
      <button class="btn btn-outline" type="button" data-action="open-registration">Buka pendaftaran</button>
    </article>`).join("") : `<article class="dashboard-section"><b>Belum ada pendaftaran</b><p class="field-hint">Buka formulir pendaftaran calon santri dari menu Pendaftaran.</p><button class="btn btn-primary" type="button" data-action="open-registration">Buka Pendaftaran</button></article>`;
  return `<section class="dashboard-kpi-grid">
      <article class="dashboard-kpi"><div class="kpi-label">Tahun Ajaran Aktif</div><div class="kpi-value" style="font-size:18px">${esc(data?.activeYear || "-")}</div></article>
      <article class="dashboard-kpi"><div class="kpi-label">Pendaftaran Saya</div><div class="kpi-value">${dashboardNumber(registrations.length)}</div></article>
    </section>
    <section class="dashboard-section"><div class="dashboard-section-head"><b>Progres Calon Santri</b><span>Status terbaru</span></div><div class="dashboard-ops-grid">${cards}</div></section>`;
}
function renderStaffDashboard(data) {
  const summary = data?.summary || {};
  const payments = data?.payments || {};
  const selection = data?.selection || {};
  const permissions = data?.permissions || {};
  const kpis = [["Total Pendaftar", summary.total]];
  if (permissions.canVerification) kpis.push(["Menunggu Verifikasi", (summary.submitted || 0) + (summary.underReview || 0)]);
  if (permissions.canPayments) kpis.push(["Pembayaran Ditinjau", payments.review]);
  if (permissions.canSelection) kpis.push(["Hasil Seleksi Tertunda", selection.pending]);
  const tasks = data?.operational || {};
  const taskGroups = [
    ["Pendaftaran", tasks.verification, "canVerification"], ["Pembayaran", tasks.payments, "canPayments"],
    ["Seleksi", tasks.selection, "canSelection"], ["Pengumuman", tasks.announcements, "canAnnouncement"],
    ["Daftar Ulang", tasks.reregistration, "canReregistration"]
  ].filter(([, value, permission]) => permissions[permission] && value && Array.isArray(value.items));
  const taskHtml = taskGroups.map(([title, group]) => `<article class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">${esc(title)}</div><span class="dashboard-task-sub">Perlu ditindaklanjuti</span></div><div class="dashboard-task-count">${dashboardNumber(group.count)}</div></div>${group.items.length ? `<div class="dashboard-task-list">${group.items.map((item) => `<div class="dashboard-task-item"><div class="dashboard-task-copy"><div class="dashboard-task-name">${esc(item.candidateName || item.registrationNumber || title)}</div><div class="dashboard-task-meta">${esc(item.label || item.statusLabel || item.description || "")}</div></div></div>`).join("")}</div>` : `<div class="dashboard-task-empty">Tidak ada antrean saat ini.</div>`}</article>`).join("");
  return `<section class="dashboard-kpi-grid">${kpis.map(([label, value]) => `<article class="dashboard-kpi"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${dashboardNumber(value)}</div></article>`).join("")}</section>
    <section class="dashboard-section"><div class="dashboard-section-head"><b>Antrean Operasional</b><span>Tahun ajaran ${esc(data?.activeYear || "-")}</span></div><div class="dashboard-ops-grid">${taskHtml || `<p class="field-hint">Belum ada ringkasan antrean untuk akun ini.</p>`}</div></section>`;
}
async function loadDashboardData() {
  if (state.dashboardLoading || !state.user) return;
  state.dashboardLoading = true;
  state.dashboardError = "";
  renderDashboard();
  try {
    const role = String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim());
    const rpc = role.includes("WALI") ? "getWaliHomeData" : "getDashboardPageData";
    const result = await apiCall(rpc, state.token);
    if (!result?.success) throw new Error(result?.message || "Ringkasan dashboard tidak dapat dimuat.");
    state.dashboard = result;
  } catch (error) {
    state.dashboardError = error.message || "Ringkasan dashboard tidak dapat dimuat.";
  } finally {
    state.dashboardLoading = false;
    if (state.user && !["registration", "profile", "documents", "payments", "selection", "verification", "reregistration", "selection-admin", "reregistration-admin", "communications", "incidents", "chat", "master-data", "users", "reporting", "monitoring"].includes(state.route)) renderDashboard();
  }
}
function renderDashboard() {
  const name = displayName(state.user);
  const nav = dashboardNav(state.user?.role);
  const navHtml = nav.map(([icon,label], i) => `<button class="nav-item ${i===0?"active":""}" data-nav="${esc(label)}"><span>${icon}</span>${label}</button>`).join("");
  root.innerHTML = `${header(`<button class="btn btn-ghost" data-action="logout">Keluar</button>`)}
    <main class="page-shell">
      <aside class="sidebar"><div class="side-user"><strong>${esc(name)}</strong><span>${esc(roleName(state.user?.role))}</span></div><div class="nav-label">Menu Utama</div>${navHtml}</aside>
      <section class="content">
        <h1 class="page-title">Dashboard</h1><p class="page-subtitle">Ringkasan aktivitas akun Penerimaan Santri Baru.</p>
        <div class="welcome-card"><h2>Assalamu’alaikum, ${esc(name)}.</h2><p>Anda masuk sebagai ${esc(roleName(state.user?.role))} di Portal PSB Pesantren Ciawi Bogor Fathan Mubina.</p></div>
        ${state.dashboardLoading ? `<section class="dashboard-section" role="status">Memuat ringkasan dashboard…</section>` : state.dashboardError ? `<section class="dashboard-section"><p>${esc(state.dashboardError)}</p><button class="btn btn-primary" type="button" data-action="dashboard-retry">Coba lagi</button></section>` : (String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI") ? renderWaliDashboard(state.dashboard) : renderStaffDashboard(state.dashboard))}
      </section>
    </main>
    <nav class="mobile-nav" aria-label="Navigasi aplikasi">${nav.map(([icon,label],i)=>`<button class="nav-item ${i===0?"active":""}" data-nav="${esc(label)}"><span>${icon}</span>${label}</button>`).join("")}</nav>
    ${footer()}`;
}
function renderRegistration() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="registration-page"></section></main>${footer()}`;
  state.pageCleanup = mountRegistrationPage(document.querySelector("#registration-page"), { token: state.token });
}
function renderProfile() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="profile-page"></section></main>${footer()}`;
  state.pageCleanup = mountProfilePage(document.querySelector("#profile-page"), {
    token:state.token, user:state.user,
    onDashboard:() => { state.route = "dashboard"; render(); },
    onRegistration:() => { state.route = "registration"; render(); }
  });
}
function renderDocuments() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="documents-page"></section></main>${footer()}`;
  state.pageCleanup = mountDocumentsPage(document.querySelector("#documents-page"), { token: state.token, onRegistration: () => { state.route = "registration"; render(); } });
}
function renderPayments() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="payments-page"></section></main>${footer()}`;
  const roles = String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim());
  const staff = !roles.includes("WALI") && roles.some((role) => ["SUPERADMIN", "ADMIN_PSB", "KEUANGAN"].includes(role));
  state.pageCleanup = mountPaymentsPage(document.querySelector("#payments-page"), {
    token: state.token,
    staff,
    onDashboard: () => { state.route = "dashboard"; render(); },
    onRegistration: () => { state.route = "registration"; render(); }
  });
}
function renderSelection() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="selection-page"></section></main>${footer()}`;
  state.pageCleanup = mountSelectionPage(document.querySelector("#selection-page"), {
    token: state.token,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderVerification() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="verification-page"></section></main>${footer()}`;
  state.pageCleanup = mountVerificationPage(document.querySelector("#verification-page"), { token: state.token });
}
function renderReregistration() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="reregistration-page"></section></main>${footer()}`;
  state.pageCleanup = mountReregistrationPage(document.querySelector("#reregistration-page"), {
    token: state.token,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderSelectionManagement() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="selection-management-page"></section></main>${footer()}`;
  state.pageCleanup = mountSelectionManagementPage(document.querySelector("#selection-management-page"), {
    token: state.token,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderReregistrationManagement() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="reregistration-management-page"></section></main>${footer()}`;
  state.pageCleanup = mountReregistrationManagementPage(document.querySelector("#reregistration-management-page"), {
    token: state.token,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderCommunications() {
  if (state.pageCleanup) state.pageCleanup();
  const roles = String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim());
  const canBroadcast = roles.some((role) => ["SUPERADMIN", "ADMIN_PSB"].includes(role));
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="communications-page"></section></main>${footer()}`;
  state.pageCleanup = mountCommunicationsPage(document.querySelector("#communications-page"), {
    token: state.token,
    canBroadcast,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderIncidents() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="incident-page"></section></main>${footer()}`;
  state.pageCleanup = mountIncidentPage(document.querySelector("#incident-page"), {
    token: state.token,
    onDashboard: () => { state.route = "dashboard"; render(); }
  });
}
function renderChat() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="chat-page"></section></main>${footer()}`;
  state.pageCleanup = mountChatPage(document.querySelector("#chat-page"), { token:state.token, userId:state.user?.userId, onDashboard:() => { state.route = "dashboard"; render(); } });
}
function renderMasterData() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="master-data-page"></section></main>${footer()}`;
  state.pageCleanup = mountMasterDataPage(document.querySelector("#master-data-page"), { token:state.token, onDashboard:() => { state.route = "dashboard"; render(); } });
}
function renderUserManagement() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="users-page"></section></main>${footer()}`;
  state.pageCleanup = mountUsersPage(document.querySelector("#users-page"), { token:state.token, onDashboard:() => { state.route = "dashboard"; render(); } });
}
function renderReporting() {
  if (state.pageCleanup) state.pageCleanup();
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="reporting-page"></section></main>${footer()}`;
  state.pageCleanup = mountReportingPage(document.querySelector("#reporting-page"), { token:state.token, onDashboard:() => { state.route = "dashboard"; render(); } });
}
function renderMonitoring() {
  if (state.pageCleanup) state.pageCleanup();
  const roles = String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim());
  const canIncident = roles.some((role) => ["SUPERADMIN", "ADMIN_PSB"].includes(role));
  root.innerHTML = `${header('<button class="btn btn-ghost" type="button" data-action="dashboard">Dashboard</button><button class="btn btn-ghost" type="button" data-action="logout">Keluar</button>')}
    <main class="page-shell"><section class="content" id="monitoring-page"></section></main>${footer()}`;
  state.pageCleanup = mountMonitoringPage(document.querySelector("#monitoring-page"), {
    token:state.token, canIncident,
    onDashboard:() => { state.route = "dashboard"; render(); },
    onIncidents:() => { state.route = "incidents"; render(); }
  });
}
function render() {
  if (state.route !== "home") stopPublicGalleryTimer();
  if (!["registration", "profile", "documents", "payments", "selection", "verification", "reregistration", "selection-admin", "reregistration-admin", "communications", "incidents", "chat", "master-data", "users", "reporting", "monitoring"].includes(state.route) && state.pageCleanup) {
    state.pageCleanup();
    state.pageCleanup = null;
  }
  if (state.user && state.route === "registration") renderRegistration();
  else if (state.user && state.route === "profile" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) renderProfile();
  else if (state.user && state.route === "documents") renderDocuments();
  else if (state.user && state.route === "payments" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SUPERADMIN", "ADMIN_PSB", "KEUANGAN"].includes(item))) renderPayments();
  else if (state.user && state.route === "selection" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) renderSelection();
  else if (state.user && state.route === "verification" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR"].includes(item))) renderVerification();
  else if (state.user && state.route === "reregistration" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) renderReregistration();
  else if (state.user && state.route === "selection-admin" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "SELEKSI"].includes(item))) renderSelectionManagement();
  else if (state.user && state.route === "reregistration-admin" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR", "KEUANGAN"].includes(item))) renderReregistrationManagement();
  else if (state.user && state.route === "communications" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SUPERADMIN", "ADMIN_PSB", "SELEKSI", "VERIFIKATOR"].includes(item))) renderCommunications();
  else if (state.user && state.route === "incidents" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB"].includes(item))) renderIncidents();
  else if (state.user && state.route === "chat" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SUPERADMIN", "ADMIN_PSB"].includes(item))) renderChat();
  else if (state.user && state.route === "master-data" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB"].includes(item))) renderMasterData();
  else if (state.user && state.route === "users" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("SUPERADMIN")) renderUserManagement();
  else if (state.user && state.route === "reporting" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR", "SELEKSI", "KEUANGAN"].includes(item))) renderReporting();
  else if (state.user && state.route === "monitoring" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR", "SELEKSI", "KEUANGAN"].includes(item))) renderMonitoring();
  else if (state.user && state.route !== "settings") {
    renderDashboard();
    if (state.dashboard === null && !state.dashboardLoading && !state.dashboardError) loadDashboardData();
  }
  else if (state.route === "login") renderLogin();
  else if (state.route === "register") renderRegister();
  else renderHome();
  if (state.deferredInstall) document.querySelector("[data-install]")?.classList.remove("hidden");
}
function showSettings() {
  const current = getConfiguredBridgeUrl();
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `<section class="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
    <div class="modal-head"><div><h2 id="settings-title">Pengaturan Koneksi</h2><p>Masukkan URL Web App Apps Script yang digunakan PSB FM. URL disimpan hanya pada browser ini.</p></div><button class="icon-btn" type="button" data-close aria-label="Tutup">✕</button></div>
    <form id="connection-form">
      <div class="field"><label for="bridge-url">URL Web App</label><input id="bridge-url" name="bridgeUrl" type="url" required placeholder="https://script.google.com/macros/s/.../exec" value="${esc(current)}" autocomplete="url"></div>
      <div class="field-hint">Aplikasi akan menambahkan parameter ?bridge=1 secara otomatis. URL tidak ditulis ke repository.</div>
      <div class="status-line" id="connection-result"><i class="dot ${state.backendStatus==="ok"?"ok":""}"></i><span>${state.backendStatus==="ok"?"Backend terhubung": "Belum ada hasil pengujian koneksi"}</span></div>
      <div class="hero-actions"><button class="btn btn-primary" type="submit" data-busy>Simpan & Uji Koneksi</button><button class="btn btn-outline" type="button" data-clear-connection>Hapus URL</button></div>
    </form>
  </section>`;
  document.body.appendChild(backdrop);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop || e.target.closest("[data-close]")) backdrop.remove();
    if (e.target.closest("[data-clear-connection]")) {
      saveBridgeUrl("");
      state.backendStatus = "unknown";
      backdrop.remove();
      toast("URL backend dihapus dari browser.");
      render();
    }
  });
  backdrop.querySelector("#connection-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = backdrop.querySelector("#bridge-url");
    const result = backdrop.querySelector("#connection-result");
    try {
      const normalized = normalizeWebAppUrl(input.value);
      saveBridgeUrl(normalized);
      result.innerHTML = '<i class="dot"></i><span>Menguji koneksi Bridge…</span>';
      const response = await testBackendConnection();
      state.publicConfig = response.config || {};
      state.backendStatus = "ok";
      result.innerHTML = '<i class="dot ok"></i><span>Berhasil terhubung ke Apps Script Bridge.</span>';
      toast("Koneksi backend berhasil.", "success");
      setTimeout(() => { backdrop.remove(); render(); }, 900);
    } catch (error) {
      state.backendStatus = "error";
      result.innerHTML = `<i class="dot bad"></i><span>${esc(error.message)}</span>`;
      toast(error.message, "error");
    }
  });
  backdrop.querySelector("#bridge-url").focus();
}
async function handleLogin(form) {
  const data = new FormData(form);
  const identifier = String(data.get("identifier") || "").trim();
  const password = String(data.get("password") || "");
  const remember = data.get("remember") === "on";
  setBusy(true);
  try {
    const result = await apiCall("login", identifier, password);
    if (!result?.success) throw new Error(result?.message || "Login gagal. Periksa kembali data Anda.");
    if (!result.sessionToken) throw new Error("Login berhasil tetapi token sesi tidak diterima.");
    saveSession(result.sessionToken, result.user || {}, remember);
    state.token = result.sessionToken;
    state.user = result.user || {};
    state.remembered = remember;
    try { await apiCall("finalizeLogin", result.sessionToken); } catch (e) { console.warn("Finalize login:", e.message); }
    state.route = "dashboard";
    render();
    toast("Berhasil masuk.", "success");
    if (result.mustChangePassword) toast("Silakan ubah password Anda melalui pengaturan akun.");
  } catch (error) {
    const box = document.querySelector("#form-error");
    if (box) { box.textContent = error.message; box.classList.add("show"); }
    else toast(error.message, "error");
  } finally { setBusy(false); }
}
async function handleRegister(form) {
  if (!REGISTRATION_OPEN) { toast("Pendaftaran belum dibuka.", "error"); return; }
  const data = new FormData(form);
  const payload = {
    name: String(data.get("name") || "").trim(),
    phone: String(data.get("phone") || "").trim(),
    email: String(data.get("email") || "").trim(),
    password: String(data.get("password") || ""),
    confirmPassword: String(data.get("confirmPassword") || "")
  };
  if (!payload.phone && !payload.email) {
    const box = document.querySelector("#form-error"); box.textContent = "Nomor HP atau email wajib diisi minimal salah satu."; box.classList.add("show"); return;
  }
  if (payload.password !== payload.confirmPassword) {
    const box = document.querySelector("#form-error"); box.textContent = "Konfirmasi password tidak sama."; box.classList.add("show"); return;
  }
  setBusy(true);
  try {
    const result = await apiCall("registerWali", payload);
    if (!result?.success) throw new Error(result?.message || "Pendaftaran akun gagal.");
    toast(result.message || "Akun Wali berhasil dibuat. Silakan masuk.", "success");
    state.route = "login";
    render();
  } catch (error) {
    const box = document.querySelector("#form-error");
    if (box) { box.textContent = error.message; box.classList.add("show"); }
    else toast(error.message, "error");
  } finally { setBusy(false); }
}
async function handleLogout() {
  if (!confirm("Keluar dari akun PSB FM?")) return;
  try { if (state.token) await apiCall("logout", state.token); } catch (e) { console.warn("Logout backend:", e.message); }
  clearSession();
  state.token = ""; state.user = null; state.route = "home"; state.dashboard = null; state.dashboardError = "";
  render();
  toast("Anda telah keluar.");
}
async function restoreSession() {
  const saved = readSession();
  if (!saved.token) return;
  state.token = saved.token;
  state.remembered = saved.remembered;
  try {
    const result = await apiCall("validateSession", saved.token);
    if (result?.success && result.user) {
      state.user = result.user;
      updateSessionUser(result.user);
      state.route = "dashboard";
    } else clearSession();
  } catch (error) {
    // Keep a stored token during a temporary network outage; do not discard a valid session.
    toast("Sesi tersimpan belum dapat diverifikasi. Periksa koneksi backend.", "error");
  }
}
function bindEvents() {
  root.addEventListener("click", (event) => {
    const galleryStep = event.target.closest("[data-gallery-step]")?.dataset.galleryStep;
    if (galleryStep !== undefined) movePublicGallery(Number(galleryStep));
    const galleryIndex = event.target.closest("[data-gallery-index]")?.dataset.galleryIndex;
    if (galleryIndex !== undefined) { state.publicGalleryIndex = Number(galleryIndex); updatePublicGallery(); }
    const videoStep = event.target.closest("[data-video-step]")?.dataset.videoStep;
    if (videoStep !== undefined) renderPublicVideo(state.publicVideoIndex + Number(videoStep));
    const videoIndex = event.target.closest("[data-video-index]")?.dataset.videoIndex;
    if (videoIndex !== undefined) renderPublicVideo(Number(videoIndex));
    if (event.target.closest("[data-video-play]")) playPublicVideo();
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "login") { state.route = "login"; render(); }
    if (action === "register") { state.route = "register"; render(); }
    if (action === "settings") showSettings();
    if (action === "dashboard") { state.route = "dashboard"; render(); }
    if (action === "open-registration" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "registration"; render(); }
    if (action === "open-documents" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "documents"; render(); }
    if (action === "dashboard-retry") { state.dashboardError = ""; loadDashboardData(); }
    if (action === "logout") handleLogout();
    const nav = event.target.closest("[data-nav]");
    if (nav?.dataset.nav === "Dashboard") { state.route = "dashboard"; render(); }
    else if (nav?.dataset.nav === "Pengaturan" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("SUPERADMIN")) { showSettings(); }
    else if (nav?.dataset.nav === "Pendaftaran" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "registration"; render(); }
    else if (nav?.dataset.nav === "Profil" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "profile"; render(); }
    else if (nav?.dataset.nav === "Dokumen" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "documents"; render(); }
    else if (nav?.dataset.nav === "Pembayaran" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SUPERADMIN", "ADMIN_PSB", "KEUANGAN"].includes(item))) { state.route = "payments"; render(); }
    else if (nav?.dataset.nav === "Seleksi & Pengumuman" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "selection"; render(); }
    else if (nav?.dataset.nav === "Verifikasi Dokumen" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR"].includes(item))) { state.route = "verification"; render(); }
    else if (nav?.dataset.nav === "Daftar Ulang" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("WALI")) { state.route = "reregistration"; render(); }
    else if (nav?.dataset.nav === "Daftar Ulang" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR", "KEUANGAN"].includes(item))) { state.route = "reregistration-admin"; render(); }
    else if (["Pesan", "Pesan Wali"].includes(nav?.dataset.nav) && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SUPERADMIN", "ADMIN_PSB"].includes(item))) { state.route = "chat"; render(); }
    else if (nav?.dataset.nav === "Komunikasi" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB"].includes(item))) { state.route = "communications"; render(); }
    else if (nav?.dataset.nav === "Notifikasi" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["WALI", "SELEKSI", "VERIFIKATOR"].includes(item))) { state.route = "communications"; render(); }
    else if (nav?.dataset.nav === "Laporan" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "KEUANGAN"].includes(item))) { state.route = "reporting"; render(); }
    else if (nav?.dataset.nav === "Monitoring" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "VERIFIKATOR", "SELEKSI", "KEUANGAN"].includes(item))) { state.route = "monitoring"; render(); }
    else if (nav?.dataset.nav === "Data Master" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB"].includes(item))) { state.route = "master-data"; render(); }
    else if (nav?.dataset.nav === "Pengguna" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).includes("SUPERADMIN")) { state.route = "users"; render(); }
    else if (nav?.dataset.nav === "Insiden" && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB"].includes(item))) { state.route = "incidents"; render(); }
    else if (["Seleksi", "Pengumuman"].includes(nav?.dataset.nav) && String(state.user?.role || "").toUpperCase().split(",").map((item) => item.trim()).some((item) => ["SUPERADMIN", "ADMIN_PSB", "SELEKSI"].includes(item))) { state.route = "selection-admin"; render(); }
    else if (nav) toast(`Menu "${nav.dataset.nav}" sedang disiapkan pada tahap berikutnya.`);
  });
  root.addEventListener("submit", (event) => {
    if (event.target.id === "login-form") { event.preventDefault(); handleLogin(event.target); }
    if (event.target.id === "register-form") { event.preventDefault(); handleRegister(event.target); }
  });
  window.addEventListener("hashchange", () => {
    const route = location.hash.replace("#", "");
    if (["home","login","register"].includes(route) && !state.user) { state.route = route; render(); }
  });
}
async function init() {
  bindEvents();
  const configured = getConfiguredBridgeUrl();
  if (configured) {
    try {
      const result = await testBackendConnection();
      state.publicConfig = result.config || {};
      state.backendStatus = "ok";
    } catch { state.backendStatus = "error"; }
  }
  await restoreSession();
  if (!state.user && ["login","register"].includes(location.hash.slice(1))) state.route = location.hash.slice(1);
  render();
}
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredInstall = event;
  const target = document.querySelector("[data-install]");
  if (target) target.classList.remove("hidden");
});
window.addEventListener("appinstalled", () => {
  state.deferredInstall = null;
  toast("PSB FM berhasil dipasang.", "success");
});
document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-install]") && state.deferredInstall) {
    state.deferredInstall.prompt();
    await state.deferredInstall.userChoice;
    state.deferredInstall = null;
  }
});
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch((e) => console.warn("Service worker:", e)));
}
init().catch((error) => {
  root.innerHTML = `<main class="auth-wrap"><section class="auth-card"><h1>Aplikasi belum dapat dimuat</h1><p class="lead">${esc(error.message)}</p><button class="btn btn-primary" onclick="location.reload()">Muat ulang</button></section></main>`;
});

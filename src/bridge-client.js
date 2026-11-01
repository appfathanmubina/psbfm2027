export const BRIDGE_VERSION = "32.3.8";
export const PWA_SOURCE = "psb-fm-pwa";
export const BRIDGE_SOURCE = "psb-fm-api-bridge";

export const ALLOWED_RPCS = Object.freeze([
  "getAppInfo","getPublicConfig","getPublicGallery",
  "login","finalizeLogin","registerWali","validateSession","logout","changePassword",
  "getProductionControlData","setProductionControl","getGoLiveChecklist","createProductionBackup","runSecurityMaintenance",
  "getUserManagementData","adminResetUserPassword","createManualUser","getAuditLogPageData",
  "getAcademicYearLifecycleData","setActiveAcademicYear","getMasterDefinitions","getMasterData","saveMasterItem","deactivateMasterItem",
  "getRegistrationFormOptions","getWaliHomeData","getMyRegistrations","getRegistrationList","getRegistrationDetail",
  "getPaymentPageData","getPaymentsForRegistration","createBill","submitPayment","verifyPayment",
  "getSelectionPageData","createSelectionSchedule","updateSelectionScheduleStatus","addSelectionParticipant","addSelectionParticipantsBulk","updateSelectionParticipantStatus","saveSelectionScore","saveSelectionResult",
  "getAnnouncementPageData","publishAnnouncement",
  "getNotifications","markNotificationRead","markAllNotificationsRead",
  "getChatPageData","getChatThread","openChatThread","sendChatMessage","markChatThreadRead","closeChatThread","cleanupChatRetention","runChatAutomationNow",
  "getCommunicationCenterData","sendCommunication",
  "getReregistrationPageData","openReregistration","finalizeReregistration",
  "getDashboardPageData","getProductionReadiness","getMonitoringPageData","getIncidentPageData","saveIncident","closeIncident",
  "getReportingPageData","getAdvancedReportingData","exportAdvancedReportingCsv",
  "getVerificationQueue","getVerificationDetail","getDocumentOptions","getRegistrationDocuments","getDocumentPageData","uploadDocument","verifyDocument",
  "saveRegistration","submitRegistration","finalizeVerification"
]);

const TRUSTED_HOSTS = new Set(["script.google.com", "script.googleusercontent.com"]);
const DEFAULT_TIMEOUT = 30000;

export function normalizeWebAppUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("URL Web App belum diisi.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Format URL Web App tidak valid."); }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" ||
      !url.pathname.includes("/macros/s/") || !url.pathname.endsWith("/exec")) {
    throw new Error("Gunakan URL Web App Apps Script resmi yang berakhiran /macros/s/.../exec.");
  }
  url.search = "";
  url.hash = "";
  return url.toString();
}

function trustedOrigin(origin) {
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && (
      TRUSTED_HOSTS.has(u.hostname) ||
      (u.hostname.endsWith(".script.googleusercontent.com"))
    );
  } catch { return false; }
}

export class BridgeClient {
  constructor(webAppUrl, options = {}) {
    this.baseUrl = normalizeWebAppUrl(webAppUrl);
    this.bridgeUrl = this.baseUrl + "?bridge=1";
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.iframe = null;
    this.ready = false;
    this.activeOrigin = "";
    this.pending = new Map();
    this.sequence = 0;
    this.readyPromise = null;
    this.onMessage = this.onMessage.bind(this);
    window.addEventListener("message", this.onMessage);
  }

  createFrame() {
    if (this.iframe?.isConnected) return;
    this.ready = false;
    const frame = document.createElement("iframe");
    frame.title = "PSB FM API Bridge";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;left:-10000px;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none";
    frame.addEventListener("load", () => this.ping());
    frame.addEventListener("error", () => this.rejectReady(new Error("Iframe Apps Script gagal dimuat.")));
    frame.src = this.bridgeUrl;
    this.iframe = frame;
    document.body.appendChild(frame);
  }

  ping() {
    if (!this.iframe?.contentWindow || this.ready) return;
    try {
      this.iframe.contentWindow.postMessage({ source: PWA_SOURCE, type: "ping" }, "*");
    } catch {}
  }

  post(payload) {
    if (!this.iframe?.contentWindow) throw new Error("API Bridge belum tersedia.");
    const target = this.activeOrigin || "*";
    this.iframe.contentWindow.postMessage({ source: PWA_SOURCE, ...payload }, target);
  }

  waitReady() {
    if (this.ready) return Promise.resolve();
    if (this.readyPromise) return this.readyPromise;
    this.createFrame();
    this.readyPromise = new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearInterval(retry);
        clearTimeout(timer);
        this.readyPromise = null;
        error ? reject(error) : resolve();
      };
      const retry = setInterval(() => this.ping(), 700);
      const timer = setTimeout(() => finish(new Error("API Bridge belum merespons. Periksa URL Web App, izin akses, dan deployment Bridge.")), this.timeout);
      this.resolveReady = () => finish();
      this.rejectReady = (error) => finish(error);
      this.ping();
    });
    return this.readyPromise;
  }

  onMessage(event) {
    if (!this.iframe?.contentWindow || event.source !== this.iframe.contentWindow || !trustedOrigin(event.origin)) return;
    const data = event.data || {};
    if (data.source !== BRIDGE_SOURCE) return;
    this.activeOrigin = event.origin;

    if (data.type === "ready") {
      const version = String(data.bridgeVersion || "");
      if (version !== BRIDGE_VERSION) {
        this.rejectReady?.(new Error(`Versi Bridge tidak cocok. PWA ${BRIDGE_VERSION}, server ${version || "tidak diketahui"}.`));
        return;
      }
      this.ready = true;
      this.resolveReady?.();
      return;
    }

    if (data.type !== "response") return;
    const id = String(data.id || "");
    const item = this.pending.get(id);
    if (!item) return;
    this.pending.delete(id);
    clearTimeout(item.timer);
    if (data.ok) item.resolve(data.result);
    else item.reject(Object.assign(new Error(String(data.error?.message || "Terjadi kesalahan pada Bridge.")), data.error || {}));
  }

  async call(functionName, args = []) {
    const fn = String(functionName || "").trim();
    if (!ALLOWED_RPCS.includes(fn)) throw new Error("Fungsi API tidak terdaftar pada kontrak Bridge.");
    await this.waitReady();
    const id = `psb_${Date.now()}_${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Permintaan ${fn} melewati batas waktu.`));
      }, this.timeout);
      this.pending.set(id, { resolve, reject, timer });
      try { this.post({ type: "request", id, fn, args: Array.isArray(args) ? args : [] }); }
      catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  destroy() {
    window.removeEventListener("message", this.onMessage);
    this.iframe?.remove();
    this.iframe = null;
    this.ready = false;
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("Koneksi Bridge ditutup."));
    }
    this.pending.clear();
    this.rejectReady?.(new Error("Koneksi Bridge ditutup."));
  }
}
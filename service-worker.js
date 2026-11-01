const CACHE_NAME = "psb-fm-shell-v14";
const APP_ROOT = new URL("./", self.location.href);
const SHELL = [
  new URL("./", self.location.href).href,
  new URL("./index.html", self.location.href).href,
  new URL("./manifest.webmanifest", self.location.href).href,
  new URL("./styles.css", self.location.href).href,
  new URL("./assets/icon.svg", self.location.href).href,
  new URL("./src/app.js", self.location.href).href,
  new URL("./src/api.js", self.location.href).href,
  new URL("./src/bridge-client.js", self.location.href).href,
  new URL("./src/session.js", self.location.href).href,
  new URL("./src/pages/wali/registration.js", self.location.href).href,
  new URL("./src/pages/wali/profile.js", self.location.href).href,
  new URL("./src/pages/wali/documents.js", self.location.href).href,
  new URL("./src/pages/wali/payments.js", self.location.href).href,
  new URL("./src/pages/wali/selection.js", self.location.href).href,
  new URL("./src/pages/staff/verification.js", self.location.href).href,
  new URL("./src/pages/wali/reregistration.js", self.location.href).href,
  new URL("./src/pages/staff/selection-management.js", self.location.href).href,
  new URL("./src/pages/staff/reregistration-management.js", self.location.href).href,
  new URL("./src/pages/communications.js", self.location.href).href,
  new URL("./src/pages/staff/incidents.js", self.location.href).href,
  new URL("./src/pages/chat.js", self.location.href).href,
  new URL("./src/pages/staff/master-data.js", self.location.href).href,
  new URL("./src/pages/staff/users.js", self.location.href).href,
  new URL("./src/pages/staff/reporting.js", self.location.href).href,
  new URL("./src/pages/staff/monitoring.js", self.location.href).href
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("psb-fm-shell-") && key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Only static same-origin application shell assets are cached. API/Apps Script
  // responses, authentication payloads, payment data and private records are never cached.
  if (!url.href.startsWith(APP_ROOT.href)) return;
  event.respondWith(fetch(request).then((response) => {
    if (response.ok && (request.destination === "script" || request.destination === "style" || request.destination === "document" || request.destination === "image" || url.pathname.endsWith(".webmanifest"))) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") return caches.match(new URL("./index.html", self.location.href).href);
    throw new Error("Offline asset unavailable");
  }));
});

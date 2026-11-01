import { BridgeClient } from "./bridge-client.js";

const URL_KEY = "psbfm.bridgeUrl";
let client = null;
let clientUrl = "";

export function getConfiguredBridgeUrl() {
  return localStorage.getItem(URL_KEY) || "";
}

export function saveBridgeUrl(value) {
  const normalized = value.trim();
  if (!normalized) {
    localStorage.removeItem(URL_KEY);
    client?.destroy();
    client = null;
    clientUrl = "";
    return "";
  }
  // Validation and canonicalization happen in BridgeClient.
  const next = new URL(normalized);
  if (next.protocol !== "https:" || next.hostname !== "script.google.com" ||
      !next.pathname.includes("/macros/s/") || !next.pathname.endsWith("/exec")) {
    throw new Error("Masukkan URL Web App Apps Script yang berakhiran /exec.");
  }
  next.search = "";
  next.hash = "";
  localStorage.setItem(URL_KEY, next.toString());
  client?.destroy();
  client = null;
  clientUrl = "";
  return next.toString();
}

export function getApiClient() {
  const url = getConfiguredBridgeUrl();
  if (!url) throw new Error("Koneksi backend belum dikonfigurasi. Buka Pengaturan Koneksi.");
  if (!client || clientUrl !== url) {
    client?.destroy();
    client = new BridgeClient(url);
    clientUrl = url;
  }
  return client;
}

export async function apiCall(name, ...args) {
  return getApiClient().call(name, args);
}

export async function testBackendConnection() {
  const result = await apiCall("getPublicConfig", false);
  if (!result || result.success !== true) {
    throw new Error(result?.message || "Bridge terhubung, tetapi backend tidak memberikan respons yang valid.");
  }
  return result;
}
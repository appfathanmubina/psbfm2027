const SESSION_KEY = "psbfm.sessionToken";
const USER_KEY = "psbfm.sessionUser";

export function readSession() {
  const token = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY) || "";
  const rawUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || "";
  let user = null;
  try { user = rawUser ? JSON.parse(rawUser) : null; } catch {}
  return { token, user, remembered: !!localStorage.getItem(SESSION_KEY) };
}

export function saveSession(token, user, remember = false) {
  clearSession();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(SESSION_KEY, String(token));
  store.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function updateSessionUser(user) {
  const remembered = !!localStorage.getItem(SESSION_KEY);
  const store = remembered ? localStorage : sessionStorage;
  if (store.getItem(SESSION_KEY)) store.setItem(USER_KEY, JSON.stringify(user || {}));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(USER_KEY);
}
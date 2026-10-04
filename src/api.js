// Tiny client for our own /api endpoints.

const KEY = 'the-sharp:player-id';
let sessionId = null; // fallback when localStorage is unavailable (private mode)

export function getPlayerId() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function newPlayerId() {
  const id = crypto.randomUUID();
  sessionId = id;
  try { localStorage.setItem(KEY, id); } catch { /* private mode: lasts this tab only */ }
  return id;
}

export function forgetPlayer() {
  sessionId = null;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const id = getPlayerId() || sessionId;
  let res;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(id ? { 'x-player-id': id } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status}).`);
  return data;
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

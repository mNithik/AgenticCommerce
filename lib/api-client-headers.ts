const API_KEY_STORAGE_KEY = "proofspend.apiKey.v1";

export function getStoredApiKey() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setStoredApiKey(value: string) {
  if (typeof window === "undefined") {
    return;
  }

  const trimmed = value.trim();
  if (trimmed) {
    window.localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
  } else {
    window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}

export function buildApiHeaders(contentType = "application/json") {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const apiKey = getStoredApiKey();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

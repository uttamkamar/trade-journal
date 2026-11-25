// Minimal typed fetch wrapper.
// All requests go through Vite's proxy (/api -> localhost:3001).

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message || message;
    } catch {
      // non-JSON error body — use statusText
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  return res.json();
}

export const api = {
  get:    <T>(path: string)                     => request<T>(path),
  post:   <T>(path: string, body: unknown)      => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown)      => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)      => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown)     => request<T>(
    path,
    body !== undefined ? { method: 'DELETE', body: JSON.stringify(body) } : { method: 'DELETE' },
  ),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST',   body: formData, headers: {} }),
};

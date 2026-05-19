const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, { method = "GET", body, params } = {}) {
  const url = new URL(path, API_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? safeJson(text) : null;

  if (!res.ok) {
    const message =
      data?.error ||
      (data?.details && data.details[0]?.message) ||
      `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const api = {
  register: (email, password) =>
    request("/user/register", { method: "POST", body: { email, password } }),

  login: (email, password) =>
    request("/user/login", { method: "POST", body: { email, password } }),

  getMe: (id) => request(`/user/me/${encodeURIComponent(id)}`),

  createRoom: ({ userId, topic, difficulty, description }) =>
    request("/room/create", {
      method: "POST",
      body: { userId, topic, difficulty, description },
    }),

  getRoom: (id) => request(`/room/${encodeURIComponent(id)}`),

  listRooms: () => request("/room"),
};

export { API_URL };

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("accessToken");
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.code || "UNKNOWN", body?.error?.message || "Request failed");
  }
  return body;
}

export const api = {
  login: (email: string, password: string) =>
    request("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  submitPublicLead: (data: { name: string; email: string; company?: string; message?: string }) =>
    request("/api/public/leads", { method: "POST", body: JSON.stringify(data) }),
  listLeads: (params: { stage?: string; page?: number; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.stage) qs.set("stage", params.stage);
    qs.set("page", String(params.page ?? 1));
    qs.set("limit", String(params.limit ?? 20));
    return request(`/api/leads?${qs.toString()}`);
  },
  getLead: (id: string) => request(`/api/leads/${id}`),
  updateStage: (id: string, stage: string, lostReason?: string) =>
    request(`/api/leads/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage, lostReason }) }),
  addNote: (id: string, body: string) =>
    request(`/api/leads/${id}/notes`, { method: "POST", body: JSON.stringify({ body }) }),
  claimLead: (id: string) => request(`/api/leads/${id}/claim`, { method: "POST" }),
  assignLead: (id: string, userId: string) =>
    request(`/api/leads/${id}/assign`, { method: "PATCH", body: JSON.stringify({ userId }) }),
  listUsers: () => request("/api/users"),
  createUser: (data: { name: string; email: string; password: string; role: string }) =>
    request("/api/users", { method: "POST", body: JSON.stringify(data) }),
};

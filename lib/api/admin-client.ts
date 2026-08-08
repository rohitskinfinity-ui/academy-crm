import axios from "axios";

const TOKEN_KEY = "academy_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export const adminApi = axios.create({
  baseURL: "",
  headers: { "Content-Type": "application/json" },
});

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      if (!path.startsWith("/admin/login")) {
        setAdminToken(null);
        window.location.href = "/admin/login";
      }
    }
    return Promise.reject(error);
  },
);

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
  errors?: unknown;
};

export async function adminGet<T>(url: string, params?: Record<string, unknown>) {
  const { data } = await adminApi.get<ApiEnvelope<T>>(url, { params });
  return data;
}

export async function adminPost<T>(url: string, body?: unknown) {
  const { data } = await adminApi.post<ApiEnvelope<T>>(url, body);
  return data;
}

export async function adminPatch<T>(url: string, body?: unknown) {
  const { data } = await adminApi.patch<ApiEnvelope<T>>(url, body);
  return data;
}

export async function adminPut<T>(url: string, body?: unknown) {
  const { data } = await adminApi.put<ApiEnvelope<T>>(url, body);
  return data;
}

export async function adminDelete<T>(url: string) {
  const { data } = await adminApi.delete<ApiEnvelope<T>>(url);
  return data;
}

export async function adminPostForm<T>(url: string, form: FormData) {
  const token = getAdminToken();
  const { data } = await axios.post<ApiEnvelope<T>>(url, form, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return data;
}

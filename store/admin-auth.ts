"use client";

import { create } from "zustand";
import {
  adminGet,
  adminPost,
  getAdminToken,
  setAdminToken,
} from "@/lib/api/admin-client";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  display_name: string | null;
  avatar_url: string | null;
  role: "admin" | "staff";
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string;
};

type AuthState = {
  token: string | null;
  admin: AdminProfile | null;
  hydrated: boolean;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
};

export const useAdminAuth = create<AuthState>((set, get) => ({
  token: null,
  admin: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    const token = getAdminToken();
    if (!token) {
      set({ token: null, admin: null, hydrated: true });
      return;
    }
    set({ token, loading: true });
    try {
      const res = await adminGet<AdminProfile>("/api/admin/auth/me");
      set({ admin: res.data, hydrated: true, loading: false });
    } catch {
      setAdminToken(null);
      set({ token: null, admin: null, hydrated: true, loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    try {
      const res = await adminPost<{ token: string; admin: AdminProfile }>(
        "/api/admin/auth/login",
        { email, password },
      );
      setAdminToken(res.data.token);
      set({
        token: res.data.token,
        admin: res.data.admin,
        loading: false,
        hydrated: true,
      });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  logout: async () => {
    try {
      if (get().token) {
        await adminPost("/api/admin/auth/logout");
      }
    } catch {
      // ignore
    }
    setAdminToken(null);
    set({ token: null, admin: null });
  },

  refreshMe: async () => {
    const res = await adminGet<AdminProfile>("/api/admin/auth/me");
    set({ admin: res.data });
  },
}));

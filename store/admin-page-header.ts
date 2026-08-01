"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

type AdminPageHeaderState = {
  title: string | null;
  description: string | null;
  actions: ReactNode | null;
  setHeader: (patch: {
    title?: string | null;
    description?: string | null;
    actions?: ReactNode | null;
  }) => void;
  resetHeader: () => void;
};

export const useAdminPageHeaderStore = create<AdminPageHeaderState>((set) => ({
  title: null,
  description: null,
  actions: null,
  setHeader: (patch) =>
    set((state) => ({
      title: patch.title !== undefined ? patch.title : state.title,
      description:
        patch.description !== undefined ? patch.description : state.description,
      actions: patch.actions !== undefined ? patch.actions : state.actions,
    })),
  resetHeader: () =>
    set({ title: null, description: null, actions: null }),
}));

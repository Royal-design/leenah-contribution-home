"use client"

import { create } from "zustand"

interface UiState {
  sidebarOpen: boolean
  mobileNavOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setMobileNavOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: false,
  mobileNavOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}))
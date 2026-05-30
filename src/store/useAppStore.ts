import { create } from 'zustand'
import type { ToastMessage } from '@/types'
import { generateId } from '@/lib/utils'

interface AppState {
  // Sidebar
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  // Filters
  selectedTagIds: string[]
  toggleTagFilter: (id: string) => void
  clearTagFilters: () => void

  // Search & sort
  searchQuery: string
  setSearchQuery: (q: string) => void
  sortBy: 'updated_at' | 'name'
  setSortBy: (s: 'updated_at' | 'name') => void

  // Toasts
  toasts: ToastMessage[]
  addToast: (type: ToastMessage['type'], message: string, persistent?: boolean) => void
  removeToast: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  selectedTagIds: [],
  toggleTagFilter: (id) =>
    set((s) => ({
      // Single-select: click a new tag → select only that tag; click same tag → deselect
      selectedTagIds:
        s.selectedTagIds.length === 1 && s.selectedTagIds[0] === id
          ? []
          : [id],
    })),
  clearTagFilters: () => set({ selectedTagIds: [] }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  sortBy: 'updated_at',
  setSortBy: (sortBy) => set({ sortBy }),

  toasts: [],
  addToast: (type, message, persistent = false) =>
    set((s) => ({
      toasts: [...s.toasts, { id: generateId(), type, message, persistent }],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// Convenience helpers
export const toast = {
  success: (msg: string) => useAppStore.getState().addToast('success', msg),
  error: (msg: string, persistent = false) =>
    useAppStore.getState().addToast('error', msg, persistent),
  info: (msg: string) => useAppStore.getState().addToast('info', msg),
}

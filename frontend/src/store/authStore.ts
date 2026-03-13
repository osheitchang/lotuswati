import { create } from 'zustand'
import { authApi, teamApi } from '@/lib/api'
import type { User, Team } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  team: Team | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { teamName: string; name: string; email: string; password: string }) => Promise<void>
  logout: () => void
  loadUser: () => Promise<void>
  updateUser: (data: Partial<User>) => void
  setTeam: (team: Team) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  team: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true })
    try {
      const response = await authApi.login(email, password)
      const { token, user, team } = response.data
      localStorage.setItem('token', token)
      set({ token, user, team, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  register: async (data) => {
    set({ isLoading: true })
    try {
      const response = await authApi.register(data)
      const { token, user, team } = response.data
      localStorage.setItem('token', token)
      set({ token, user, team, isAuthenticated: true, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, team: null, isAuthenticated: false })
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  },

  loadUser: async () => {
    const token = get().token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null)
    if (!token) {
      set({ isLoading: false, isAuthenticated: false })
      return
    }

    set({ isLoading: true })
    try {
      const [meResponse, teamResponse] = await Promise.all([
        authApi.getMe(),
        teamApi.get().catch(() => ({ data: null })),
      ])
      set({
        user: meResponse.data.user || meResponse.data,
        team: teamResponse.data?.team || teamResponse.data,
        token,
        isAuthenticated: true,
        isLoading: false,
      })
    } catch (error) {
      localStorage.removeItem('token')
      set({ user: null, token: null, team: null, isAuthenticated: false, isLoading: false })
    }
  },

  updateUser: (data) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }))
  },

  setTeam: (team) => {
    set({ team })
  },
}))

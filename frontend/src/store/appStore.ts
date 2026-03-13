import { create } from 'zustand'
import { teamApi } from '@/lib/api'
import type { Label, User, CannedResponse } from '@/types'

interface AppState {
  labels: Label[]
  agents: User[]
  cannedResponses: CannedResponse[]
  isConnected: boolean
  isLoadingLabels: boolean
  isLoadingAgents: boolean

  loadLabels: () => Promise<void>
  loadAgents: () => Promise<void>
  loadCannedResponses: () => Promise<void>
  loadAll: () => Promise<void>
  addLabel: (label: Label) => void
  updateLabel: (label: Label) => void
  removeLabel: (labelId: string) => void
  addAgent: (agent: User) => void
  updateAgent: (agent: Partial<User> & { id: string }) => void
  removeAgent: (agentId: string) => void
  addCannedResponse: (cr: CannedResponse) => void
  updateCannedResponse: (cr: CannedResponse) => void
  removeCannedResponse: (id: string) => void
  setConnected: (connected: boolean) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  labels: [],
  agents: [],
  cannedResponses: [],
  isConnected: false,
  isLoadingLabels: false,
  isLoadingAgents: false,

  loadLabels: async () => {
    set({ isLoadingLabels: true })
    try {
      const response = await teamApi.getLabels()
      set({ labels: response.data.labels || response.data || [], isLoadingLabels: false })
    } catch {
      set({ isLoadingLabels: false })
    }
  },

  loadAgents: async () => {
    set({ isLoadingAgents: true })
    try {
      const response = await teamApi.getAgents()
      set({ agents: response.data.agents || response.data || [], isLoadingAgents: false })
    } catch {
      set({ isLoadingAgents: false })
    }
  },

  loadCannedResponses: async () => {
    try {
      const response = await teamApi.getCannedResponses()
      set({ cannedResponses: response.data.cannedResponses || response.data || [] })
    } catch {
      // silent fail
    }
  },

  loadAll: async () => {
    await Promise.allSettled([
      get().loadLabels(),
      get().loadAgents(),
      get().loadCannedResponses(),
    ])
  },

  addLabel: (label) => set((state) => ({ labels: [...state.labels, label] })),
  updateLabel: (label) =>
    set((state) => ({ labels: state.labels.map((l) => (l.id === label.id ? label : l)) })),
  removeLabel: (labelId) =>
    set((state) => ({ labels: state.labels.filter((l) => l.id !== labelId) })),

  addAgent: (agent) => set((state) => ({ agents: [...state.agents, agent] })),
  updateAgent: (agent) =>
    set((state) => ({
      agents: state.agents.map((a) => (a.id === agent.id ? { ...a, ...agent } : a)),
    })),
  removeAgent: (agentId) =>
    set((state) => ({ agents: state.agents.filter((a) => a.id !== agentId) })),

  addCannedResponse: (cr) =>
    set((state) => ({ cannedResponses: [...state.cannedResponses, cr] })),
  updateCannedResponse: (cr) =>
    set((state) => ({
      cannedResponses: state.cannedResponses.map((c) => (c.id === cr.id ? cr : c)),
    })),
  removeCannedResponse: (id) =>
    set((state) => ({ cannedResponses: state.cannedResponses.filter((c) => c.id !== id) })),

  setConnected: (connected) => set({ isConnected: connected }),
}))

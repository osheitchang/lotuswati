export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'agent' | 'supervisor'
  avatar?: string
  status: 'online' | 'offline' | 'busy'
  teamId: string
}

export interface Team {
  id: string
  name: string
  waPhoneNumberId?: string
  waAccessToken?: string
  webhookVerifyToken?: string
}

export interface Contact {
  id: string
  phone: string
  name?: string
  email?: string
  avatar?: string
  tags: string[]
  teamId: string
  blocked: boolean
  customFields?: Record<string, string>
  conversationCount?: number
  createdAt: string
  updatedAt: string
}

export interface Label {
  id: string
  name: string
  color: string
}

export interface Conversation {
  id: string
  teamId: string
  contactId: string
  contact: Contact
  assignedToId?: string
  assignedTo?: User
  status: 'open' | 'resolved' | 'pending' | 'snoozed'
  lastMessage?: Message
  lastMessageAt?: string
  unreadCount: number
  labels: Label[]
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  fromType: 'contact' | 'agent' | 'bot' | 'system'
  fromId?: string
  agent?: User
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'template' | 'location' | 'note'
  content?: string
  mediaUrl?: string
  caption?: string
  fileName?: string
  templateName?: string
  templateData?: Record<string, string>
  status: 'sent' | 'delivered' | 'read' | 'failed'
  createdAt: string
}

export interface Note {
  id: string
  conversationId: string
  userId: string
  user: User
  content: string
  createdAt: string
}

export interface Template {
  id: string
  name: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  status: 'pending' | 'approved' | 'rejected' | 'draft'
  headerType?: 'none' | 'text' | 'image' | 'video' | 'document'
  headerValue?: string
  body: string
  footer?: string
  buttons: TemplateButton[]
  teamId: string
  createdAt: string
}

export interface TemplateButton {
  type: 'quick_reply' | 'url' | 'phone_number'
  text: string
  url?: string
  phone_number?: string
}

export interface Broadcast {
  id: string
  name: string
  status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed'
  templateId?: string
  message?: string
  totalCount: number
  sentCount: number
  deliveredCount: number
  failedCount: number
  tags?: string[]
  scheduledAt?: string
  createdAt: string
}

export interface AutomationTrigger {
  type: 'keyword' | 'new_conversation' | 'no_reply' | 'label_added' | 'resolved'
  keywords?: string[]
  minutes?: number
  labelId?: string
}

export interface AutomationAction {
  type: 'send_message' | 'assign_agent' | 'add_label' | 'resolve' | 'send_template'
  message?: string
  agentId?: string
  labelId?: string
  templateId?: string
}

export interface Automation {
  id: string
  name: string
  isActive: boolean
  trigger: AutomationTrigger
  actions: AutomationAction[]
  runCount: number
  createdAt: string
}

export interface CannedResponse {
  id: string
  shortcut: string
  content: string
}

export interface AnalyticsOverview {
  totalConversations: number
  openConversations: number
  resolvedToday: number
  avgResponseTime: number
  totalContacts: number
  messagesSentToday: number
}

export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface AgentPerformance {
  agentId: string
  agentName: string
  resolved: number
  avgResponseTime: number
  totalMessages: number
}

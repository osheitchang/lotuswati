'use client'

import { useState, useEffect } from 'react'
import {
  Building2,
  Users,
  Tag,
  MessageSquare,
  Bell,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  Check,
  Copy,
  Wifi,
  X,
  AlertTriangle,
  MoreVertical,
  KeyRound,
  UserX,
  UserCircle,
  Lock,
} from 'lucide-react'
import { teamApi, authApi } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn, getInitials, getAvatarColor } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'
import type { User, Label as LabelType, CannedResponse } from '@/types'

const LABEL_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#3B82F6']

export default function SettingsPage() {
  const { team, setTeam, user: currentUser, updateUser } = useAuthStore()
  const { labels, agents, cannedResponses, addLabel, updateLabel, removeLabel, addAgent, updateAgent, removeAgent, addCannedResponse, updateCannedResponse, removeCannedResponse } = useAppStore()

  const isAdmin = currentUser?.role === 'admin'

  // ── Profile tab ──
  const [profileForm, setProfileForm] = useState<{ name: string; status: 'online' | 'offline' | 'busy' }>({
    name: currentUser?.name || '',
    status: currentUser?.status ?? 'online',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ── Team tab ──
  const [teamName, setTeamName] = useState(team?.name || '')
  const [waPhoneId, setWaPhoneId] = useState(team?.waPhoneNumberId || '')
  const [waToken, setWaToken] = useState(team?.waAccessToken || '')
  const [showToken, setShowToken] = useState(false)
  const [isSavingTeam, setIsSavingTeam] = useState(false)
  const [isTestingConn, setIsTestingConn] = useState(false)

  // ── Invite agent dialog ──
  const [showAgentDialog, setShowAgentDialog] = useState(false)
  const [agentForm, setAgentForm] = useState({ email: '', name: '', role: 'agent' })
  const [isInviting, setIsInviting] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ email: string; tempPassword: string } | null>(null)

  // ── Edit agent dialog ──
  const [editingAgent, setEditingAgent] = useState<User | null>(null)
  const [editAgentForm, setEditAgentForm] = useState({ name: '', role: 'agent' })
  const [isEditingAgent, setIsEditingAgent] = useState(false)

  // ── Reset password dialogs ──
  const [resettingPasswordFor, setResettingPasswordFor] = useState<User | null>(null)
  const [passwordResetResult, setPasswordResetResult] = useState<{ email: string; tempPassword: string } | null>(null)
  const [isResettingPassword, setIsResettingPassword] = useState(false)

  // ── Remove agent dialog ──
  const [agentToRemove, setAgentToRemove] = useState<User | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  // ── Label dialog ──
  const [showLabelDialog, setShowLabelDialog] = useState(false)
  const [editingLabel, setEditingLabel] = useState<LabelType | null>(null)
  const [labelForm, setLabelForm] = useState({ name: '', color: LABEL_COLORS[0] })
  const [isSavingLabel, setIsSavingLabel] = useState(false)

  // ── Canned response dialog ──
  const [showCannedDialog, setShowCannedDialog] = useState(false)
  const [editingCanned, setEditingCanned] = useState<CannedResponse | null>(null)
  const [cannedForm, setCannedForm] = useState({ shortcut: '', content: '' })
  const [isSavingCanned, setIsSavingCanned] = useState(false)

  useEffect(() => {
    if (team) {
      setTeamName(team.name)
      setWaPhoneId(team.waPhoneNumberId || '')
      setWaToken(team.waAccessToken || '')
    }
  }, [team])

  useEffect(() => {
    if (currentUser) {
      setProfileForm({ name: currentUser.name, status: currentUser.status ?? 'online' })
    }
  }, [currentUser])

  // ── Profile handlers ──
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) return
    setIsSavingProfile(true)
    try {
      const response = await authApi.updateMe({ name: profileForm.name, status: profileForm.status })
      const updated = response.data.user || response.data
      updateUser(updated)
      toast({ title: 'Profile updated' })
    } catch (error: any) {
      toast({ title: error.response?.data?.error || 'Failed to save', variant: 'destructive' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 8) {
      toast({ title: 'New password must be at least 8 characters', variant: 'destructive' })
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    setIsChangingPassword(true)
    try {
      await authApi.updateMe({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
      toast({ title: 'Password changed successfully' })
    } catch (error: any) {
      toast({ title: error.response?.data?.error || 'Failed to change password', variant: 'destructive' })
    } finally {
      setIsChangingPassword(false)
    }
  }

  // ── Team handlers ──
  const handleSaveTeam = async () => {
    setIsSavingTeam(true)
    try {
      const response = await teamApi.update({ name: teamName, waPhoneNumberId: waPhoneId, waAccessToken: waToken })
      const updated = response.data.team || response.data
      setTeam(updated)
      toast({ title: 'Team settings saved' })
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setIsSavingTeam(false)
    }
  }

  const handleTestConnection = async () => {
    setIsTestingConn(true)
    try {
      await teamApi.testConnection()
      toast({ title: 'Connection successful!', variant: 'default' })
    } catch (error: any) {
      toast({
        title: 'Connection failed',
        description: error.response?.data?.message || 'Check your credentials',
        variant: 'destructive',
      })
    } finally {
      setIsTestingConn(false)
    }
  }

  // ── Agent handlers ──
  const handleInviteAgent = async () => {
    setIsInviting(true)
    try {
      const response = await teamApi.inviteAgent(agentForm)
      const agent = response.data.agent || response.data
      addAgent(agent)
      setShowAgentDialog(false)
      setInviteResult({ email: agentForm.email, tempPassword: response.data.tempPassword })
      setAgentForm({ email: '', name: '', role: 'agent' })
    } catch (error: any) {
      toast({
        title: 'Failed to invite',
        description: error.response?.data?.error || error.response?.data?.message,
        variant: 'destructive',
      })
    } finally {
      setIsInviting(false)
    }
  }

  const openEditAgent = (agent: User) => {
    setEditingAgent(agent)
    setEditAgentForm({ name: agent.name, role: agent.role })
  }

  const handleEditAgent = async () => {
    if (!editingAgent) return
    setIsEditingAgent(true)
    try {
      await teamApi.updateAgent(editingAgent.id, editAgentForm)
      updateAgent({ id: editingAgent.id, name: editAgentForm.name, role: editAgentForm.role as any })
      setEditingAgent(null)
      toast({ title: 'Agent updated' })
    } catch (error: any) {
      toast({ title: 'Failed to update', description: error.response?.data?.error, variant: 'destructive' })
    } finally {
      setIsEditingAgent(false)
    }
  }

  const handleResetAgentPassword = async () => {
    if (!resettingPasswordFor) return
    setIsResettingPassword(true)
    try {
      const response = await teamApi.resetAgentPassword(resettingPasswordFor.id)
      setResettingPasswordFor(null)
      setPasswordResetResult({ email: resettingPasswordFor.email, tempPassword: response.data.tempPassword })
    } catch (error: any) {
      toast({ title: 'Failed to reset password', description: error.response?.data?.error, variant: 'destructive' })
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleConfirmRemoveAgent = async () => {
    if (!agentToRemove) return
    setIsRemoving(true)
    try {
      await teamApi.removeAgent(agentToRemove.id)
      removeAgent(agentToRemove.id)
      setAgentToRemove(null)
      toast({ title: 'Agent removed' })
    } catch (error: any) {
      toast({ title: error.response?.data?.error || 'Failed to remove', variant: 'destructive' })
    } finally {
      setIsRemoving(false)
    }
  }

  // ── Label handlers ──
  const handleSaveLabel = async () => {
    if (!labelForm.name.trim()) return
    setIsSavingLabel(true)
    try {
      if (editingLabel) {
        const response = await teamApi.updateLabel(editingLabel.id, labelForm)
        updateLabel(response.data.label || response.data)
        toast({ title: 'Label updated' })
      } else {
        const response = await teamApi.createLabel(labelForm)
        addLabel(response.data.label || response.data)
        toast({ title: 'Label created' })
      }
      setShowLabelDialog(false)
    } catch {
      toast({ title: 'Failed to save label', variant: 'destructive' })
    } finally {
      setIsSavingLabel(false)
    }
  }

  const handleDeleteLabel = async (id: string) => {
    try {
      await teamApi.deleteLabel(id)
      removeLabel(id)
      toast({ title: 'Label deleted' })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  // ── Canned response handlers ──
  const handleSaveCanned = async () => {
    if (!cannedForm.shortcut.trim() || !cannedForm.content.trim()) return
    setIsSavingCanned(true)
    try {
      if (editingCanned) {
        const response = await teamApi.updateCannedResponse(editingCanned.id, cannedForm)
        updateCannedResponse(response.data.cannedResponse || response.data)
        toast({ title: 'Canned response updated' })
      } else {
        const response = await teamApi.createCannedResponse(cannedForm)
        addCannedResponse(response.data.cannedResponse || response.data)
        toast({ title: 'Canned response created' })
      }
      setShowCannedDialog(false)
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setIsSavingCanned(false)
    }
  }

  const handleDeleteCanned = async (id: string) => {
    try {
      await teamApi.deleteCannedResponse(id)
      removeCannedResponse(id)
      toast({ title: 'Deleted' })
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001/webhook`
    : 'http://localhost:3001/webhook'

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Copied to clipboard' })
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your workspace settings</p>
      </div>

      <div className="flex-1 p-6">
        <Tabs defaultValue={isAdmin ? 'team' : 'profile'} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="profile" className="gap-1.5"><UserCircle className="w-4 h-4" /> Profile</TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="team" className="gap-1.5"><Building2 className="w-4 h-4" /> Team</TabsTrigger>
                <TabsTrigger value="agents" className="gap-1.5"><Users className="w-4 h-4" /> Agents</TabsTrigger>
                <TabsTrigger value="labels" className="gap-1.5"><Tag className="w-4 h-4" /> Labels</TabsTrigger>
                <TabsTrigger value="canned" className="gap-1.5"><MessageSquare className="w-4 h-4" /> Canned Responses</TabsTrigger>
              </>
            )}
            <TabsTrigger value="notifications" className="gap-1.5"><Bell className="w-4 h-4" /> Notifications</TabsTrigger>
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile">
            <div className="max-w-xl space-y-6">
              {/* Profile info */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserCircle className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Profile</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Display Name</Label>
                    <Input
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={currentUser?.email || ''} readOnly className="mt-1 bg-gray-50 text-gray-500" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={profileForm.status}
                      onValueChange={(v) => setProfileForm({ ...profileForm, status: v as 'online' | 'offline' | 'busy' })}
                    >
                      <SelectTrigger className="mt-1 max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="online">Online</SelectItem>
                        <SelectItem value="busy">Busy</SelectItem>
                        <SelectItem value="offline">Offline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Role</Label>
                    <div className="mt-1">
                      <span className={cn(
                        'inline-block text-xs px-2.5 py-1 rounded-full font-medium capitalize',
                        currentUser?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        currentUser?.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      )}>
                        {currentUser?.role}
                      </span>
                    </div>
                  </div>
                  <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm">
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </Button>
                </div>
              </div>

              {/* Change password */}
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-5 h-5 text-gray-400" />
                  <h3 className="font-semibold text-gray-900">Change Password</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label>Current Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showCurrentPw ? 'text' : 'password'}
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                        className="pr-10"
                        placeholder="Enter current password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>New Password</Label>
                    <div className="relative mt-1">
                      <Input
                        type={showNewPw ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                        className="pr-10"
                        placeholder="Min. 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <Label>Confirm New Password</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirmNewPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value })}
                      className="mt-1"
                      placeholder="Repeat new password"
                    />
                  </div>
                  <Button
                    onClick={handleChangePassword}
                    disabled={isChangingPassword || !passwordForm.currentPassword || !passwordForm.newPassword}
                    size="sm"
                  >
                    {isChangingPassword ? 'Changing...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Team Tab (admin only) ── */}
          {isAdmin && (
            <TabsContent value="team">
              <div className="max-w-2xl space-y-6">
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h3 className="font-semibold text-gray-900 mb-4">General</h3>
                  <div className="space-y-4">
                    <div>
                      <Label>Team Name</Label>
                      <Input
                        value={teamName}
                        onChange={(e) => setTeamName(e.target.value)}
                        className="mt-1 max-w-sm"
                      />
                    </div>
                    <Button onClick={handleSaveTeam} disabled={isSavingTeam} size="sm">
                      {isSavingTeam ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Wifi className="w-5 h-5 text-green-500" />
                    <h3 className="font-semibold text-gray-900">WhatsApp Connection</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label>Phone Number ID</Label>
                      <Input
                        value={waPhoneId}
                        onChange={(e) => setWaPhoneId(e.target.value)}
                        placeholder="123456789012345"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Access Token</Label>
                      <div className="relative mt-1">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          value={waToken}
                          onChange={(e) => setWaToken(e.target.value)}
                          placeholder="EAAxxxxxx..."
                          className="pr-10"
                        />
                        <button
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label>Webhook URL (read-only)</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input value={webhookUrl} readOnly className="bg-gray-50 text-gray-500" />
                        <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(webhookUrl)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    {team?.webhookVerifyToken && (
                      <div>
                        <Label>Verify Token (read-only)</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input value={team.webhookVerifyToken} readOnly className="bg-gray-50 text-gray-500 font-mono" />
                          <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(team.webhookVerifyToken!)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button onClick={handleSaveTeam} disabled={isSavingTeam} size="sm">
                        {isSavingTeam ? 'Saving...' : 'Save Connection'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={isTestingConn}>
                        {isTestingConn ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-5 pt-5 border-t border-gray-100">
                    <p className="text-sm font-medium text-gray-700 mb-3">Setup Guide</p>
                    <ol className="space-y-2">
                      {[
                        'Create a Meta App at developers.facebook.com',
                        'Add WhatsApp product to your app',
                        'Copy your Phone Number ID and Access Token above',
                        'Set the Webhook URL in your Meta App settings',
                        'Use the Verify Token to verify the webhook',
                        'Click "Test Connection" to verify everything works',
                      ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-semibold mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ── Agents Tab (admin only) ── */}
          {isAdmin && (
            <TabsContent value="agents">
              <div className="max-w-3xl">
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Team Members ({agents.length})</h3>
                    <Button size="sm" className="gap-1.5" onClick={() => setShowAgentDialog(true)}>
                      <Plus className="w-4 h-4" />
                      Invite Agent
                    </Button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {agents.length === 0 ? (
                      <div className="px-5 py-8 text-center text-gray-400 text-sm">
                        No agents yet. Invite your team members.
                      </div>
                    ) : (
                      agents.map((agent) => (
                        <div key={agent.id} className="flex items-center gap-3 px-5 py-3">
                          <Avatar className="w-9 h-9">
                            <AvatarFallback
                              style={{ backgroundColor: getAvatarColor(agent.id) }}
                              className="text-white text-sm font-semibold"
                            >
                              {getInitials(agent.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{agent.name}</p>
                            <p className="text-xs text-gray-400">{agent.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full font-medium capitalize',
                              agent.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              agent.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-600'
                            )}>
                              {agent.role}
                            </span>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-full',
                              agent.status === 'online' ? 'bg-green-100 text-green-700' :
                              agent.status === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-500'
                            )}>
                              {agent.status}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => openEditAgent(agent)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setResettingPasswordFor(agent)}>
                                  <KeyRound className="w-4 h-4 mr-2" />
                                  Reset Password
                                </DropdownMenuItem>
                                {agent.id !== currentUser?.id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-red-600 focus:text-red-600"
                                      onClick={() => setAgentToRemove(agent)}
                                    >
                                      <UserX className="w-4 h-4 mr-2" />
                                      Remove
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ── Labels Tab (admin only) ── */}
          {isAdmin && (
            <TabsContent value="labels">
              <div className="max-w-2xl">
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Labels ({labels.length})</h3>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setEditingLabel(null); setLabelForm({ name: '', color: LABEL_COLORS[0] }); setShowLabelDialog(true) }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Label
                    </Button>
                  </div>
                  <div className="p-4">
                    {labels.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">No labels yet</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {labels.map((label) => (
                          <div key={label.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-sm font-medium group" style={{ backgroundColor: label.color }}>
                            {label.name}
                            <button
                              onClick={() => { setEditingLabel(label); setLabelForm({ name: label.name, color: label.color }); setShowLabelDialog(true) }}
                              className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-all"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteLabel(label.id)}
                              className="opacity-0 group-hover:opacity-100 hover:bg-white/20 rounded-full p-0.5 transition-all"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ── Canned Responses Tab (admin only) ── */}
          {isAdmin && (
            <TabsContent value="canned">
              <div className="max-w-3xl">
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Canned Responses ({cannedResponses.length})</h3>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => { setEditingCanned(null); setCannedForm({ shortcut: '', content: '' }); setShowCannedDialog(true) }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Response
                    </Button>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {cannedResponses.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-8">No canned responses yet. Create shortcuts for common replies.</p>
                    ) : (
                      cannedResponses.map((cr) => (
                        <div key={cr.id} className="flex items-start gap-3 px-5 py-3">
                          <span className="flex-shrink-0 text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-1 rounded mt-0.5">
                            /{cr.shortcut}
                          </span>
                          <p className="flex-1 text-sm text-gray-600 line-clamp-2">{cr.content}</p>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => { setEditingCanned(cr); setCannedForm({ shortcut: cr.shortcut, content: cr.content }); setShowCannedDialog(true) }}
                            >
                              <Edit className="w-3.5 h-3.5 text-gray-400" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleDeleteCanned(cr.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
          )}

          {/* ── Notifications Tab ── */}
          <TabsContent value="notifications">
            <div className="max-w-xl">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  {[
                    { label: 'New Message', desc: 'Notify when a new message arrives', defaultOn: true },
                    { label: 'New Conversation', desc: 'Notify when a new conversation starts', defaultOn: true },
                    { label: 'Conversation Assigned', desc: 'Notify when a conversation is assigned to you', defaultOn: true },
                    { label: 'Broadcast Completed', desc: 'Notify when a broadcast finishes sending', defaultOn: false },
                    { label: 'System Alerts', desc: 'Important system notifications', defaultOn: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-400">{item.desc}</p>
                      </div>
                      <Switch defaultChecked={item.defaultOn} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Invite Agent Dialog ── */}
      <Dialog open={showAgentDialog} onOpenChange={setShowAgentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Invite Agent</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input value={agentForm.name} onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={agentForm.email} onChange={(e) => setAgentForm({ ...agentForm, email: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={agentForm.role} onValueChange={(v) => setAgentForm({ ...agentForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAgentDialog(false)}>Cancel</Button>
            <Button onClick={handleInviteAgent} disabled={isInviting}>{isInviting ? 'Inviting...' : 'Invite'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invite Result Dialog ── */}
      <Dialog open={!!inviteResult} onOpenChange={(open) => { if (!open) setInviteResult(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Agent Invited</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Account created for <span className="font-medium">{inviteResult?.email}</span>. Share this temporary password with the agent.
            </p>
            <div>
              <Label>Temporary Password</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input value={inviteResult?.tempPassword ?? ''} readOnly className="font-mono bg-gray-50" />
                <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(inviteResult?.tempPassword ?? '')}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">This password will not be shown again. Copy it before closing.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setInviteResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Agent Dialog ── */}
      <Dialog open={!!editingAgent} onOpenChange={(open) => { if (!open) setEditingAgent(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Agent</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Name</Label>
              <Input
                value={editAgentForm.name}
                onChange={(e) => setEditAgentForm({ ...editAgentForm, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={editAgentForm.role} onValueChange={(v) => setEditAgentForm({ ...editAgentForm, role: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingAgent(null)}>Cancel</Button>
            <Button onClick={handleEditAgent} disabled={isEditingAgent}>{isEditingAgent ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Confirm Dialog ── */}
      <Dialog open={!!resettingPasswordFor} onOpenChange={(open) => { if (!open) setResettingPasswordFor(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600">
              Generate a new temporary password for <span className="font-medium">{resettingPasswordFor?.name}</span>? Their current password will be invalidated immediately.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResettingPasswordFor(null)}>Cancel</Button>
            <Button onClick={handleResetAgentPassword} disabled={isResettingPassword}>
              {isResettingPassword ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Result Dialog ── */}
      <Dialog open={!!passwordResetResult} onOpenChange={(open) => { if (!open) setPasswordResetResult(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Password Reset</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              New temporary password for <span className="font-medium">{passwordResetResult?.email}</span>:
            </p>
            <div className="flex items-center gap-2">
              <Input value={passwordResetResult?.tempPassword ?? ''} readOnly className="font-mono bg-gray-50" />
              <Button variant="outline" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => copyToClipboard(passwordResetResult?.tempPassword ?? '')}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">This password will not be shown again. Share it with the agent securely.</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setPasswordResetResult(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Remove Agent Confirm Dialog ── */}
      <Dialog open={!!agentToRemove} onOpenChange={(open) => { if (!open) setAgentToRemove(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Agent</DialogTitle></DialogHeader>
          <div className="py-2">
            <p className="text-sm text-gray-600">
              Remove <span className="font-medium">{agentToRemove?.name}</span> from the team? Their assigned conversations will be unassigned. This cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAgentToRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmRemoveAgent} disabled={isRemoving}>
              {isRemoving ? 'Removing...' : 'Remove Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Label Dialog ── */}
      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingLabel ? 'Edit Label' : 'New Label'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Label Name</Label>
              <Input value={labelForm.name} onChange={(e) => setLabelForm({ ...labelForm, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {LABEL_COLORS.map((color) => (
                  <button
                    key={color}
                    className={cn('w-8 h-8 rounded-full border-2 transition-all', labelForm.color === color ? 'border-gray-800 scale-110' : 'border-transparent')}
                    style={{ backgroundColor: color }}
                    onClick={() => setLabelForm({ ...labelForm, color })}
                  >
                    {labelForm.color === color && <Check className="w-4 h-4 text-white mx-auto" />}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 rounded-full" style={{ backgroundColor: labelForm.color }} />
                <span className="text-sm font-medium" style={{ color: labelForm.color }}>{labelForm.name || 'Preview'}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLabelDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveLabel} disabled={isSavingLabel}>{isSavingLabel ? 'Saving...' : editingLabel ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Canned Response Dialog ── */}
      <Dialog open={showCannedDialog} onOpenChange={setShowCannedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingCanned ? 'Edit Canned Response' : 'New Canned Response'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Shortcut</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">/</span>
                <Input
                  value={cannedForm.shortcut}
                  onChange={(e) => setCannedForm({ ...cannedForm, shortcut: e.target.value.replace(/\s+/g, '_').toLowerCase() })}
                  className="pl-6"
                  placeholder="greeting"
                />
              </div>
            </div>
            <div>
              <Label>Response</Label>
              <textarea
                value={cannedForm.content}
                onChange={(e) => setCannedForm({ ...cannedForm, content: e.target.value })}
                className="w-full mt-1 border rounded-md px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
                placeholder="Hello! How can I help you today?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCannedDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveCanned} disabled={isSavingCanned}>{isSavingCanned ? 'Saving...' : editingCanned ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

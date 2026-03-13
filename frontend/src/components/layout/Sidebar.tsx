'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  MessageCircle,
  Users,
  Radio,
  FileText,
  Zap,
  BarChart3,
  Settings,
  LogOut,
  Circle,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useInboxStore } from '@/store/inboxStore'
import { useAppStore } from '@/store/appStore'
import { authApi } from '@/lib/api'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials, getAvatarColor, getStatusColor } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

const navItems = [
  { href: '/inbox', label: 'Inbox', icon: MessageCircle },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/broadcasts', label: 'Broadcasts', icon: Radio },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/automations', label: 'Automations', icon: Zap },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const statusOptions = [
  { value: 'online', label: 'Online', color: '#10B981' },
  { value: 'busy', label: 'Busy', color: '#F59E0B' },
  { value: 'offline', label: 'Offline', color: '#9CA3AF' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, team, logout, updateUser } = useAuthStore()
  const { totalUnread } = useInboxStore()
  const { isConnected } = useAppStore()

  const handleStatusChange = async (status: string) => {
    try {
      await authApi.updateMe({ status: status as any })
      updateUser({ status: status as any })
    } catch {
      toast({ title: 'Failed to update status', variant: 'destructive' })
    }
  }

  const userInitials = getInitials(user?.name, user?.email)
  const avatarBg = getAvatarColor(user?.id || user?.email || '')

  return (
    <div className="flex flex-col w-64 h-screen bg-white border-r border-gray-100 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-center w-9 h-9 bg-primary-500 rounded-xl">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-gray-900 text-base leading-none">LotusWati</h1>
          <p className="text-xs text-gray-400 mt-0.5">WhatsApp Platform</p>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-2.5 border-b border-gray-100">
        <div className={cn(
          'flex items-center gap-2 text-xs px-3 py-1.5 rounded-full w-fit',
          isConnected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
        )}>
          {isConnected ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          {isConnected ? 'WhatsApp Connected' : 'Not Connected'}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showBadge = item.href === '/inbox' && totalUnread > 0

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )}
                >
                  <Icon className={cn(
                    'w-4.5 h-4.5 flex-shrink-0',
                    isActive ? 'text-primary-600' : 'text-gray-400'
                  )} size={18} />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="flex items-center justify-center min-w-[20px] h-5 px-1 bg-primary-500 text-white text-xs font-semibold rounded-full">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="px-3 py-3 border-t border-gray-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left">
              <div className="relative flex-shrink-0">
                <Avatar className="w-8 h-8">
                  {user?.avatar && <AvatarImage src={user.avatar} />}
                  <AvatarFallback
                    style={{ backgroundColor: avatarBg }}
                    className="text-white text-xs font-semibold"
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white"
                  style={{ backgroundColor: getStatusColor(user?.status || 'offline') }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || user?.email}
                </p>
                <p className="text-xs text-gray-400 capitalize">{user?.status || 'offline'}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52">
            <DropdownMenuLabel className="text-xs text-gray-400 font-normal">
              {user?.email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Set Status</DropdownMenuLabel>
            {statusOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleStatusChange(opt.value)}
                className="gap-2"
              >
                <Circle
                  className="w-3 h-3 fill-current"
                  style={{ color: opt.color }}
                />
                {opt.label}
                {user?.status === opt.value && (
                  <span className="ml-auto text-xs text-gray-400">Active</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="text-red-600 gap-2">
              <LogOut className="w-4 h-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {team && (
          <p className="text-xs text-gray-400 px-3 mt-1 truncate">{team.name}</p>
        )}
      </div>
    </div>
  )
}

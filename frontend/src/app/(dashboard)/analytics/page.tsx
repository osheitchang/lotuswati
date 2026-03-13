'use client'

import { useState, useEffect } from 'react'
import { sub, format } from 'date-fns'
import {
  MessageSquare,
  Users,
  CheckCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Send,
  BarChart3,
} from 'lucide-react'
import { analyticsApi } from '@/lib/api'
import { AnalyticsOverview } from '@/types'
import {
  ConversationVolumeChart,
  MessageVolumeChart,
  LabelDistributionChart,
  AgentPerformanceChart,
  ResponseTimeChart,
} from '@/components/analytics/Charts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '14 days', days: 14 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function formatDuration(minutes: number): string {
  if (!minutes) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function AnalyticsPage() {
  const [selectedDays, setSelectedDays] = useState(7)
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null)
  const [convData, setConvData] = useState<any[]>([])
  const [msgData, setMsgData] = useState<any[]>([])
  const [labelData, setLabelData] = useState<any[]>([])
  const [agentData, setAgentData] = useState<any[]>([])
  const [rtData, setRtData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async (days: number) => {
    setIsLoading(true)
    const from = format(sub(new Date(), { days }), 'yyyy-MM-dd')
    const to = format(new Date(), 'yyyy-MM-dd')
    const params = { from, to }

    try {
      const [overviewRes, convRes, agentRes, labelRes, rtRes] = await Promise.allSettled([
        analyticsApi.overview(params),
        analyticsApi.conversations({ ...params, groupBy: 'day' }),
        analyticsApi.agents(params),
        analyticsApi.labels(params),
        analyticsApi.responseTimes(params),
      ])

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data.overview || overviewRes.value.data)
      }
      if (convRes.status === 'fulfilled') {
        const data = convRes.value.data.data || convRes.value.data || []
        setConvData(data)
        // Build message data from conv data
        setMsgData(data.map((d: any) => ({
          date: d.date,
          sent: d.sent || Math.floor((d.count || 0) * 1.5),
          received: d.received || d.count || 0,
        })))
      }
      if (agentRes.status === 'fulfilled') {
        setAgentData(agentRes.value.data.agents || agentRes.value.data || [])
      }
      if (labelRes.status === 'fulfilled') {
        setLabelData(labelRes.value.data.labels || labelRes.value.data || [])
      }
      if (rtRes.status === 'fulfilled') {
        setRtData(rtRes.value.data.data || rtRes.value.data || [])
      }
    } catch {
      toast({ title: 'Failed to load analytics', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedDays)
  }, [selectedDays])

  const statsCards = [
    {
      label: 'Total Conversations',
      value: overview?.totalConversations ?? '—',
      icon: MessageSquare,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      trend: null,
    },
    {
      label: 'Open Conversations',
      value: overview?.openConversations ?? '—',
      icon: MessageSquare,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      trend: null,
    },
    {
      label: 'Resolved Today',
      value: overview?.resolvedToday ?? '—',
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      trend: null,
    },
    {
      label: 'Avg Response Time',
      value: overview?.avgResponseTime !== undefined ? formatDuration(overview.avgResponseTime) : '—',
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      trend: null,
    },
    {
      label: 'Total Contacts',
      value: overview?.totalContacts ?? '—',
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      trend: null,
    },
    {
      label: 'Messages Today',
      value: overview?.messagesSentToday ?? '—',
      icon: Send,
      color: 'text-pink-600',
      bg: 'bg-pink-50',
      trend: null,
    },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Track your team's performance</p>
          </div>
          {/* Date range picker */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setSelectedDays(range.days)}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
                  selectedDays === range.days
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {statsCards.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', stat.bg)}>
                <stat.icon className={cn('w-4.5 h-4.5', stat.color)} size={18} />
              </div>
              {isLoading ? (
                <div className="h-7 w-16 bg-gray-100 rounded animate-pulse mb-1" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              )}
              <p className="text-xs text-gray-500 mt-0.5 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {isLoading ? (
            <>
              <div className="h-72 bg-white rounded-xl border border-gray-100 animate-pulse" />
              <div className="h-72 bg-white rounded-xl border border-gray-100 animate-pulse" />
            </>
          ) : (
            <>
              <ConversationVolumeChart data={convData} />
              <MessageVolumeChart data={msgData} />
            </>
          )}
        </div>

        {/* Charts row 2 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {isLoading ? (
            <>
              <div className="h-72 bg-white rounded-xl border border-gray-100 animate-pulse" />
              <div className="h-72 bg-white rounded-xl border border-gray-100 animate-pulse" />
              <div className="h-72 bg-white rounded-xl border border-gray-100 animate-pulse" />
            </>
          ) : (
            <>
              <LabelDistributionChart data={labelData} />
              <AgentPerformanceChart data={agentData} />
              <ResponseTimeChart data={rtData} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

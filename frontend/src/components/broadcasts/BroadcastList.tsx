'use client'

import { useState, useEffect } from 'react'
import { Plus, Radio, Trash2, Send, TrendingUp, TrendingDown, Users } from 'lucide-react'
import { broadcastsApi } from '@/lib/api'
import { Broadcast } from '@/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { CreateBroadcastModal } from './CreateBroadcastModal'
import { cn, formatDate, getBroadcastStatusColor } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

export function BroadcastList() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadBroadcasts = async () => {
    setIsLoading(true)
    try {
      const response = await broadcastsApi.list()
      setBroadcasts(response.data.broadcasts || response.data || [])
    } catch {
      toast({ title: 'Failed to load broadcasts', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadBroadcasts()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this broadcast?')) return
    try {
      await broadcastsApi.delete(id)
      toast({ title: 'Broadcast deleted' })
      loadBroadcasts()
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' })
    }
  }

  const totalSent = broadcasts.reduce((s, b) => s + b.sentCount, 0)
  const totalDelivered = broadcasts.reduce((s, b) => s + b.deliveredCount, 0)
  const totalFailed = broadcasts.reduce((s, b) => s + b.failedCount, 0)
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Broadcasts</h1>
            <p className="text-sm text-gray-500 mt-0.5">Send bulk messages to your contacts</p>
          </div>
          <Button className="gap-1.5" onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            Create Broadcast
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          {[
            { label: 'Total Sent', value: totalSent, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Delivery Rate', value: `${deliveryRate}%`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Failed', value: totalFailed, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.bg)}>
                <stat.icon className={cn('w-5 h-5', stat.color)} />
              </div>
              <div>
                <p className="text-xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />
          ))
        ) : broadcasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Radio className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium">No broadcasts yet</p>
            <p className="text-gray-400 text-sm mt-1">Create your first broadcast campaign</p>
            <Button className="mt-4" onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Broadcast
            </Button>
          </div>
        ) : (
          broadcasts.map((broadcast) => {
            const deliveryPct = broadcast.totalCount > 0
              ? Math.round((broadcast.deliveredCount / broadcast.totalCount) * 100)
              : 0
            const sentPct = broadcast.totalCount > 0
              ? Math.round((broadcast.sentCount / broadcast.totalCount) * 100)
              : 0

            return (
              <div key={broadcast.id} className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{broadcast.name}</h3>
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', getBroadcastStatusColor(broadcast.status))}>
                        {broadcast.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Created {formatDate(broadcast.createdAt)}
                      {broadcast.scheduledAt && ` · Scheduled for ${formatDate(broadcast.scheduledAt)}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={() => handleDelete(broadcast.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3 text-center mb-3">
                  {[
                    { label: 'Total', value: broadcast.totalCount },
                    { label: 'Sent', value: broadcast.sentCount, color: 'text-blue-600' },
                    { label: 'Delivered', value: broadcast.deliveredCount, color: 'text-green-600' },
                    { label: 'Failed', value: broadcast.failedCount, color: 'text-red-500' },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className={cn('text-lg font-semibold text-gray-800', s.color)}>{s.value}</p>
                      <p className="text-xs text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Progress */}
                {broadcast.totalCount > 0 && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Delivery Progress</span>
                      <span>{deliveryPct}%</span>
                    </div>
                    <Progress value={deliveryPct} className="h-1.5" />
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <CreateBroadcastModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={loadBroadcasts}
      />
    </div>
  )
}

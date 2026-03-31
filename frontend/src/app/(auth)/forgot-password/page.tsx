'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { MessageCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError('Email is required')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      await authApi.forgotPassword(email)
      setSubmitted(true)
    } catch {
      // Always show success to prevent email enumeration
      setSubmitted(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-500 rounded-2xl mb-4 shadow-lg">
            <MessageCircle className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">LotusWati</h1>
          <p className="text-gray-500 mt-1">WhatsApp Business Platform</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Check your inbox</h2>
              <p className="text-sm text-gray-500">
                If <span className="font-medium text-gray-700">{email}</span> is registered, a password reset link has been sent. Check the server logs if you're in development.
              </p>
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 font-medium hover:underline mt-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to sign in
              </a>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Forgot your password?</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your email and we'll send you a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1"
                    autoFocus
                  />
                  {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                </div>

                <Button type="submit" className="w-full h-10" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <a
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to sign in
                </a>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by WhatsApp Business API
        </p>
      </div>
    </div>
  )
}

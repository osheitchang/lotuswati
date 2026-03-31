'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { authApi } from '@/lib/api'
import { MessageCircle, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setError('No reset token found. Please request a new reset link.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (!token) {
      setError('No reset token found. Please request a new reset link.')
      return
    }

    setIsLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setSuccess(true)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password. The link may have expired.')
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
          {success ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Password updated</h2>
              <p className="text-sm text-gray-500">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <Button className="w-full mt-2" onClick={() => router.push('/login')}>
                Sign In
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Set new password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Choose a strong password for your account.
                </p>
              </div>

              {!token && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-800">
                    Invalid reset link. Please{' '}
                    <a href="/forgot-password" className="underline font-medium">request a new one</a>.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      disabled={!token}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Repeat your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1"
                    disabled={!token}
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800">{error}</p>
                  </div>
                )}

                <Button type="submit" className="w-full h-10" disabled={isLoading || !token}>
                  {isLoading ? 'Updating...' : 'Reset Password'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-100 text-center">
                <a href="/login" className="text-sm text-gray-600 hover:text-primary-600">
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}

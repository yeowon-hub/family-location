import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Household } from '@/types'

const ACTIVE_HOUSEHOLD_KEY = 'family_location_active_household_id'

function getErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: string; details?: string; hint?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length > 0) return parts.join(' — ')
  }
  if (err instanceof Error) return err.message
  return '가족 기능 오류가 발생했습니다'
}

function parseRpcHousehold(data: unknown): Record<string, unknown> | null {
  if (!data) return null
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as Record<string, unknown>
    } catch {
      return null
    }
  }
  if (typeof data === 'object') return data as Record<string, unknown>
  return null
}

interface HouseholdContextValue {
  household: Household | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createHousehold: (name: string) => Promise<Household | null>
  joinHousehold: (code: string) => Promise<Household | null>
  clearError: () => void
}

const HouseholdContext = createContext<HouseholdContextValue | null>(null)

function parseHousehold(data: Record<string, unknown>): Household {
  return {
    id: data.id as string,
    name: data.name as string,
    inviteCode: data.invite_code as string,
    role: data.role as Household['role'],
    memberCount: (data.member_count as number) ?? 1,
  }
}

export function HouseholdProvider({ user, children }: { user: User | null; children: React.ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null)
  const [loading, setLoading] = useState(Boolean(user))
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !user) {
      setHousehold(null)
      return
    }

    setLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_household')
      if (rpcError) throw rpcError

      if (data) {
        const row = parseRpcHousehold(data)
        if (row) {
          const parsed = parseHousehold(row)
          setHousehold(parsed)
          localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, parsed.id)
        } else {
          setHousehold(null)
          localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY)
        }
      } else {
        setHousehold(null)
        localStorage.removeItem(ACTIVE_HOUSEHOLD_KEY)
      }
    } catch (err) {
      console.error('Household fetch error:', err)
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createHousehold = useCallback(
    async (name: string) => {
      if (!supabase || !user) {
        setError('로그인이 필요합니다.')
        return null
      }
      setError(null)
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('create_household', {
          household_name: name.trim() || '우리 집',
        })
        if (rpcError) throw rpcError
        const row = parseRpcHousehold(data)
        if (!row) {
          setError('가족 정보를 받지 못했습니다.')
          return null
        }

        const parsed = parseHousehold(row)
        setHousehold(parsed)
        localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, parsed.id)
        return parsed
      } catch (err) {
        setError(getErrorMessage(err))
        return null
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  const joinHousehold = useCallback(
    async (code: string) => {
      if (!supabase || !user) return null
      setError(null)
      setLoading(true)
      try {
        const { data, error: rpcError } = await supabase.rpc('join_household', { code: code.trim() })
        if (rpcError) throw rpcError
        const row = parseRpcHousehold(data)
        if (!row) {
          setError('가족 정보를 받지 못했습니다.')
          return null
        }

        const parsed = parseHousehold(row)
        setHousehold(parsed)
        localStorage.setItem(ACTIVE_HOUSEHOLD_KEY, parsed.id)
        return parsed
      } catch (err) {
        setError(getErrorMessage(err))
        return null
      } finally {
        setLoading(false)
      }
    },
    [user],
  )

  const clearError = useCallback(() => setError(null), [])

  return (
    <HouseholdContext.Provider
      value={{ household, loading, error, refresh, createHousehold, joinHousehold, clearError }}
    >
      {children}
    </HouseholdContext.Provider>
  )
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext)
  if (!ctx) {
    throw new Error('useHousehold must be used within HouseholdProvider')
  }
  return ctx
}

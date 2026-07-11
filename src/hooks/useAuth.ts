import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, getRedirectUrl } from '@/lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다')
    return supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getRedirectUrl() },
    })
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다')
    return supabase.auth.signInWithPassword({ email, password })
  }

  const signInWithKakao = async () => {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다')
    return supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: getRedirectUrl(),
        scopes: 'profile_nickname profile_image',
      },
    })
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return { user, session, loading, signUp, signIn, signInWithKakao, signOut, isConfigured: isSupabaseConfigured }
}

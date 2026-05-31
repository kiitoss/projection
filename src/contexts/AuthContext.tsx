import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  authorized: boolean | null
  role: 'user' | 'admin' | null
  setAuthorized: (v: boolean) => void
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [role, setRole] = useState<'user' | 'admin' | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session) {
        setAuthorized(null)
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) {
      setAuthorized(null)
      setRole(null)
      return
    }
    supabase
      .from('user_settings')
      .select('authorized, role')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error('[AuthContext] user_settings fetch error:', error.message)
          return // garde authorized=null → spinner, pas /invite
        }
        setAuthorized(data?.authorized ?? false)
        setRole(data?.role ?? 'user')
      })
  }, [user])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
  }

  async function signOut() {
    await supabase.auth.signOut()
    setAuthorized(null)
    setRole(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, authorized, role, setAuthorized, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

import { useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return <SetupRequired />
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0f0f0f] text-fg-dim">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <SignIn />
  }

  return <>{children}</>
}

function TrakrMark() {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-[#333] bg-bg">
        <span className="text-[42px] font-extrabold leading-none text-white">
          T
        </span>
      </div>
      <div className="text-center">
        <div className="text-[26px] font-extrabold tracking-[0.14em] text-white">
          TRAKR
        </div>
        <div className="mt-1 text-[9px] tracking-[0.28em] text-fg-faint">
          HEALTH OS
        </div>
      </div>
    </div>
  )
}

function SignIn() {
  const [signing, setSigning] = useState(false)

  async function signIn() {
    setSigning(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      console.error('Sign in error:', error)
      setSigning(false)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#0f0f0f]">
      <TrakrMark />
      <button
        type="button"
        onClick={signIn}
        disabled={signing}
        className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-xl border-none bg-white px-6 py-3.5 text-[15px] font-semibold text-[#111] transition disabled:opacity-50"
      >
        <GoogleIcon />
        {signing ? 'Opening Google…' : 'Sign in with Google'}
      </button>
    </div>
  )
}

function SetupRequired() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#0f0f0f] px-6">
      <TrakrMark />
      <div className="max-w-md text-center text-sm leading-relaxed text-fg-muted">
        <div className="mb-2 text-[9px] tracking-[0.28em] text-accent-pink">
          SETUP REQUIRED
        </div>
        Supabase env vars are missing. Copy{' '}
        <code className="rounded bg-bg px-1.5 py-0.5 text-accent-cyan">
          web/.env.local.example
        </code>{' '}
        to{' '}
        <code className="rounded bg-bg px-1.5 py-0.5 text-accent-cyan">
          web/.env.local
        </code>{' '}
        and fill in your Supabase URL and anon key, then restart the dev server.
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { testGeminiKey } from '@/lib/gemini'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { toast } from '@/store/useAppStore'
import type { UserSettings } from '@/types'

export function SettingsPage() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)

  // Invite code (admin only)
  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [generatingCode, setGeneratingCode] = useState(false)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSettings = useCallback(async () => {
    if (!user) return

    let { data: settingsData } = await supabase
      .from('user_settings')
      .select('user_id, theme, role, invited_by')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!settingsData) {
      const { data: created } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id })
        .select('user_id, theme, role, invited_by')
        .single()
      settingsData = created
    }

    if (settingsData) {
      const { data: key } = await supabase.rpc('get_gemini_key')
      setSettings({ ...settingsData, gemini_api_key: key } as UserSettings)
      setApiKey(key ?? '')
    }
  }, [user])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  function startCountdown(expiresAt: string) {
    if (countdownRef.current) clearInterval(countdownRef.current)
    countdownRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining === 0) {
        setInviteCode(null)
        if (countdownRef.current) clearInterval(countdownRef.current)
      }
    }, 1000)
  }

  useEffect(() => () => { if (countdownRef.current) clearInterval(countdownRef.current) }, [])

  async function generateCode() {
    if (!user) return
    setGeneratingCode(true)

    // Supprimer les codes existants non utilisés de cet admin
    await supabase.from('invite_codes').delete().eq('created_by', user.id).is('used_by', null)

    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 30000).toISOString()

    const { error } = await supabase.from('invite_codes').insert({ code, created_by: user.id, expires_at: expiresAt })
    setGeneratingCode(false)

    if (error) {
      toast.error(t('settings.inviteCode.error'))
      return
    }

    setInviteCode(code)
    startCountdown(expiresAt)
  }

  async function saveApiKey() {
    if (!user) return
    await supabase.rpc('save_gemini_key', { key: apiKey || null })
    toast.success(t('settings.gemini.keySaved'))
    setKeyValid(null)
  }

  async function handleTestKey() {
    if (!apiKey) return
    setTestingKey(true)
    setKeyValid(null)
    const valid = await testGeminiKey(apiKey)
    setKeyValid(valid)
    setTestingKey(false)
    if (valid) toast.success(t('settings.gemini.keyValid'))
    else toast.error(t('settings.gemini.keyInvalid'))
  }

  async function saveTheme(theme: 'light' | 'dark' | 'system') {
    if (!user) return
    await supabase.from('user_settings').update({ theme }).eq('user_id', user.id)
    setSettings((s) => s ? { ...s, theme } : s)
    localStorage.setItem('projection-theme', theme)
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" className="text-indigo-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
        >
          <ChevronLeft size={16} />
          {t('settings.back')}
        </button>
        <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('settings.title')}</h1>
      </div>

      <div className="mx-auto max-w-xl p-6 flex flex-col gap-8">
        <Section title={t('settings.gemini.title')}>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setKeyValid(null) }}
                onBlur={saveApiKey}
                placeholder={t('settings.gemini.placeholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 pr-9 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button variant="secondary" size="md" onClick={handleTestKey} loading={testingKey} disabled={!apiKey}>
              {t('settings.gemini.test')}
            </Button>
          </div>

          {keyValid === true && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle size={14} /> {t('settings.gemini.valid')}
            </p>
          )}
          {keyValid === false && (
            <p className="flex items-center gap-1.5 text-sm text-red-500">
              <XCircle size={14} /> {t('settings.gemini.invalid')}
            </p>
          )}
          <p className="text-xs text-slate-400">
            {t('settings.gemini.info')}{' '}
            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-indigo-500 hover:underline">
              {t('settings.gemini.studioLink')}
            </a>
            .
          </p>
        </Section>

        <Section title={t('settings.theme.title')}>
          <div className="flex gap-2">
            {(['system', 'light', 'dark'] as const).map((themeOption) => (
              <button
                key={themeOption}
                onClick={() => saveTheme(themeOption)}
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors cursor-pointer ${
                  settings.theme === themeOption
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {t(`settings.theme.${themeOption}`)}
              </button>
            ))}
          </div>
        </Section>

        {role === 'admin' && (
          <Section title={t('settings.inviteCode.title')}>
            {inviteCode ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <div className="text-5xl font-mono font-bold tracking-widest text-indigo-600 dark:text-indigo-400 select-all">
                  {inviteCode}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t('settings.inviteCode.expiresIn', { seconds: countdown })}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.inviteCode.description')}</p>
                <Button variant="secondary" onClick={generateCode} loading={generatingCode}>
                  {t('settings.inviteCode.generate')}
                </Button>
              </>
            )}
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

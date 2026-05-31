import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { toast } from '@/store/useAppStore'

export function InvitePage() {
  const { user, authorized, setAuthorized, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (authorized === true) navigate('/', { replace: true })
  }, [authorized, navigate])

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
    setCode(val)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 6 || !user) return
    setSubmitting(true)

    // 1. Trouver un code valide correspondant
    const { data: codeRow } = await supabase
      .from('invite_codes')
      .select('id')
      .eq('code', code)
      .is('used_by', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle()

    if (!codeRow) {
      toast.error(t('invite.invalidCode'))
      setSubmitting(false)
      return
    }

    // 2. Réclamer le code — le trigger autorise le user + enregistre le parrain
    const { error } = await supabase
      .from('invite_codes')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', codeRow.id)
      .is('used_by', null)

    setSubmitting(false)
    if (error) {
      toast.error(t('invite.invalidCode'))
      return
    }

    setAuthorized(true)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Projection</h1>
        <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">{t('invite.subtitle')}</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={handleCodeChange}
            placeholder={t('invite.placeholder')}
            autoFocus
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-3 text-center text-2xl font-mono tracking-widest text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={code.length !== 6} className="w-full">
            {t('invite.submit')}
          </Button>
        </form>
        <button onClick={signOut} className="mt-4 w-full cursor-pointer text-center text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          {t('invite.signOut')}
        </button>
      </div>
    </div>
  )
}

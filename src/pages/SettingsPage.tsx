import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Eye, EyeOff, CheckCircle, XCircle, Trash2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { testGeminiKey } from '@/lib/gemini'
import { useAuth } from '@/contexts/AuthContext'
import { useTags } from '@/hooks/useTags'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/useAppStore'
import type { UserSettings } from '@/types'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#f43f5e',
]

export function SettingsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { tags, createTag, updateTag, deleteTag } = useTags()
  const { t } = useTranslation()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [keyValid, setKeyValid] = useState<boolean | null>(null)
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editTagName, setEditTagName] = useState('')
  const [editTagColor, setEditTagColor] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [showNewTag, setShowNewTag] = useState(false)

  const fetchSettings = useCallback(async () => {
    if (!user) return
    let { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!data) {
      const { data: created } = await supabase
        .from('user_settings')
        .insert({ user_id: user.id })
        .select()
        .single()
      data = created
    }

    if (data) {
      setSettings(data as UserSettings)
      setApiKey(data.gemini_api_key ?? '')
    }
  }, [user])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  async function saveApiKey() {
    if (!user) return
    await supabase
      .from('user_settings')
      .update({ gemini_api_key: apiKey || null })
      .eq('user_id', user.id)
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

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    await createTag(newTagName.trim(), newTagColor)
    setNewTagName('')
    setNewTagColor(TAG_COLORS[0])
    setShowNewTag(false)
  }

  async function handleSaveTagEdit(id: string) {
    await updateTag(id, { name: editTagName.trim(), color: editTagColor })
    setEditingTag(null)
  }

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" className="text-indigo-500" />
      </div>
    )
  }

  const tagToDelete = tags.find((tag) => tag.id === confirmDeleteTag)

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
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
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <Button
              variant="secondary"
              size="md"
              onClick={handleTestKey}
              loading={testingKey}
              disabled={!apiKey}
            >
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
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-500 hover:underline"
            >
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
                className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
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

        <Section title={t('settings.tags.title')}>
          <div className="flex flex-col gap-2">
            {tags.map((tag) => (
              <div key={tag.id} className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                {editingTag === tag.id ? (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {TAG_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditTagColor(c)}
                          className="h-4 w-4 rounded-full"
                          style={{
                            backgroundColor: c,
                            outline: editTagColor === c ? `2px solid ${c}` : 'none',
                            outlineOffset: '1px',
                          }}
                        />
                      ))}
                    </div>
                    <input
                      autoFocus
                      value={editTagName}
                      onChange={(e) => setEditTagName(e.target.value)}
                      className="flex-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-2 py-0.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <Button size="sm" variant="primary" onClick={() => handleSaveTagEdit(tag.id)}>{t('settings.tags.ok')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingTag(null)}>{t('settings.tags.close')}</Button>
                  </>
                ) : (
                  <>
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200">{tag.name}</span>
                    <button
                      onClick={() => {
                        setEditingTag(tag.id)
                        setEditTagName(tag.name)
                        setEditTagColor(tag.color)
                      }}
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTag(tag.id)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {showNewTag ? (
              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
                <div className="flex flex-wrap gap-1.5">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className="h-5 w-5 rounded-full"
                      style={{
                        backgroundColor: c,
                        outline: newTagColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                </div>
                <input
                  autoFocus
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={t('settings.tags.namePlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                    {t('settings.tags.create')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewTag(false)}>{t('common.cancel')}</Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTag(true)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                {t('settings.tags.createTag')}
              </button>
            )}
          </div>
        </Section>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteTag}
        onClose={() => setConfirmDeleteTag(null)}
        onConfirm={() => { deleteTag(confirmDeleteTag!); setConfirmDeleteTag(null) }}
        title={t('settings.tags.deleteTitle', { name: tagToDelete?.name })}
        description={t('settings.tags.deleteDescription')}
        confirmLabel={t('common.delete')}
      />
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

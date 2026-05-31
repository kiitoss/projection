import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { formatRelativeDate } from '@/lib/utils'
import { toast } from '@/store/useAppStore'
import type { Tab } from '@/types'

interface ChaosTabProps {
  tab: Tab
}

export function ChaosTab({ tab }: ChaosTabProps) {
  const [content, setContent] = useState('')
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { t } = useTranslation()

  const { data: chaosData } = useQuery({
    queryKey: ['chaos', tab.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chaos_content')
        .select('*')
        .eq('tab_id', tab.id)
        .maybeSingle()
      if (error) toast.error(t('toasts.saveError'))
      return data
    },
  })

  useEffect(() => {
    if (chaosData) {
      setContent(chaosData.content)
      setUpdatedAt(chaosData.updated_at)
    }
  }, [chaosData])

  function handleChange(value: string) {
    setContent(value)
    setSaving(true)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from('chaos_content')
        .update({ content: value })
        .eq('tab_id', tab.id)
        .select('updated_at')
        .maybeSingle()
      if (error) toast.error(t('toasts.saveError'))
      if (data) setUpdatedAt(data.updated_at)
      setSaving(false)
    }, 1000)
  }

  return (
    <div className="flex flex-col h-full">
      <textarea
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={t('chaosTab.placeholder')}
        className="flex-1 w-full resize-none bg-transparent px-6 py-6 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 focus:outline-none leading-relaxed"
        style={{ minHeight: '60vh' }}
      />
      <div className="flex items-center justify-end border-t border-slate-100 dark:border-slate-800 px-6 py-2">
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {saving
            ? t('chaosTab.saving')
            : updatedAt
            ? t('chaosTab.lastModified', { date: formatRelativeDate(updatedAt) })
            : ''}
        </span>
      </div>
    </div>
  )
}

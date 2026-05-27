import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { generateWithGemini } from '@/lib/gemini'
import { formatDate } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { toast } from '@/store/useAppStore'
import type { DigestGenerated, DigestTabConfig, Tab } from '@/types'

interface DigestTabProps {
  tab: Tab
  onUpdateTab: (updates: Partial<Tab>) => Promise<void>
}

export function DigestTab({ tab, onUpdateTab }: DigestTabProps) {
  const { t } = useTranslation()
  const config = tab.config as unknown as DigestTabConfig
  const chaosTabIds: string[] = config?.chaos_tab_ids ?? []
  const defaultPrompt = t('digestTab.defaultPrompt')
  const prompt = config?.prompt ?? defaultPrompt

  const [generated, setGenerated] = useState<DigestGenerated | null>(null)
  const [generating, setGenerating] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [editPrompt, setEditPrompt] = useState(prompt)
  const [chaosTabs, setChaosTabs] = useState<{ id: string; title: string }[]>([])

  const fetchData = useCallback(async () => {
    const { data: gen } = await supabase
      .from('digest_generated')
      .select('*')
      .eq('tab_id', tab.id)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()
    setGenerated(gen as DigestGenerated | null)

    if (chaosTabIds.length > 0) {
      const { data: tabs } = await supabase
        .from('tabs')
        .select('id, title')
        .in('id', chaosTabIds)
      setChaosTabs((tabs as { id: string; title: string }[]) ?? [])
    }
  }, [tab.id, chaosTabIds.join(',')])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (!generated) setPromptOpen(true) }, [generated])

  async function handleGenerate() {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('gemini_api_key')
      .single()

    if (!settings?.gemini_api_key) {
      toast.error(t('digestTab.noKeyError'), true)
      return
    }

    const { data: chaosRows } = await supabase
      .from('chaos_content')
      .select('content, tab_id')
      .in('tab_id', chaosTabIds)

    const context = (chaosRows ?? [])
      .map((row: { content: string; tab_id: string }) => {
        const tabName = chaosTabs.find((ct) => ct.id === row.tab_id)?.title ?? 'Chaos'
        return `## ${tabName}\n\n${row.content}`
      })
      .join('\n\n---\n\n')

    if (!context.trim()) {
      toast.error(t('digestTab.emptyContextError'))
      return
    }

    setGenerating(true)
    try {
      const content = await generateWithGemini(settings.gemini_api_key, editPrompt, context)
      const { data: gen } = await supabase
        .from('digest_generated')
        .insert({ tab_id: tab.id, content, prompt_used: editPrompt })
        .select()
        .single()
      if (gen) setGenerated(gen as DigestGenerated)
      setPromptOpen(false)
      toast.success(t('digestTab.generated'))
    } catch {
      toast.error(t('digestTab.generateError'), true)
    }
    setGenerating(false)
  }

  async function savePrompt(newPrompt: string) {
    setEditPrompt(newPrompt)
    await onUpdateTab({ config: { ...tab.config, prompt: newPrompt } })
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-2xl">
      {chaosTabs.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-slate-500 dark:text-slate-400 self-center">{t('digestTab.sources')}</span>
          {chaosTabs.map((ct) => (
            <span
              key={ct.id}
              className="rounded-full bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-300"
            >
              {ct.title}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <button
          onClick={() => setPromptOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span className="flex items-center gap-2">
            {promptOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            {t('digestTab.prompt')}
          </span>
          {generated && (
            <span className="text-xs font-normal text-slate-400">
              {t('digestTab.lastGenerated', { date: formatDate(generated.generated_at) })}
            </span>
          )}
        </button>

        {promptOpen && (
          <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
            <textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              onBlur={() => savePrompt(editPrompt)}
              rows={5}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleGenerate}
              loading={generating}
              disabled={chaosTabIds.length === 0}
              className="self-start"
            >
              <Zap size={14} />
              {generating ? t('digestTab.generating') : t('digestTab.generate')}
            </Button>
          </div>
        )}
      </div>

      {generating && (
        <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
          <Spinner size="sm" className="text-indigo-500" />
          {t('digestTab.generatingMessage')}
        </div>
      )}

      {generated && !generating && (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownRenderer content={generated.content} />
        </div>
      )}

      {!generated && !generating && (
        <p className="text-sm text-slate-400 dark:text-slate-500">
          {t('digestTab.emptyState')}
        </p>
      )}
    </div>
  )
}

function MarkdownRenderer({ content }: { content: string }) {
  const html = content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-900 dark:text-slate-100 mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 text-slate-700 dark:text-slate-200">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 text-slate-700 dark:text-slate-200">$2</li>')
    .replace(/\n\n/g, '</p><p class="text-slate-700 dark:text-slate-200 mb-3">')

  return (
    <div
      className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
      dangerouslySetInnerHTML={{ __html: `<p class="text-slate-700 dark:text-slate-200 mb-3">${html}</p>` }}
    />
  )
}

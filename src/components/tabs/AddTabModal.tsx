import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Tab, TabType } from '@/types'

interface AddTabModalProps {
  open: boolean
  onClose: () => void
  onAdd: (type: TabType, title: string, config: Record<string, unknown>) => Promise<unknown>
  existingTabs: Tab[]
}

export function AddTabModal({ open, onClose, onAdd, existingTabs }: AddTabModalProps) {
  const [selected, setSelected] = useState<TabType | null>(null)
  const [title, setTitle] = useState('')
  const [selectedChaosIds, setSelectedChaosIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  const hasTodo = existingTabs.some((tab) => tab.type === 'todo')
  const hasWidgets = existingTabs.some((tab) => tab.type === 'widgets')
  const chaosTabs = existingTabs.filter((tab) => tab.type === 'chaos')
  const hasChaos = chaosTabs.length > 0

  const tabTypes = [
    { type: 'todo' as TabType, label: t('addTab.types.todo.label'), description: t('addTab.types.todo.description') },
    { type: 'chaos' as TabType, label: t('addTab.types.chaos.label'), description: t('addTab.types.chaos.description') },
    { type: 'digest' as TabType, label: t('addTab.types.digest.label'), description: t('addTab.types.digest.description') },
    { type: 'widgets' as TabType, label: t('addTab.types.widgets.label'), description: t('addTab.types.widgets.description') },
  ]

  function isDisabled(type: TabType) {
    if (type === 'todo') return hasTodo
    if (type === 'widgets') return hasWidgets
    if (type === 'digest') return !hasChaos
    return false
  }

  function disabledReason(type: TabType) {
    if (type === 'todo') return t('addTab.todoExists')
    if (type === 'widgets') return t('addTab.widgetsExists')
    if (type === 'digest') return t('addTab.noChaos')
    return ''
  }

  function defaultTitle(type: TabType) {
    if (type === 'chaos') return `${t('addTab.types.chaos.label')} ${existingTabs.filter((tab) => tab.type === 'chaos').length + 1}`
    if (type === 'digest') return `${t('addTab.types.digest.label')} ${existingTabs.filter((tab) => tab.type === 'digest').length + 1}`
    return tabTypes.find((opt) => opt.type === type)?.label ?? type
  }

  function handleSelect(type: TabType) {
    if (isDisabled(type)) return
    setSelected(type)
    setTitle(defaultTitle(type))
    setSelectedChaosIds([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    if (selected === 'digest' && selectedChaosIds.length === 0) return
    setLoading(true)

    const config: Record<string, unknown> = {}
    if (selected === 'todo') config.max_on_card = 5
    if (selected === 'digest') {
      config.chaos_tab_ids = selectedChaosIds
      config.prompt = t('digestTab.defaultPrompt')
    }

    await onAdd(selected, title.trim() || defaultTitle(selected), config)
    setLoading(false)
    handleClose()
  }

  function handleClose() {
    setSelected(null)
    setTitle('')
    setSelectedChaosIds([])
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('addTab.title')} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {tabTypes.map((opt) => {
            const disabled = isDisabled(opt.type)
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => handleSelect(opt.type)}
                disabled={disabled}
                title={disabled ? disabledReason(opt.type) : undefined}
                className={cn(
                  'flex flex-col items-start rounded-xl border p-3 text-left text-sm transition-colors',
                  disabled
                    ? 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : selected === opt.type
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                    : 'border-slate-200 dark:border-slate-600 hover:border-indigo-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200',
                )}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="mt-0.5 text-xs opacity-70 leading-snug">{opt.description}</span>
              </button>
            )
          })}
        </div>

        {selected && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('addTab.tabTitle')}
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {selected === 'digest' && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('addTab.chaosSources')} <span className="text-red-500">{t('common.required')}</span>
            </label>
            <div className="flex flex-col gap-1">
              {chaosTabs.map((ct) => (
                <label key={ct.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedChaosIds.includes(ct.id)}
                    onChange={(e) =>
                      setSelectedChaosIds((prev) =>
                        e.target.checked ? [...prev, ct.id] : prev.filter((id) => id !== ct.id),
                      )
                    }
                    className="rounded border-slate-300 text-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{ct.title}</span>
                </label>
              ))}
            </div>
            {selectedChaosIds.length === 0 && (
              <p className="mt-1 text-xs text-red-500">{t('addTab.selectOneChaos')}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button
            type="submit"
            variant="primary"
            loading={loading}
            disabled={!selected || (selected === 'digest' && selectedChaosIds.length === 0)}
          >
            {t('addTab.add')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

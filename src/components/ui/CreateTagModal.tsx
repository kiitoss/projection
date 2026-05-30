import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import type { Tag } from '@/types'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#f43f5e',
]

interface CreateTagModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => Promise<Tag | null>
}

export function CreateTagModal({ open, onClose, onSubmit }: CreateTagModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(TAG_COLORS[0])
  const [loading, setLoading] = useState(false)
  const { t } = useTranslation()

  function handleClose() {
    setName('')
    setColor(TAG_COLORS[0])
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSubmit(name.trim(), color)
    setLoading(false)
    handleClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('sidebar.createTag')} size="sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="h-6 w-6 rounded-full transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: '2px',
              }}
            />
          ))}
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.tags.namePlaceholder')}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!name.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

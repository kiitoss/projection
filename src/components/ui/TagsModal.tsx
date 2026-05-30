import { useEffect, useState } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Tag } from '@/types'

interface LocalTag extends Tag {
  dirty: boolean
}

interface TagsModalProps {
  open: boolean
  onClose: () => void
  tags: Tag[]
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
  onUpdateTag: (id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) => Promise<void>
  onDeleteTag: (id: string) => Promise<void>
}

export function TagsModal({ open, onClose, tags, onCreateTag, onUpdateTag, onDeleteTag }: TagsModalProps) {
  const { t } = useTranslation()
  const [localTags, setLocalTags] = useState<LocalTag[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#6366f1')
  const [showNewTag, setShowNewTag] = useState(false)
  const [confirmDeleteTag, setConfirmDeleteTag] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setLocalTags(tags.map((t) => ({ ...t, dirty: false })))
      setNewTagName('')
      setNewTagColor('#6366f1')
      setShowNewTag(false)
    }
  }, [open])

  function updateLocal(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) {
    setLocalTags((prev) => prev.map((t) => t.id === id ? { ...t, ...updates, dirty: true } : t))
  }

  async function handleOk() {
    for (const tag of localTags.filter((t) => t.dirty)) {
      await onUpdateTag(tag.id, { name: tag.name.trim() || tag.name, color: tag.color })
    }
    if (showNewTag && newTagName.trim()) {
      await onCreateTag(newTagName.trim(), newTagColor)
    }
    onClose()
  }

  async function handleDelete() {
    if (!confirmDeleteTag) return
    await onDeleteTag(confirmDeleteTag)
    setLocalTags((prev) => prev.filter((t) => t.id !== confirmDeleteTag))
    setConfirmDeleteTag(null)
  }

  const tagToDelete = tags.find((t) => t.id === confirmDeleteTag)

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('settings.tags.title')} size="md">
        <div className="flex flex-col gap-2">
          {localTags.length === 0 && !showNewTag && (
            <p className="py-4 text-center text-sm text-slate-400">{t('settings.tags.empty')}</p>
          )}

          {localTags.map((tag) => (
            <div
              key={tag.id}
              className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
            >
              <ColorSwatch color={tag.color} onChange={(c) => updateLocal(tag.id, { color: c })} />
              <input
                value={tag.name}
                onChange={(e) => updateLocal(tag.id, { name: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter') handleOk() }}
                className="flex-1 rounded border border-transparent bg-transparent px-2 py-0.5 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-700 transition-colors"
              />
              <button
                onClick={() => setConfirmDeleteTag(tag.id)}
                className="text-slate-400 hover:text-red-500 cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          {showNewTag ? (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-indigo-300 dark:border-indigo-600 bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
              <ColorSwatch color={newTagColor} onChange={setNewTagColor} />
              <input
                autoFocus
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTagName.trim()) handleOk() }}
                placeholder={t('settings.tags.namePlaceholder')}
                className="flex-1 rounded border border-transparent bg-transparent px-2 py-0.5 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:border-slate-300 dark:focus:border-slate-600 focus:bg-white dark:focus:bg-slate-700 transition-colors"
              />
            </div>
          ) : (
            <button
              onClick={() => setShowNewTag(true)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-400 hover:border-slate-300 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              <Plus size={14} />
              {t('settings.tags.createTag')}
            </button>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700 mt-1">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button size="sm" variant="primary" onClick={handleOk}>
              {t('settings.tags.ok')}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteTag}
        onClose={() => setConfirmDeleteTag(null)}
        onConfirm={handleDelete}
        title={t('settings.tags.deleteTitle', { name: tagToDelete?.name })}
        description={t('settings.tags.deleteDescription')}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}

function ColorSwatch({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label className="relative h-6 w-6 shrink-0 cursor-pointer">
      <span className="absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </label>
  )
}

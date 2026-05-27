import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TagPill } from '@/components/ui/TagPill'
import type { Tag } from '@/types'

const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#84cc16', '#f43f5e',
]

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: { name: string; short_description: string; tagIds: string[] }) => Promise<unknown>
  tags: Tag[]
  onCreateTag: (name: string, color: string) => Promise<Tag | null>
}

export function CreateProjectModal({ open, onClose, onSubmit, tags, onCreateTag }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0])
  const [showTagCreate, setShowTagCreate] = useState(false)
  const { t } = useTranslation()

  function reset() {
    setName('')
    setDesc('')
    setSelectedTagIds([])
    setNewTagName('')
    setNewTagColor(TAG_COLORS[0])
    setShowTagCreate(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    await onSubmit({ name: name.trim(), short_description: desc.trim(), tagIds: selectedTagIds })
    setLoading(false)
    handleClose()
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((tid) => tid !== id) : [...prev, id],
    )
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return
    const tag = await onCreateTag(newTagName.trim(), newTagColor)
    if (tag) {
      setSelectedTagIds((prev) => [...prev, tag.id])
      setNewTagName('')
      setShowTagCreate(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={t('createProject.title')} size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('createProject.nameLabel')} <span className="text-red-500">{t('common.required')}</span>
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('createProject.namePlaceholder')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('createProject.shortDescLabel')}
          </label>
          <input
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={t('createProject.shortDescPlaceholder')}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
            {t('createProject.tagsLabel')}
          </label>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className="rounded-full transition-opacity"
                style={{ opacity: selectedTagIds.includes(tag.id) ? 1 : 0.4 }}
              >
                <TagPill tag={tag} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowTagCreate((v) => !v)}
              className="rounded-full border border-dashed border-slate-300 dark:border-slate-600 px-2.5 py-0.5 text-xs text-slate-400 hover:border-slate-400 transition-colors"
            >
              {t('createProject.addTag')}
            </button>
          </div>

          {showTagCreate && (
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 dark:border-slate-600 p-3">
              <input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder={t('createProject.tagNamePlaceholder')}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: newTagColor === c ? `2px solid ${c}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={handleCreateTag}>
                {t('createProject.createTag')}
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>{t('common.cancel')}</Button>
          <Button type="submit" variant="primary" loading={loading} disabled={!name.trim()}>
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

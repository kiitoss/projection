import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Globe, CheckSquare, Archive, Trash2, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TagPill } from '@/components/ui/TagPill'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'
import type { ProjectWithRelations } from '@/types'

interface ProjectCardProps {
  project: ProjectWithRelations
  onDelete: (id: string) => Promise<void>
  onArchive: (id: string) => Promise<void>
  onRename: (id: string, name: string) => Promise<void>
}

export function ProjectCard({ project, onDelete, onArchive, onRename }: ProjectCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(project.name)
  const menuRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  async function handleDelete() {
    await onDelete(project.id)
    setConfirmDelete(false)
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || newName === project.name) { setRenaming(false); return }
    await onRename(project.id, newName.trim())
    setRenaming(false)
  }

  const urgentTodos: string[] = []

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700',
          'bg-white dark:bg-slate-800 p-4 shadow-sm transition-shadow hover:shadow-md cursor-pointer',
        )}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[data-no-nav]')) return
          navigate(`/projects/${project.id}`)
        }}
      >
        <div className="flex items-start justify-between gap-2">
          {renaming ? (
            <form data-no-nav onSubmit={handleRename} className="flex-1">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => { if (newName === project.name) setRenaming(false) }}
                className="w-full rounded border border-indigo-300 bg-white dark:bg-slate-700 px-2 py-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </form>
          ) : (
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">
              {project.name}
            </h3>
          )}

          <div ref={menuRef} className="relative shrink-0" data-no-nav>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o) }}
              className="rounded-md p-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
              aria-label={t('project.options')}
            >
              <MoreVertical size={14} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-6 z-10 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-lg">
                <MenuItem icon={<Pencil size={13} />} label={t('common.rename')} onClick={() => { setRenaming(true); setMenuOpen(false) }} />
                <MenuItem icon={<Archive size={13} />} label={t('project.archive')} onClick={() => { onArchive(project.id); setMenuOpen(false) }} />
                <hr className="my-1 border-slate-100 dark:border-slate-700" />
                <MenuItem icon={<Trash2 size={13} />} label={t('common.delete')} onClick={() => { setConfirmDelete(true); setMenuOpen(false) }} danger />
              </div>
            )}
          </div>
        </div>

        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>
        )}

        {project.show_short_desc_on_card && project.short_description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
            {project.short_description}
          </p>
        )}

        {project.project_links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.project_links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                data-no-nav
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs text-indigo-500 hover:underline"
              >
                <Globe size={11} />
                {link.label ?? new URL(link.url).hostname}
              </a>
            ))}
          </div>
        )}

        {project.show_key_points_on_card && project.key_points.length > 0 && (
          <div>
            <ul className="flex flex-col gap-0.5">
              {project.key_points.slice(0, project.max_key_points_on_card).map((kp, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                  <span className="line-clamp-1">{kp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {urgentTodos.length > 0 && (
          <div>
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              <CheckSquare size={11} />
              {t('descriptionTab.urgences')}
            </p>
            <ul className="flex flex-col gap-0.5">
              {urgentTodos.map((todo, i) => (
                <li key={i} className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                  {todo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title={t('project.deleteTitle', { name: project.name })}
        description={t('project.deleteDescription')}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700',
        danger
          ? 'text-red-500 hover:text-red-600'
          : 'text-slate-700 dark:text-slate-200',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

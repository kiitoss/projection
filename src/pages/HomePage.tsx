import { useMemo, useState } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/layout/Header'
import { Sidebar } from '@/components/layout/Sidebar'
import { ProjectCard } from '@/components/project/ProjectCard'
import { CreateProjectModal } from '@/components/project/CreateProjectModal'
import { Spinner } from '@/components/ui/Spinner'
import { useProjects } from '@/hooks/useProjects'
import { useTags } from '@/hooks/useTags'
import { useAppStore } from '@/store/useAppStore'

export function HomePage() {
  const { projects, loading, createProject, updateProject, deleteProject, archiveProject } = useProjects()
  const { tags, createTag } = useTags()
  const { selectedTagIds, searchQuery, setSearchQuery, sortBy, setSortBy } = useAppStore()
  const [createOpen, setCreateOpen] = useState(false)
  const { t } = useTranslation()

  const filteredProjects = useMemo(() => {
    let list = [...projects]

    if (selectedTagIds.length > 0) {
      list = list.filter((p) =>
        selectedTagIds.every((tid) => p.tags.some((tag) => tag.id === tid)),
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (sortBy === 'name') {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }

    return list
  }, [projects, selectedTagIds, searchQuery, sortBy])

  const projectCountByTag = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const p of projects) {
      for (const tag of p.tags) {
        counts[tag.id] = (counts[tag.id] ?? 0) + 1
      }
    }
    return counts
  }, [projects])

  async function handleDelete(id: string) {
    await deleteProject(id)
  }

  async function handleArchive(id: string) {
    await archiveProject(id, true)
  }

  async function handleRename(id: string, name: string) {
    await updateProject(id, { name })
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Header
        onNewProject={() => setCreateOpen(true)}
        hasWidgets={false}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          tags={tags}
          projectCountByTag={projectCountByTag}
          totalCount={projects.length}
          onCreateTag={() => {}}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 lg:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.searchPlaceholder')}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortBy(sortBy === 'updated_at' ? 'name' : 'updated_at')}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <ArrowUpDown size={13} />
                  {sortBy === 'name' ? t('home.sortAlpha') : t('home.sortRecent')}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Spinner size="lg" className="text-indigo-500" />
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                {projects.length === 0 ? (
                  <>
                    <p className="text-2xl mb-2">📋</p>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {t('home.emptyCreate')}
                    </p>
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-600 transition-colors"
                    >
                      {t('home.createProject')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {t('home.noResults')}
                    </p>
                    <button
                      onClick={() => { setSearchQuery(''); useAppStore.getState().clearTagFilters() }}
                      className="mt-3 text-sm text-indigo-500 hover:underline"
                    >
                      {t('home.resetFilters')}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onDelete={handleDelete}
                    onArchive={handleArchive}
                    onRename={handleRename}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      <CreateProjectModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createProject}
        tags={tags}
        onCreateTag={createTag}
      />
    </div>
  )
}

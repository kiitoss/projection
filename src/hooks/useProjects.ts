import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/store/useAppStore'
import type { ProjectRow, ProjectWithRelations } from '@/types'

function normalizeProject(row: ProjectRow): ProjectWithRelations {
  return {
    ...row,
    tags: row.project_tags?.map((pt) => pt.tags).filter(Boolean) ?? [],
    project_links: row.project_links ?? [],
  }
}

export function useProjects() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [projects, setProjects] = useState<ProjectWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProjects = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('projects')
      .select('*, project_tags(tags(*)), project_links(*)')
      .eq('user_id', user.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })

    if (error) {
      toast.error(t('toasts.projectsLoadError'))
    } else {
      setProjects((data as ProjectRow[]).map(normalizeProject))
    }
    setLoading(false)
  }, [user, t])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Realtime subscription
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchProjects)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, fetchProjects])

  async function createProject(data: {
    name: string
    short_description?: string
    tagIds?: string[]
  }) {
    if (!user) return

    const { data: project, error } = await supabase
      .from('projects')
      .insert({ user_id: user.id, name: data.name, short_description: data.short_description ?? null })
      .select()
      .single()

    if (error || !project) {
      toast.error(t('toasts.projectCreateError'))
      return null
    }

    // Create default description tab
    await supabase.from('tabs').insert({
      project_id: project.id,
      type: 'description',
      title: t('descriptionTab.defaultTitle'),
      position: 0,
    })

    // Associate tags
    if (data.tagIds?.length) {
      await supabase.from('project_tags').insert(
        data.tagIds.map((tag_id) => ({ project_id: project.id, tag_id })),
      )
    }

    toast.success(t('toasts.projectCreated'))
    await fetchProjects()
    return project
  }

  async function updateProject(id: string, updates: Partial<ProjectWithRelations>) {
    const { error } = await supabase.from('projects').update(updates).eq('id', id)
    if (error) toast.error(t('toasts.projectUpdateError'))
    else await fetchProjects()
  }

  async function deleteProject(id: string) {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) toast.error(t('toasts.projectDeleteError'))
    else {
      toast.success(t('toasts.projectDeleted'))
      await fetchProjects()
    }
  }

  async function archiveProject(id: string, archived: boolean) {
    const { error } = await supabase.from('projects').update({ archived }).eq('id', id)
    if (error) toast.error(t('toasts.projectArchiveError'))
    else {
      toast.success(archived ? t('toasts.projectArchived') : t('toasts.projectRestored'))
      await fetchProjects()
    }
  }

  return { projects, loading, createProject, updateProject, deleteProject, archiveProject, refetch: fetchProjects }
}

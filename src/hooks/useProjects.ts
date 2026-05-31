import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/store/useAppStore'
import type { ProjectRow, ProjectWithRelations } from '@/types'

function normalizeProject(row: ProjectRow): ProjectWithRelations {
  const descTab = row.tabs?.find((t) => t.type === 'infos')
  const maxOnCard = (descTab?.config as { max_on_card?: number } | undefined)?.max_on_card ?? 5
  const allTodos = descTab?.todos ?? []

  const urgentTodos = allTodos
    .filter((t) => t.urgent && !t.completed)
    .sort((a, b) => a.position - b.position)
    .slice(0, maxOnCard)

  function getDescendants(parentId: string, visited = new Set<string>()): typeof allTodos {
    if (visited.has(parentId)) return []
    visited.add(parentId)
    const children = allTodos.filter((t) => t.parent_id === parentId && !t.completed)
    return [...children, ...children.flatMap((c) => getDescendants(c.id, visited))]
  }

  const seen = new Set<string>()
  const urgentWithDescendants = [...urgentTodos, ...urgentTodos.flatMap((t) => getDescendants(t.id))]
    .filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true })
    .sort((a, b) => a.position - b.position)
    .map((t) => ({ id: t.id, content: t.content, completed: t.completed }))
    .filter((t) => Boolean(t.content))

  return {
    ...row,
    tags: row.project_tags?.map((pt) => pt.tags).filter(Boolean) ?? [],
    project_links: row.project_links ?? [],
    urgent_todos: urgentWithDescendants,
  }
}

export function useProjects() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const queryKey = ['projects', user?.id] as const

  const { data: projects = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, project_tags(tags(*)), project_links(*), tabs(id, type, config, todos(id, content, urgent, completed, position, parent_id, level))')
        .eq('user_id', user!.id)
        .eq('archived', false)
        .order('updated_at', { ascending: false })
      if (error) { toast.error(t('toasts.projectsLoadError')); return [] }
      return (data as ProjectRow[]).map(normalizeProject)
    },
    enabled: !!user,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey })

  // Realtime bridge
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('projects-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => {
        qc.invalidateQueries({ queryKey: ['projects', user.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, qc])

  const createProjectMutation = useMutation({
    mutationFn: async (data: { name: string; short_description?: string; tagIds?: string[] }) => {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({ user_id: user!.id, name: data.name, short_description: data.short_description ?? null })
        .select()
        .single()
      if (error || !project) throw error ?? new Error('Project creation failed')

      await supabase.from('tabs').insert({
        project_id: project.id,
        type: 'infos',
        title: t('descriptionTab.defaultTitle'),
        position: 0,
      })

      if (data.tagIds?.length) {
        await supabase.from('project_tags').insert(
          data.tagIds.map((tag_id) => ({ project_id: project.id, tag_id }))
        )
      }
      return project
    },
    onSuccess: () => { toast.success(t('toasts.projectCreated')); invalidate() },
    onError: () => toast.error(t('toasts.projectCreateError')),
  })

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProjectWithRelations> }) => {
      const { error } = await supabase.from('projects').update(updates).eq('id', id)
      if (error) throw error
    },
    onError: () => toast.error(t('toasts.projectUpdateError')),
    onSettled: () => invalidate(),
  })

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectWithRelations[]>(queryKey)
      qc.setQueryData(queryKey, (old: ProjectWithRelations[] | undefined = []) =>
        old.filter((p) => p.id !== id)
      )
      return { snapshot }
    },
    onSuccess: () => toast.success(t('toasts.projectDeleted')),
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.projectDeleteError'))
    },
    onSettled: () => invalidate(),
  })

  const archiveProjectMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from('projects').update({ archived }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectWithRelations[]>(queryKey)
      // Archive removes from current list (non-archived view)
      qc.setQueryData(queryKey, (old: ProjectWithRelations[] | undefined = []) =>
        old.filter((p) => p.id !== id)
      )
      return { snapshot }
    },
    onSuccess: (_data, { archived }) => {
      toast.success(archived ? t('toasts.projectArchived') : t('toasts.projectRestored'))
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.projectArchiveError'))
    },
    onSettled: () => invalidate(),
  })

  return {
    projects,
    loading,
    createProject: (data: { name: string; short_description?: string; tagIds?: string[] }) =>
      createProjectMutation.mutateAsync(data),
    updateProject: (id: string, updates: Partial<ProjectWithRelations>) =>
      updateProjectMutation.mutateAsync({ id, updates }),
    deleteProject: (id: string) => deleteProjectMutation.mutateAsync(id),
    archiveProject: (id: string, archived: boolean) =>
      archiveProjectMutation.mutateAsync({ id, archived }),
    refetch: invalidate,
  }
}

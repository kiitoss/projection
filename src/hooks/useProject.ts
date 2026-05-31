import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { toast } from '@/store/useAppStore'
import type { ProjectRow, ProjectWithRelations, Tab, TabType } from '@/types'

function normalizeProject(row: ProjectRow): ProjectWithRelations {
  return {
    ...row,
    tags: row.project_tags?.map((pt) => pt.tags).filter(Boolean) ?? [],
    project_links: row.project_links ?? [],
  }
}

type ProjectData = { project: ProjectWithRelations; tabs: Tab[] }

export function useProject(projectId: string) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const queryKey = ['project', projectId] as const

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const [{ data: p, error: pe }, { data: tabData, error: te }] = await Promise.all([
        supabase
          .from('projects')
          .select('*, project_tags(tags(*)), project_links(*)')
          .eq('id', projectId)
          .single(),
        supabase
          .from('tabs')
          .select('*')
          .eq('project_id', projectId)
          .order('position'),
      ])
      if (pe) { toast.error(t('toasts.projectNotFound')); throw pe }
      if (te) throw te
      return {
        project: normalizeProject(p as ProjectRow),
        tabs: (tabData as Tab[]) ?? [],
      } satisfies ProjectData
    },
  })

  const project = data?.project ?? null
  const tabs = data?.tabs ?? []

  const invalidate = () => qc.invalidateQueries({ queryKey })

  // Realtime bridge
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ['project', projectId] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs', filter: `project_id=eq.${projectId}` }, () => {
        qc.invalidateQueries({ queryKey: ['project', projectId] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, qc])

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: Partial<ProjectWithRelations>) => {
      const { error } = await supabase.from('projects').update(updates).eq('id', projectId)
      if (error) throw error
    },
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) =>
        old ? { ...old, project: { ...old.project, ...updates } } : old!
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.saveError'))
    },
    onSettled: () => invalidate(),
  })

  const addTabMutation = useMutation({
    mutationFn: async ({ type, title, config = {} }: { type: TabType; title: string; config?: Record<string, unknown> }) => {
      const maxPos = tabs.length > 0 ? Math.max(...tabs.map((t) => t.position)) + 1 : 1
      const { data: tabData, error } = await supabase
        .from('tabs')
        .insert({ project_id: projectId, type, title, position: maxPos, config })
        .select()
        .single()
      if (error) throw error
      if (type === 'chaos') {
        await supabase.from('chaos_content').insert({ tab_id: (tabData as Tab).id, content: '' })
      }
      return tabData as Tab
    },
    onError: () => toast.error(t('toasts.tabAddError')),
    onSettled: () => invalidate(),
  })

  const updateTabMutation = useMutation({
    mutationFn: async ({ tabId, updates }: { tabId: string; updates: Partial<Tab> }) => {
      const { error } = await supabase.from('tabs').update(updates).eq('id', tabId)
      if (error) throw error
    },
    onMutate: async ({ tabId, updates }) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) =>
        old ? { ...old, tabs: old.tabs.map((t) => (t.id === tabId ? { ...t, ...updates } : t)) } : old!
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.tabUpdateError'))
    },
    onSettled: () => invalidate(),
  })

  const deleteTabMutation = useMutation({
    mutationFn: async (tabId: string) => {
      const { error } = await supabase.from('tabs').delete().eq('id', tabId)
      if (error) throw error
    },
    onMutate: async (tabId) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) =>
        old ? { ...old, tabs: old.tabs.filter((t) => t.id !== tabId) } : old!
      )
      return { snapshot }
    },
    onSuccess: () => toast.success(t('toasts.tabDeleted')),
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.tabDeleteError'))
    },
    onSettled: () => invalidate(),
  })

  const reorderTabsMutation = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      for (const [i, id] of orderedIds.entries()) {
        const { error } = await supabase.from('tabs').update({ position: i }).eq('id', id)
        if (error) throw error
      }
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) => {
        if (!old) return old!
        const map = new Map(old.tabs.map((t) => [t.id, t]))
        return { ...old, tabs: orderedIds.map((id, i) => ({ ...map.get(id)!, position: i })) }
      })
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
    },
    onSettled: () => invalidate(),
  })

  const addLinkMutation = useMutation({
    mutationFn: async ({ url, label }: { url: string; label?: string }) => {
      const maxPos = project?.project_links.length ?? 0
      const { error } = await supabase.from('project_links').insert({
        project_id: projectId, url, label: label ?? null, position: maxPos,
      })
      if (error) throw error
    },
    onError: () => toast.error(t('toasts.linkAddError')),
    onSettled: () => invalidate(),
  })

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from('project_links').delete().eq('id', linkId)
      if (error) throw error
    },
    onMutate: async (linkId) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) =>
        old
          ? { ...old, project: { ...old.project, project_links: old.project.project_links.filter((l) => l.id !== linkId) } }
          : old!
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.linkDeleteError'))
    },
    onSettled: () => invalidate(),
  })

  const addTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('project_tags')
        .insert({ project_id: projectId, tag_id: tagId })
      if (error) throw error
    },
    onError: () => toast.error(t('toasts.projectUpdateError')),
    onSettled: () => invalidate(),
  })

  const removeTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from('project_tags')
        .delete()
        .eq('project_id', projectId)
        .eq('tag_id', tagId)
      if (error) throw error
    },
    onMutate: async (tagId) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<ProjectData>(queryKey)
      qc.setQueryData<ProjectData>(queryKey, (old) =>
        old
          ? { ...old, project: { ...old.project, tags: old.project.tags.filter((t) => t.id !== tagId) } }
          : old!
      )
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.projectUpdateError'))
    },
    onSettled: () => invalidate(),
  })

  return {
    project,
    tabs,
    loading,
    updateProject: (updates: Partial<ProjectWithRelations>) =>
      updateProjectMutation.mutateAsync(updates),
    addTab: (type: TabType, title: string, config?: Record<string, unknown>) =>
      addTabMutation.mutateAsync({ type, title, config }),
    updateTab: (tabId: string, updates: Partial<Tab>) =>
      updateTabMutation.mutateAsync({ tabId, updates }),
    deleteTab: (tabId: string) => deleteTabMutation.mutateAsync(tabId),
    reorderTabs: (orderedIds: string[]) => reorderTabsMutation.mutateAsync(orderedIds),
    addLink: (url: string, label?: string) => addLinkMutation.mutateAsync({ url, label }),
    deleteLink: (linkId: string) => deleteLinkMutation.mutateAsync(linkId),
    addTagToProject: (tagId: string) => addTagMutation.mutateAsync(tagId),
    removeTagFromProject: (tagId: string) => removeTagMutation.mutateAsync(tagId),
    refetch: invalidate,
  }
}

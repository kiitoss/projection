import { useCallback, useEffect, useState } from 'react'
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

export function useProject(projectId: string) {
  const { t } = useTranslation()
  const [project, setProject] = useState<ProjectWithRelations | null>(null)
  const [tabs, setTabs] = useState<Tab[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProject = useCallback(async () => {
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

    if (pe) toast.error(t('toasts.projectNotFound'))
    else setProject(normalizeProject(p as ProjectRow))

    if (!te) setTabs((tabData as Tab[]) ?? [])
    setLoading(false)
  }, [projectId, t])

  useEffect(() => { fetchProject() }, [fetchProject])

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`project-${projectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` }, fetchProject)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tabs', filter: `project_id=eq.${projectId}` }, fetchProject)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [projectId, fetchProject])

  async function updateProject(updates: Partial<ProjectWithRelations>) {
    const { error } = await supabase.from('projects').update(updates).eq('id', projectId)
    if (error) toast.error(t('toasts.saveError'))
    else setProject((p) => p ? { ...p, ...updates } : p)
  }

  async function addTab(type: TabType, title: string, config: Record<string, unknown> = {}) {
    const maxPos = tabs.length > 0 ? Math.max(...tabs.map((tab) => tab.position)) + 1 : 1
    const { data, error } = await supabase
      .from('tabs')
      .insert({ project_id: projectId, type, title, position: maxPos, config })
      .select()
      .single()

    if (error) { toast.error(t('toasts.tabAddError')); return null }

    // For chaos tab, create the chaos_content row
    if (type === 'chaos') {
      await supabase.from('chaos_content').insert({ tab_id: data.id, content: '' })
    }

    await fetchProject()
    return data as Tab
  }

  async function updateTab(tabId: string, updates: Partial<Tab>) {
    const { error } = await supabase.from('tabs').update(updates).eq('id', tabId)
    if (error) toast.error(t('toasts.tabUpdateError'))
    else setTabs((prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, ...updates } : tab)))
  }

  async function deleteTab(tabId: string) {
    const { error } = await supabase.from('tabs').delete().eq('id', tabId)
    if (error) toast.error(t('toasts.tabDeleteError'))
    else {
      toast.success(t('toasts.tabDeleted'))
      await fetchProject()
    }
  }

  async function reorderTabs(orderedIds: string[]) {
    const updates = orderedIds.map((id, i) => ({ id, position: i }))
    // Optimistic update
    setTabs((prev) => {
      const map = new Map(prev.map((t) => [t.id, t]))
      return orderedIds.map((id, i) => ({ ...map.get(id)!, position: i }))
    })
    for (const u of updates) {
      await supabase.from('tabs').update({ position: u.position }).eq('id', u.id)
    }
  }

  async function addLink(url: string, label?: string) {
    const maxPos = project?.project_links.length ?? 0
    const { error } = await supabase.from('project_links').insert({
      project_id: projectId, url, label: label ?? null, position: maxPos,
    })
    if (error) toast.error(t('toasts.linkAddError'))
    else await fetchProject()
  }

  async function deleteLink(linkId: string) {
    const { error } = await supabase.from('project_links').delete().eq('id', linkId)
    if (error) toast.error(t('toasts.linkDeleteError'))
    else await fetchProject()
  }

  async function addTagToProject(tagId: string) {
    const { error } = await supabase
      .from('project_tags')
      .insert({ project_id: projectId, tag_id: tagId })
    if (error) toast.error(t('toasts.projectUpdateError'))
    else await fetchProject()
  }

  async function removeTagFromProject(tagId: string) {
    const { error } = await supabase
      .from('project_tags')
      .delete()
      .eq('project_id', projectId)
      .eq('tag_id', tagId)
    if (error) toast.error(t('toasts.projectUpdateError'))
    else await fetchProject()
  }

  return {
    project, tabs, loading,
    updateProject, addTab, updateTab, deleteTab, reorderTabs,
    addLink, deleteLink, addTagToProject, removeTagFromProject,
    refetch: fetchProject,
  }
}

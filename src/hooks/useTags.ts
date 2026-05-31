import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/store/useAppStore'
import type { Tag } from '@/types'

export function useTags() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const qc = useQueryClient()
  const queryKey = ['tags', user?.id] as const

  const { data: tags = [], isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tags')
        .select('*')
        .eq('user_id', user!.id)
        .order('position')
        .order('name')
      if (error) { toast.error(t('toasts.tagsLoadError')); return [] }
      return data as Tag[]
    },
    enabled: !!user,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey })

  // Realtime bridge
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('tags-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tags' }, () => {
        qc.invalidateQueries({ queryKey: ['tags', user.id] })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, qc])

  const createTagMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: user!.id, name: name.trim(), color, position: tags.length })
        .select()
        .single()
      if (error) throw error
      return data as Tag
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error(t('toasts.tagCreateError')),
  })

  const updateTagMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<Tag, 'name' | 'color'>> }) => {
      const { error } = await supabase.from('tags').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidate(),
    onError: () => toast.error(t('toasts.tagUpdateError')),
  })

  const deleteTagMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tags').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => { toast.success(t('toasts.tagDeleted')); invalidate() },
    onError: () => toast.error(t('toasts.tagDeleteError')),
  })

  const reorderTagsMutation = useMutation({
    mutationFn: async (reordered: Tag[]) => {
      const results = await Promise.all(
        reordered.map((tag, i) => supabase.from('tags').update({ position: i }).eq('id', tag.id))
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async (reordered) => {
      await qc.cancelQueries({ queryKey })
      const snapshot = qc.getQueryData<Tag[]>(queryKey)
      qc.setQueryData(queryKey, reordered)
      return { snapshot }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.snapshot) qc.setQueryData(queryKey, ctx.snapshot)
      toast.error(t('toasts.tagUpdateError'))
    },
    onSettled: () => invalidate(),
  })

  return {
    tags,
    loading,
    createTag: (name: string, color: string) => createTagMutation.mutateAsync({ name, color }),
    updateTag: (id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) =>
      updateTagMutation.mutateAsync({ id, updates }),
    deleteTag: (id: string) => deleteTagMutation.mutateAsync(id),
    reorderTags: (reordered: Tag[]) => reorderTagsMutation.mutateAsync(reordered),
    refetch: invalidate,
  }
}

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/store/useAppStore'
import type { Tag } from '@/types'

export function useTags() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTags = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .order('position')
      .order('name')

    if (error) toast.error(t('toasts.tagsLoadError'))
    else setTags(data ?? [])
    setLoading(false)
  }, [user, t])

  useEffect(() => { fetchTags() }, [fetchTags])

  async function createTag(name: string, color: string) {
    if (!user) return null
    const { data, error } = await supabase
      .from('tags')
      .insert({ user_id: user.id, name: name.trim(), color, position: tags.length })
      .select()
      .single()

    if (error) { toast.error(t('toasts.tagCreateError')); return null }
    await fetchTags()
    return data as Tag
  }

  async function updateTag(id: string, updates: Partial<Pick<Tag, 'name' | 'color'>>) {
    const { error } = await supabase.from('tags').update(updates).eq('id', id)
    if (error) toast.error(t('toasts.tagUpdateError'))
    else await fetchTags()
  }

  async function deleteTag(id: string) {
    const { error } = await supabase.from('tags').delete().eq('id', id)
    if (error) toast.error(t('toasts.tagDeleteError'))
    else { toast.success(t('toasts.tagDeleted')); await fetchTags() }
  }

  async function reorderTags(reordered: Tag[]) {
    setTags(reordered)
    await Promise.all(
      reordered.map((tag, i) =>
        supabase.from('tags').update({ position: i }).eq('id', tag.id)
      )
    )
  }

  return { tags, loading, createTag, updateTag, deleteTag, reorderTags, refetch: fetchTags }
}

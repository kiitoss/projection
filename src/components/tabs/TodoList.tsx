import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, AlertCircle, X, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/store/useAppStore'
import type { Tab, Todo, TodoListConfig } from '@/types'

const INDENT_WIDTH = 12

interface TodoListProps {
  tab: Tab
  onUpdateTab: (updates: Partial<Tab>) => Promise<void>
  className?: string
}

export function TodoList({ tab, onUpdateTab, className }: TodoListProps) {
  const config = tab.config as unknown as TodoListConfig
  const maxOnCard = config?.max_on_card ?? 5
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [newTodoId, setNewTodoId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragX, setDragX] = useState(0)
  // Maps todo.id → stable React key so remounting doesn't occur when tempId is replaced by realId
  const stableKeys = useRef(new Map<string, string>())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { t } = useTranslation()
  const qc = useQueryClient()
  const queryKey = ['todos', tab.id] as const

  const { data: todos = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data } = await supabase
        .from('todos')
        .select('*')
        .eq('tab_id', tab.id)
        .order('position')
      return (data as Todo[]) ?? []
    },
  })

  function setTodosData(value: Todo[] | ((prev: Todo[]) => Todo[])) {
    qc.setQueryData<Todo[]>(queryKey, (old = []) =>
      typeof value === 'function' ? value(old) : value
    )
  }

  function getDragTargetLevel(todoId: string, deltaX: number): number {
    const todo = todos.find((t) => t.id === todoId)
    if (!todo) return 0
    return Math.max(0, Math.min(4, todo.level + Math.round(deltaX / INDENT_WIDTH)))
  }

  function collectDescendants(parentId: string): Todo[] {
    const children = todos.filter((t) => t.parent_id === parentId)
    return [...children, ...children.flatMap((c) => collectDescendants(c.id))]
  }

  async function renormalizePositions(list: Todo[]) {
    await supabase
      .from('todos')
      .upsert(list.map((t, i) => ({ ...t, position: i })))
  }

  async function addTodo(parentId?: string, level = 0, afterPosition?: number) {
    const position = afterPosition !== undefined ? afterPosition + 1 : todos.length
    const tempId = crypto.randomUUID()
    const optimisticTodo: Todo = {
      id: tempId,
      tab_id: tab.id,
      content: '',
      completed: false,
      urgent: false,
      position,
      parent_id: parentId ?? null,
      level,
      created_at: new Date().toISOString(),
    }

    let newList: Todo[]
    if (afterPosition !== undefined) {
      const idx = todos.findIndex((t) => t.position === afterPosition)
      newList = idx >= 0
        ? [...todos.slice(0, idx + 1), optimisticTodo, ...todos.slice(idx + 1)]
        : [...todos, optimisticTodo]
    } else {
      newList = [...todos, optimisticTodo]
    }

    stableKeys.current.set(tempId, tempId)
    setTodosData(newList)
    setNewTodoId(tempId)

    const { data, error } = await supabase
      .from('todos')
      .insert({ tab_id: tab.id, content: '', position, parent_id: parentId ?? null, level })
      .select()
      .single()

    if (error) {
      toast.error(t('toasts.tabAddError'))
      setTodosData(todos)
      setNewTodoId(null)
      return
    }

    const realTodo = data as Todo
    const finalList = newList.map((t) => (t.id === tempId ? realTodo : t))
    // Reuse the same React key so the component isn't remounted (no focus loss)
    stableKeys.current.set(realTodo.id, tempId)
    setTodosData(finalList)
    setNewTodoId(null)
    // Renormalize positions in background — not worth blocking the UI
    renormalizePositions(finalList).catch(() => {})
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    // Cascade urgent toggling to all descendants
    if ('urgent' in updates && typeof updates.urgent === 'boolean') {
      function collectDescendants(parentId: string): string[] {
        const children = todos.filter((t) => t.parent_id === parentId)
        return [...children.map((c) => c.id), ...children.flatMap((c) => collectDescendants(c.id))]
      }
      const descendantIds = collectDescendants(id)
      if (descendantIds.length > 0) {
        await supabase.from('todos').update({ urgent: updates.urgent }).in('id', descendantIds)
        setTodosData((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, ...updates }
            : descendantIds.includes(t.id) ? { ...t, urgent: updates.urgent as boolean }
            : t,
          ),
        )
        await supabase.from('todos').update(updates).eq('id', id)
        return
      }
    }
    await supabase.from('todos').update(updates).eq('id', id)
    setTodosData((prev) => prev.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo)))
  }

  async function deleteTodo(id: string, focusNextId?: string | null) {
    function collectDescendants(parentId: string): string[] {
      const children = todos.filter((t) => t.parent_id === parentId)
      return [...children.map((c) => c.id), ...children.flatMap((c) => collectDescendants(c.id))]
    }
    const idsToDelete = new Set([id, ...collectDescendants(id)])

    // If the suggested focus target is itself being deleted, find the first survivor after the subtree
    let actualFocusId = focusNextId && !idsToDelete.has(focusNextId) ? focusNextId : null
    if (!actualFocusId) {
      const idx = todos.findIndex((t) => t.id === id)
      actualFocusId = todos.slice(idx + 1).find((t) => !idsToDelete.has(t.id))?.id ?? null
    }

    setTodosData((prev) => prev.filter((t) => !idsToDelete.has(t.id)))
    if (actualFocusId) {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLTextAreaElement>(`[data-todo-id="${actualFocusId}"]`)
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      })
    }
    // DB has ON DELETE CASCADE on parent_id — deleting the parent removes all descendants
    await supabase.from('todos').delete().eq('id', id)
  }

  async function indentTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (!todo || todo.level >= 4) return
    const siblings = todos.filter((t) => t.parent_id === todo.parent_id && t.position < todo.position)
    const newParent = siblings[siblings.length - 1]
    if (!newParent) return
    const descendants = collectDescendants(id)
    const updated: Todo[] = [
      { ...todo, level: todo.level + 1, parent_id: newParent.id },
      ...descendants.map((d) => ({ ...d, level: Math.min(4, d.level + 1) })),
    ]
    setTodosData((prev) => prev.map((t) => updated.find((u) => u.id === t.id) ?? t))
    await supabase.from('todos').upsert(updated)
  }

  async function unindentTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (!todo || todo.level === 0) return
    const parent = todos.find((t) => t.id === todo.parent_id)
    const newParentId = parent?.parent_id ?? null
    const descendants = collectDescendants(id)
    const updated: Todo[] = [
      { ...todo, level: todo.level - 1, parent_id: newParentId },
      ...descendants.map((d) => ({ ...d, level: Math.max(0, d.level - 1) })),
    ]
    setTodosData((prev) => prev.map((t) => updated.find((u) => u.id === t.id) ?? t))
    await supabase.from('todos').upsert(updated)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over, delta } = event
    const draggedId = active.id as string
    const targetLevel = getDragTargetLevel(draggedId, delta.x)
    const draggedTodo = todos.find((t) => t.id === draggedId)

    setDraggingId(null)
    setDragX(0)

    if (!draggedTodo) return

    // Build subtree (dragged item + all descendants in current list order)
    function buildSubtree(id: string): Todo[] {
      const item = todos.find((t) => t.id === id)
      if (!item) return []
      const children = todos
        .filter((t) => t.parent_id === id)
        .sort((a, b) => todos.indexOf(a) - todos.indexOf(b))
      return [item, ...children.flatMap((c) => buildSubtree(c.id))]
    }

    const subtree = buildSubtree(draggedId)
    const subtreeIds = new Set(subtree.map((t) => t.id))

    // Reorder vertically if dropped on a different non-subtree item
    let reorderedList: Todo[]
    if (over && over.id !== active.id && !subtreeIds.has(over.id as string)) {
      const overId = over.id as string
      const draggedIndexInAll = todos.findIndex((t) => t.id === draggedId)
      const overIndexInAll = todos.findIndex((t) => t.id === overId)
      const rest = todos.filter((t) => !subtreeIds.has(t.id))
      const overIndexInRest = rest.findIndex((t) => t.id === overId)
      const insertIndex = overIndexInAll > draggedIndexInAll ? overIndexInRest + 1 : overIndexInRest
      reorderedList = [...rest.slice(0, insertIndex), ...subtree, ...rest.slice(insertIndex)]
    } else {
      reorderedList = [...todos]
    }

    // Apply horizontal indentation
    const levelDelta = targetLevel - draggedTodo.level
    const draggedNewIdx = reorderedList.findIndex((t) => t.id === draggedId)

    // Find new parent for the dragged item at targetLevel
    let newParentId: string | null = null
    if (targetLevel > 0) {
      for (let i = draggedNewIdx - 1; i >= 0; i--) {
        const candidate = reorderedList[i]
        if (subtreeIds.has(candidate.id)) continue
        if (candidate.level === targetLevel - 1) { newParentId = candidate.id; break }
        if (candidate.level < targetLevel - 1) break
      }
    }

    const positionChanged = over && over.id !== active.id && !subtreeIds.has(over.id as string)
    if (!positionChanged && levelDelta === 0) return

    const finalOrder = reorderedList.map((t) => {
      if (t.id === draggedId) return { ...t, level: targetLevel, parent_id: newParentId }
      if (subtreeIds.has(t.id)) return { ...t, level: Math.min(4, Math.max(0, t.level + levelDelta)) }
      return t
    })

    setTodosData(finalOrder)
    renormalizePositions(finalOrder)
  }

  const visibleTodos = todos.filter((todo) => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const importantTodos = todos.filter((todo) => !todo.completed && todo.urgent)

  function emptyMessage() {
    if (filter === 'active') return t('todoTab.emptyActive')
    if (filter === 'completed') return t('todoTab.emptyCompleted')
    return t('todoTab.emptyAll')
  }

  return (
    <div className={cn('flex flex-col', className ?? 'max-w-2xl')}>
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 px-3 py-3 md:px-6 bg-white dark:bg-slate-900">
        <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {t('todoTab.show')}
          <input
            type="number"
            min={1}
            max={20}
            defaultValue={maxOnCard}
            onChange={(e) =>
              onUpdateTab({ config: { ...tab.config, max_on_card: parseInt(e.target.value) || 5 } })
            }
            className="w-12 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {t('todoTab.importantOnCard')}
        </label>

        <div className="ml-auto flex text-xs border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          {(['all', 'active', 'completed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 transition-colors',
                filter === f
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
              )}
            >
              {f === 'all' ? t('todoTab.filterAll') : f === 'active' ? t('todoTab.filterActive') : t('todoTab.filterCompleted')}
            </button>
          ))}
        </div>
      </div>

      <div className="px-2 py-2 md:px-6 md:py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={({ active }) => { setDraggingId(active.id as string); setDragX(0) }}
          onDragMove={({ delta }) => setDragX(delta.x)}
          onDragCancel={() => { setDraggingId(null); setDragX(0) }}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={visibleTodos.map((todo) => todo.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-0.5">
              {visibleTodos.map((todo, i) => {
                const importantIndex = importantTodos.findIndex((u) => u.id === todo.id)

                const showCardLimit =
                  filter !== 'completed' &&
                  importantIndex === maxOnCard - 1 &&
                  importantTodos.length > maxOnCard &&
                  i < visibleTodos.length - 1

                const stableKey = stableKeys.current.get(todo.id) ?? todo.id

                return (
                  <div key={stableKey}>
                    <SortableTodoItem
                      todo={todo}
                      isNew={todo.id === newTodoId}
                      prevTodoId={i > 0 ? visibleTodos[i - 1].id : null}
                      nextTodoId={i < visibleTodos.length - 1 ? visibleTodos[i + 1].id : null}
                      dragTargetLevel={draggingId === todo.id ? getDragTargetLevel(todo.id, dragX) : undefined}
                      onUpdate={updateTodo}
                      onDelete={deleteTodo}
                      onIndent={indentTodo}
                      onUnindent={unindentTodo}
                      onAddAfter={(parentId, level) => addTodo(parentId ?? undefined, level, todo.position)}
                    />
                    {showCardLimit && (
                      <div className="my-2 flex items-center gap-2 text-xs text-slate-400">
                        <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600" />
                        <span>{t('todoTab.cardLimit', { max: maxOnCard })}</span>
                        <div className="flex-1 border-t border-dashed border-slate-300 dark:border-slate-600" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        {visibleTodos.length === 0 && (
          <p className="text-sm text-slate-400 py-4">{emptyMessage()}</p>
        )}

        <button
          onClick={() => addTodo()}
          className="mt-3 flex items-center gap-1.5 text-sm text-indigo-500 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          {t('todoTab.addTodo')}
        </button>
      </div>
    </div>
  )
}

interface SortableTodoItemProps {
  todo: Todo
  isNew?: boolean
  prevTodoId: string | null
  nextTodoId: string | null
  dragTargetLevel?: number
  onUpdate: (id: string, updates: Partial<Todo>) => Promise<void>
  onDelete: (id: string, focusNextId?: string | null) => Promise<void>
  onIndent: (id: string) => Promise<void>
  onUnindent: (id: string) => Promise<void>
  onAddAfter: (parentId: string | null, level: number) => Promise<void>
}

function SortableTodoItem({
  todo,
  isNew,
  prevTodoId,
  nextTodoId,
  dragTargetLevel,
  onUpdate,
  onDelete,
  onIndent,
  onUnindent,
  onAddAfter,
}: SortableTodoItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: todo.id,
  })
  const [content, setContent] = useState(todo.content)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (isNew) textareaRef.current?.focus()
  }, [isNew])

  // Auto-resize textarea on mount and content change
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  function handleContentChange(v: string) {
    setContent(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onUpdate(todo.id, { content: v }), 500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onAddAfter(null, 0)
    }
    if (e.key === 'Backspace' && !content) {
      e.preventDefault()
      onDelete(todo.id, prevTodoId)
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      if (e.shiftKey) onUnindent(todo.id)
      else onIndent(todo.id)
    }
    if (e.key === 'ArrowUp') {
      const el = e.target as HTMLTextAreaElement
      const firstNewline = el.value.indexOf('\n')
      if (firstNewline === -1 || el.selectionStart <= firstNewline) {
        e.preventDefault()
        const all = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-todo-id]'))
        const idx = all.findIndex((a) => a === textareaRef.current)
        if (idx > 0) {
          const prev = all[idx - 1]
          prev.focus()
          prev.setSelectionRange(prev.value.length, prev.value.length)
        }
      }
    }
    if (e.key === 'ArrowDown') {
      const el = e.target as HTMLTextAreaElement
      const lastNewline = el.value.lastIndexOf('\n')
      if (lastNewline === -1 || el.selectionStart > lastNewline) {
        e.preventDefault()
        const all = Array.from(document.querySelectorAll<HTMLTextAreaElement>('[data-todo-id]'))
        const idx = all.findIndex((a) => a === textareaRef.current)
        if (idx < all.length - 1) {
          const next = all[idx + 1]
          next.focus()
          next.setSelectionRange(0, 0)
        }
      }
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: `${(dragTargetLevel ?? todo.level) * INDENT_WIDTH}px`,
      }}
      className={cn(
        'group flex items-start gap-1 py-0.5 rounded-md',
        isDragging && 'opacity-50',
      )}
    >
      {/* Drag handle — mobile: chevrons absolute (no layout impact), desktop: flex in-flow */}
      <div className="relative shrink-0 mt-0.5 md:flex md:items-center">
        {todo.level > 0 && (
          <button
            onClick={() => onUnindent(todo.id)}
            title={t('todoTab.outdent')}
            className="absolute right-full top-1/2 -translate-y-1/2 md:static md:translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0 text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-pointer"
          >
            <ChevronLeft size={12} />
          </button>
        )}
        <button
          {...attributes}
          {...listeners}
          style={{ touchAction: 'none' }}
          className="cursor-grab text-slate-300 dark:text-slate-600 block p-0.5"
          aria-label={t('todoTab.move')}
        >
          <GripVertical size={14} />
        </button>
        {todo.level < 4 && (
          <button
            onClick={() => onIndent(todo.id)}
            title={t('todoTab.indent')}
            className="absolute left-full top-1/2 -translate-y-1/2 md:static md:translate-y-0 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0 text-slate-300 dark:text-slate-600 hover:text-slate-500 cursor-pointer"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => onUpdate(todo.id, { completed: e.target.checked })}
        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 shrink-0 cursor-pointer"
      />

      <textarea
        ref={textareaRef}
        data-todo-id={todo.id}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('todoTab.newTask')}
        rows={1}
        className={cn(
          'flex-1 min-w-0 resize-none overflow-hidden bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-300 focus:outline-none leading-normal py-0.5',
          todo.completed && 'line-through text-slate-400',
        )}
      />

      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        <button
          onClick={() => onUpdate(todo.id, { urgent: !todo.urgent })}
          title={t('todoTab.markImportant')}
          className={cn(
            'rounded p-0.5 transition-colors cursor-pointer',
            todo.urgent
              ? 'text-amber-500'
              : 'text-slate-300 dark:text-slate-600 hover:text-amber-400',
          )}
        >
          <AlertCircle size={13} />
        </button>
        <button
          onClick={() => onDelete(todo.id, nextTodoId)}
          title={t('common.delete')}
          className="rounded p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
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
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, AlertCircle, Trash2, ChevronRight, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { toast } from '@/store/useAppStore'
import type { Tab, Todo, TodoListConfig } from '@/types'

interface TodoListProps {
  tab: Tab
  onUpdateTab: (updates: Partial<Tab>) => Promise<void>
  className?: string
}

export function TodoList({ tab, onUpdateTab, className }: TodoListProps) {
  const config = tab.config as unknown as TodoListConfig
  const maxOnCard = config?.max_on_card ?? 5
  const [todos, setTodos] = useState<Todo[]>([])
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [newTodoId, setNewTodoId] = useState<string | null>(null)
  // Maps todo.id → stable React key so remounting doesn't occur when tempId is replaced by realId
  const stableKeys = useRef(new Map<string, string>())
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const { t } = useTranslation()

  const fetchTodos = useCallback(async () => {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .eq('tab_id', tab.id)
      .order('position')
    setTodos((data as Todo[]) ?? [])
  }, [tab.id])

  useEffect(() => { fetchTodos() }, [fetchTodos])

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
    setTodos(newList)
    setNewTodoId(tempId)

    const { data, error } = await supabase
      .from('todos')
      .insert({ tab_id: tab.id, content: '', position, parent_id: parentId ?? null, level })
      .select()
      .single()

    if (error) {
      toast.error(t('toasts.tabAddError'))
      setTodos(todos)
      setNewTodoId(null)
      return
    }

    const realTodo = data as Todo
    const finalList = newList.map((t) => (t.id === tempId ? realTodo : t))
    // Reuse the same React key so the component isn't remounted (no focus loss)
    stableKeys.current.set(realTodo.id, tempId)
    setTodos(finalList)
    setNewTodoId(null)
    // Renormalize positions in background — not worth blocking the UI
    renormalizePositions(finalList).catch(() => {})
  }

  async function updateTodo(id: string, updates: Partial<Todo>) {
    await supabase.from('todos').update(updates).eq('id', id)
    setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo)))
  }

  async function deleteTodo(id: string, focusPrevId?: string | null) {
    const prevEl = focusPrevId
      ? document.querySelector<HTMLInputElement>(`[data-todo-id="${focusPrevId}"]`)
      : null
    setTodos((prev) => prev.filter((t) => t.id !== id))
    if (prevEl) {
      requestAnimationFrame(() => {
        prevEl.focus()
        prevEl.setSelectionRange(prevEl.value.length, prevEl.value.length)
      })
    }
    await supabase.from('todos').delete().eq('id', id)
  }

  async function indentTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (!todo || todo.level >= 4) return
    const siblings = todos.filter((t) => t.parent_id === todo.parent_id && t.position < todo.position)
    const newParent = siblings[siblings.length - 1]
    if (!newParent) return
    await updateTodo(id, { level: todo.level + 1, parent_id: newParent.id })
  }

  async function unindentTodo(id: string) {
    const todo = todos.find((t) => t.id === id)
    if (!todo || todo.level === 0) return
    const parent = todos.find((t) => t.id === todo.parent_id)
    await updateTodo(id, { level: todo.level - 1, parent_id: parent?.parent_id ?? null })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = todos.findIndex((todo) => todo.id === active.id)
    const newIndex = todos.findIndex((todo) => todo.id === over.id)
    const newOrder = arrayMove(todos, oldIndex, newIndex)
    setTodos(newOrder)
    renormalizePositions(newOrder)
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
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-700 px-6 py-3 bg-white dark:bg-slate-900">
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

      <div className="px-6 py-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
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
  onUpdate: (id: string, updates: Partial<Todo>) => Promise<void>
  onDelete: (id: string, focusPrevId?: string | null) => Promise<void>
  onIndent: (id: string) => Promise<void>
  onUnindent: (id: string) => Promise<void>
  onAddAfter: (parentId: string | null, level: number) => Promise<void>
}

function SortableTodoItem({
  todo,
  isNew,
  prevTodoId,
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
  const inputRef = useRef<HTMLInputElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (isNew) inputRef.current?.focus()
  }, [isNew])

  function handleContentChange(v: string) {
    setContent(v)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => onUpdate(todo.id, { content: v }), 500)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
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
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        paddingLeft: `${todo.level * 24}px`,
      }}
      className={cn(
        'group flex items-center gap-2 py-1 rounded-md',
        isDragging && 'opacity-50',
        todo.urgent && 'bg-amber-50 dark:bg-amber-900/20 px-2',
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-slate-200 dark:text-slate-700 opacity-0 group-hover:opacity-100 shrink-0"
        aria-label={t('todoTab.move')}
      >
        <GripVertical size={14} />
      </button>

      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => onUpdate(todo.id, { completed: e.target.checked })}
        className="h-4 w-4 rounded border-slate-300 text-indigo-500 focus:ring-indigo-500 shrink-0 cursor-pointer"
      />

      <input
        ref={inputRef}
        data-todo-id={todo.id}
        value={content}
        onChange={(e) => handleContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('todoTab.newTask')}
        className={cn(
          'flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-300 focus:outline-none',
          todo.completed && 'line-through text-slate-400',
        )}
      />

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
        <button
          onClick={() => onUnindent(todo.id)}
          disabled={todo.level === 0}
          title={t('todoTab.outdent')}
          className="rounded p-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 disabled:opacity-30 cursor-pointer"
        >
          <ChevronLeft size={13} />
        </button>
        <button
          onClick={() => onIndent(todo.id)}
          disabled={todo.level >= 4}
          title={t('todoTab.indent')}
          className="rounded p-0.5 text-slate-300 dark:text-slate-600 hover:text-slate-500 disabled:opacity-30 cursor-pointer"
        >
          <ChevronRight size={13} />
        </button>
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
          onClick={() => onDelete(todo.id)}
          title={t('common.delete')}
          className="rounded p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-500 transition-colors cursor-pointer"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

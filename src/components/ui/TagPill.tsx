import { cn } from '@/lib/utils'
import type { Tag } from '@/types'

interface TagPillProps {
  tag: Tag
  className?: string
}

export function TagPill({ tag, className }: TagPillProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}
      style={{
        backgroundColor: `${tag.color}26`,
        color: tag.color,
        border: `1px solid ${tag.color}40`,
      }}
    >
      {tag.name}
    </span>
  )
}

export type TabType = 'description' | 'todo' | 'chaos' | 'digest' | 'widgets'

export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
}

export interface ProjectLink {
  id: string
  project_id: string
  url: string
  label: string | null
  position: number
}

export interface Tab {
  id: string
  project_id: string
  type: TabType
  title: string
  position: number
  config: Record<string, unknown>
}

export interface TodoTabConfig {
  max_on_card: number
}

export interface DigestTabConfig {
  prompt: string
  chaos_tab_ids: string[]
}

export interface Project {
  id: string
  user_id: string
  name: string
  short_description: string | null
  show_short_desc_on_card: boolean
  long_description: string | null
  key_points: string[]
  show_key_points_on_card: boolean
  max_key_points_on_card: number
  archived: boolean
  created_at: string
  updated_at: string
}

// Shape returned by Supabase with nested joins
export interface ProjectRow extends Project {
  project_tags: { tags: Tag }[]
  project_links: ProjectLink[]
}

// Normalized shape used in the app
export interface ProjectWithRelations extends Project {
  tags: Tag[]
  project_links: ProjectLink[]
}

export interface Todo {
  id: string
  tab_id: string
  content: string
  completed: boolean
  urgent: boolean
  position: number
  parent_id: string | null
  level: number
  created_at: string
}

export interface ChaosContent {
  id: string
  tab_id: string
  content: string
  updated_at: string
}

export interface DigestGenerated {
  id: string
  tab_id: string
  content: string
  prompt_used: string
  generated_at: string
}

export interface Widget {
  id: string
  tab_id: string
  title: string
  prompt: string
  content: string | null
  position: number
  last_generated_at: string | null
}

export interface UserSettings {
  user_id: string
  gemini_api_key: string | null
  theme: 'light' | 'dark' | 'system'
}

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  persistent?: boolean
}

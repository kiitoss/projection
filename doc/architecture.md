# Architecture technique

## Vue d'ensemble

```
┌─────────────────────────────────────────┐
│           Navigateur / PWA              │
│                                         │
│  React + Vite + Tailwind                │
│  ├── React Router (SPA)                 │
│  ├── Supabase JS Client                 │
│  │   ├── Auth (Google OAuth)            │
│  │   ├── Database (CRUD + Realtime)     │
│  │   └── Cache local offline            │
│  └── Gemini API Client                  │
│      └── Appels directs (clé user)      │
│                                         │
│  Service Worker (Workbox)               │
│  └── Cache assets + données offline     │
└─────────────────────────────────────────┘
         │                    │
         ▼                    ▼
  ┌─────────────┐    ┌─────────────────┐
  │  Supabase   │    │  Gemini API     │
  │  ├── Auth   │    │  (Google AI)    │
  │  ├── DB     │    └─────────────────┘
  │  └── RT     │
  └─────────────┘
```

## Schéma de base de données (Supabase / PostgreSQL)

### Projets et tags

```sql
CREATE TABLE projects (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   text NOT NULL,
  short_description      text,
  show_short_desc_on_card boolean NOT NULL DEFAULT true,
  long_description       text,
  key_points             text[] NOT NULL DEFAULT '{}',
  show_key_points_on_card boolean NOT NULL DEFAULT true,
  max_key_points_on_card  integer NOT NULL DEFAULT 3,
  archived               boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tags (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name    text NOT NULL,
  color   text NOT NULL DEFAULT '#6366f1'
);

CREATE TABLE project_tags (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);

CREATE TABLE project_links (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  url        text NOT NULL,
  label      text,
  position   integer NOT NULL DEFAULT 0
);
```

### Système d'onglets

```sql
CREATE TYPE tab_type AS ENUM ('description', 'todo', 'chaos', 'digest', 'widgets');

CREATE TABLE tabs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type       tab_type NOT NULL,
  title      text NOT NULL,
  position   integer NOT NULL DEFAULT 0,
  config     jsonb NOT NULL DEFAULT '{}'
  -- config par type :
  -- todo:    { "max_on_card": 5 }
  -- digest:  { "prompt": "...", "chaos_tab_ids": ["uuid", ...] }
  -- widgets: {}
  -- chaos:   {}
);
```

### Todos

```sql
CREATE TABLE todos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id     uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  content    text NOT NULL,
  completed  boolean NOT NULL DEFAULT false,
  urgent     boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0,
  parent_id  uuid REFERENCES todos(id) ON DELETE CASCADE,
  level      integer NOT NULL DEFAULT 0 CHECK (level BETWEEN 0 AND 4),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Contenu Chaos

```sql
CREATE TABLE chaos_content (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id     uuid NOT NULL UNIQUE REFERENCES tabs(id) ON DELETE CASCADE,
  content    text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Digest

```sql
CREATE TABLE digest_generated (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id       uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  content      text NOT NULL,
  prompt_used  text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);
-- Les chaos_tab_ids sont stockés dans tabs.config->>'chaos_tab_ids' (jsonb array)
```

### Widgets

```sql
CREATE TABLE widgets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tab_id            uuid NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
  title             text NOT NULL,
  prompt            text NOT NULL,
  content           text,
  position          integer NOT NULL DEFAULT 0,
  last_generated_at timestamptz
);
```

### Settings utilisateur

```sql
CREATE TABLE user_settings (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  gemini_api_key text,
  theme          text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system'))
);
```

## Row Level Security (RLS)

Toutes les tables sont protégées. L'utilisateur ne peut accéder qu'à ses propres données.
Les tables sans `user_id` direct utilisent une politique via JOIN sur `projects`.

Le script complet est dans `supabase/migrations/001_initial_schema.sql`.

## Authentification

1. L'utilisateur clique "Se connecter avec Google"
2. Supabase Auth redirige vers Google OAuth
3. Après consentement, retour sur l'app avec une session Supabase
4. La session est persistée dans `localStorage` par le client Supabase JS
5. À la première connexion, un enregistrement est créé dans `user_settings` (trigger SQL)

## Realtime (synchronisation multi-appareils)

Supabase Realtime activé sur : `projects`, `tabs`, `todos`, `chaos_content`, `widgets`.

Chaque hook de données s'abonne aux changements lors du montage et se désabonne au démontage.

## PWA et mode offline

- **Service Worker** : `vite-plugin-pwa` (Workbox), NetworkFirst pour Supabase, CacheFirst pour assets
- **Offline** : lecture depuis le cache, indicateur WifiOff dans le header
- **Écriture offline** : les appels Supabase échouent et le hook affiche un toast d'erreur

## Structure de répertoires (frontend)

```
src/
├── components/
│   ├── auth/             # ProtectedRoute
│   ├── ui/               # Button, Modal, Toast, Spinner, ConfirmDialog, TagPill
│   ├── layout/           # Header, Sidebar, Layout
│   ├── project/          # ProjectCard, CreateProjectModal
│   └── tabs/             # TabBar, AddTabModal, DescriptionTab, TodoTab,
│                         # ChaosTab, DigestTab, WidgetsTab
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuth.ts        # (réexporté depuis AuthContext)
│   ├── useOffline.ts
│   ├── useProject.ts     # Projet unique + tabs
│   ├── useProjects.ts    # Liste des projets
│   └── useTags.ts
├── lib/
│   ├── supabase.ts
│   ├── gemini.ts
│   └── utils.ts          # cn(), formatDate(), formatRelativeDate()
├── pages/
│   ├── LoginPage.tsx
│   ├── HomePage.tsx
│   ├── ProjectPage.tsx
│   └── SettingsPage.tsx
├── store/
│   └── useAppStore.ts    # Zustand : filtres, recherche, toasts, sidebar
├── types/
│   └── index.ts
├── App.tsx               # Router + ThemeProvider
└── main.tsx
```

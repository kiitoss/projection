# Projection — CLAUDE.md

## Présentation

Projection est une PWA de gestion de projets personnels. Stack : React 18 + Vite + Tailwind CSS v4, Supabase (auth Google, PostgreSQL, Realtime), Gemini API (clé fournie par l'utilisateur), vite-plugin-pwa. Usage strictement personnel (pas de collaboration en V1).

## Commandes

```bash
pnpm dev          # Serveur de développement
pnpm build        # Build production
pnpm preview      # Prévisualiser le build
```

## Structure

```
projection/
├── doc/
│   ├── overview.md        # Vision, stack, portée V1
│   ├── architecture.md    # Schéma DB, auth, realtime, PWA
│   ├── features.md        # Spécification fonctionnelle
│   ├── ui-ux.md           # Design system, palette, composants
│   └── stories.md         # User stories (US-001 → US-064)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── i18n/
│   │   ├── index.ts               # Setup i18next (LanguageDetector, fallback: 'fr')
│   │   └── locales/
│   │       ├── fr.json            # Traductions françaises
│   │       └── en.json            # Traductions anglaises
│   ├── components/
│   │   ├── auth/
│   │   │   └── ProtectedRoute.tsx
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── TagPill.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── project/
│   │   │   ├── CreateProjectModal.tsx
│   │   │   └── ProjectCard.tsx
│   │   └── tabs/
│   │       ├── AddTabModal.tsx
│   │       ├── ChaosTab.tsx
│   │       ├── DescriptionTab.tsx
│   │       ├── DigestTab.tsx
│   │       ├── TabBar.tsx
│   │       ├── TodoTab.tsx
│   │       └── WidgetsTab.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx    # AuthProvider + useAuth() hook (co-localisés)
│   ├── hooks/
│   │   ├── useOffline.ts
│   │   ├── useProject.ts      # Projet unique + tabs + realtime
│   │   ├── useProjects.ts     # Liste + CRUD + realtime
│   │   └── useTags.ts
│   ├── lib/
│   │   ├── gemini.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ProjectPage.tsx
│   │   └── SettingsPage.tsx
│   ├── store/
│   │   └── useAppStore.ts     # Zustand : filtres, recherche, tri, toasts, sidebar
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx                # Router + ThemeProvider
│   └── main.tsx
├── .env.example
├── index.html
├── vite.config.ts
└── tsconfig.app.json
```

## Stack et points d'attention

### Internationalisation (i18n)

`i18next` + `react-i18next` + `i18next-browser-languagedetector`. Deux locales : `fr` (défaut) et `en`. Initialisé dans `src/i18n/index.ts`, importé dans `src/main.tsx` avant `App`.

```ts
// Dans les composants React et les hooks custom
const { t } = useTranslation()
t('namespace.key')
t('namespace.key', { variable: value })  // interpolation

// Dans le code non-React (gemini.ts)
import i18next from 'i18next'
const { t } = i18next
```

Les constantes contenant du texte UI (`PRESET_WIDGETS`, `TAB_TYPES`, etc.) sont définies **à l'intérieur** des composants pour avoir accès à `t()` au moment du rendu. Ne pas les déplacer au niveau module.

### Tailwind CSS v4 (pas v3)

Tailwind v4 ne génère **pas** de `tailwind.config.js` — il n'existe pas dans ce projet.

```ts
// vite.config.ts — plugin Vite dédié
import tailwindcss from '@tailwindcss/vite'
plugins: [react(), tailwindcss(), VitePWA({...})]
```

```css
/* src/index.css */
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
```

Le dark mode est **class-based** : classe `dark` sur `<html>`. `ThemeProvider` dans `App.tsx` la bascule via `document.documentElement.classList.toggle('dark', isDark)`.

### Alias de chemin

```ts
// vite.config.ts
resolve: { alias: { '@': path.resolve(__dirname, './src') } }

// tsconfig.app.json — pas de baseUrl (déprécié TS7), uniquement paths
"paths": { "@/*": ["./src/*"] }
```

### Utilitaires (`src/lib/utils.ts`)

- `cn(...inputs)` — `clsx` + `tailwind-merge`
- `formatDate(date)` — format français via `Intl.DateTimeFormat`
- `formatRelativeDate(date)` — "il y a X jours"
- `generateId()` — `crypto.randomUUID()`

### Toast helper (`src/store/useAppStore.ts`)

Le helper `toast` appelle `useAppStore.getState()` (pas un hook) → utilisable hors composants React :

```ts
toast.success('Message')
toast.error('Erreur', true)  // persistant
toast.info('Info')
```

### Pattern auto-save

Debounce avec `useRef<ReturnType<typeof setTimeout>>` — pas de librairie tierce :

```ts
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
if (saveTimer.current) clearTimeout(saveTimer.current)
saveTimer.current = setTimeout(() => { /* appel Supabase */ }, 1000)
```

### Pattern normalisation des projets

`useProjects.ts` — `normalizeProject()` aplatit `project_tags[].tags` → `tags[]` pour simplifier les composants.

### Blocage navigation sur les cards

Le composant `ProjectCard` navigue vers `/projects/:id` au clic. Les enfants interactifs (boutons kebab, boutons widget…) portent `data-no-nav` pour bloquer la propagation :

```tsx
// Dans le onClick du card :
if ((e.target as HTMLElement).closest('[data-no-nav]')) return
```

### Couleurs de tags

`TagPill` utilise un suffixe hex pour l'opacité — pas de `rgba()` :

```ts
backgroundColor: `${tag.color}26`  // 15% opacité
borderColor: `${tag.color}40`       // 25% opacité
color: tag.color                    // 100%
```

### Gemini API (`src/lib/gemini.ts`)

Modèle : `import.meta.env.VITE_GEMINI_MODEL` (défaut : `gemini-1.5-flash`). La clé est stockée dans `user_settings.gemini_api_key` (Supabase) et récupérée à la session. Appels directs depuis le frontend, en HTTPS uniquement.

```ts
generateWithGemini(apiKey, prompt, context)
testGeminiKey(apiKey)  // Ping léger pour valider la clé
buildProjectContext({ projectName, longDescription, keyPoints, chaosContents, todos })
```

### Drag & Drop

`@dnd-kit/core` + `@dnd-kit/sortable`. `PointerSensor` avec `distance: 5` pour éviter les clics accidentels.

### TanStack Query (React Query v5)

Cache serveur via `@tanstack/react-query`. Ne pas confondre avec l'état UI géré par Zustand.

`QueryClientProvider` dans `App.tsx` (en dehors de `AuthProvider`), config dans `src/lib/queryClient.ts` : `staleTime: 30_000`, `refetchOnWindowFocus: false` (Realtime gère la fraîcheur).

**Convention de query keys** :
```ts
['projects', userId]   // useProjects — liste des projets
['project', projectId] // useProject — projet + onglets
['tags', userId]       // useTags — liste des tags
['todos', tabId]       // TodoList — todos d'un onglet
['widgets', tabId]     // WidgetsTab — widgets d'un onglet
['chaos', tabId]       // ChaosTab — fetch initial uniquement
```

**OBLIGATOIRE** — les mutations Supabase doivent `throw` sur erreur (Supabase renvoie `{ error }`, ne rejette PAS la Promise) :
```ts
const { error } = await supabase.from('...').update(...)
if (error) throw error  // sans ça, onError ne se déclenche pas
```

**Pattern optimistic update** (toutes les mutations instantanées) :
```ts
useMutation({
  mutationFn: async (vars) => { /* supabase call; if (error) throw error */ },
  onMutate: async (vars) => {
    await qc.cancelQueries({ queryKey })
    const snapshot = qc.getQueryData(queryKey)
    qc.setQueryData(queryKey, (old) => /* apply change */ old)
    return { snapshot }
  },
  onError: (_err, _vars, ctx) => {
    qc.setQueryData(queryKey, ctx!.snapshot)
    toast.error(t('toasts.saveError'))
  },
  onSettled: () => qc.invalidateQueries({ queryKey }),
})
```

**Realtime → QueryClient bridge** (dans le hook propriétaire de la query key) :
```ts
useEffect(() => {
  const channel = supabase
    .channel('channel-name')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tableName' }, () => {
      qc.invalidateQueries({ queryKey: ['resource', scopeId] })
    })
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [scopeId, qc])
```
Toujours `invalidateQueries` dans les bridges — jamais `setQueryData` (évite de parser les payloads Realtime).

**Ne pas migrer vers `useMutation`** :
- `handleChange` dans `ChaosTab.tsx` — debounce 1000ms, write direct Supabase
- `saveTimer` dans `SortableTodoItem` (TodoList) — debounce 500ms sur le contenu
- `saveTimer` dans `DescriptionTab.tsx` — debounce 1000ms descriptions

## Base de données Supabase

Schéma complet dans `supabase/migrations/001_initial_schema.sql`.

### Tables principales

| Table | Description |
|-------|-------------|
| `projects` | Projets (name, short_description, key_points[], archived…) |
| `tags` + `project_tags` | Tags avec junction table |
| `project_links` | Liens web par projet |
| `tabs` | Onglets (type enum: description/todo/chaos/digest/widgets, config jsonb) |
| `todos` | Tâches (completed, urgent, level 0–4, parent_id self-ref) |
| `chaos_content` | Contenu texte libre (UNIQUE sur tab_id) |
| `digest_generated` | Résultats générés par Gemini |
| `widgets` | Widgets IA par projet |
| `user_settings` | Clé Gemini + thème par utilisateur |

### RLS

Toutes les tables ont Row Level Security activé. Tables sans `user_id` direct (todos, chaos_content, etc.) utilisent une politique via JOIN sur `projects`.

### Realtime

Activé sur : `projects`, `tabs`, `todos`, `chaos_content`, `widgets`. Chaque hook s'abonne dans `useEffect` et se désabonne avec `supabase.removeChannel(channel)`.

### Trigger auto

`handle_new_user()` crée automatiquement un enregistrement `user_settings` à la première connexion.

## Setup

Voir `SETUP.md` pour les instructions complètes. Variables d'environnement requises :

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_GEMINI_MODEL=gemini-1.5-flash
```

## Périmètre implémenté (V1)

- Authentification Google via Supabase Auth
- CRUD complet sur les projets (création, renommage, archivage, suppression)
- Système de tags avec filtre multi-sélection (mode ET)
- Recherche par nom (debounce 150ms) + tri (date / alphabétique)
- Cards avec contenu conditionnel (description courte, tags, liens, points clés, todos urgentes, widgets)
- Vue projet avec barre d'onglets (drag & drop, ajout, suppression, renommage)
- Onglet Description : description courte/longue, points clés (D&D), liens web
- Onglet Todo : checkbox, urgence, indentation (Tab/Shift+Tab, max 5 niveaux), D&D, filtres
- Onglet Chaos : textarea libre, auto-save, timestamp
- Onglet Digest : sources Chaos sélectionnables, prompt modifiable, génération Gemini, rendu Markdown
- Onglet Widgets : widgets prédéfinis + personnalisés, regénération individuelle et groupée
- Configuration : clé Gemini (test intégré), thème Système/Clair/Sombre, gestion des tags
- Synchronisation temps réel multi-appareils via Supabase Realtime
- PWA installable (vite-plugin-pwa + Workbox)
- Mode offline : lecture depuis cache, indicateur WifiOff dans le header
- Regénération groupée de tous les widgets depuis le header (⚡)

## Hors scope V1

- Collaboration / partage de projets
- Historique des versions des Digests
- Tri manuel des cards par drag & drop sur la home
- Notifications push
- Export (PDF, JSON)
- Attachements fichiers
- Ajout/modification de tags depuis la vue projet (uniquement depuis Paramètres ou modal création)

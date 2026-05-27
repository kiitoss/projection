# Design system & UX

## Principes

1. **Épuré** : chaque élément a sa raison d'être. Pas de décoration superflue.
2. **Orienté action** : les informations clés et les boutons d'action sont immédiatement visibles.
3. **Cohérent** : mêmes patterns d'interaction partout (modals, toasts, confirmations).
4. **Responsive natif** : l'interface s'adapte sans friction du mobile au desktop.

---

## Responsive breakpoints (Tailwind)

| Breakpoint | Largeur | Grille cards | Sidebar |
|------------|---------|--------------|---------|
| Mobile | < 768px | 1 colonne | Masquée (hamburger) |
| Tablette (`md`) | 768–1023px | 2 colonnes | Masquée (hamburger) |
| Desktop (`lg`) | ≥ 1024px | 4 colonnes | Visible (fixe, ~200px) |

---

## Thèmes

L'application supporte trois modes : **Système** (suit les préférences OS), **Clair**, **Sombre**.

Implémentation : classe `dark` sur `<html>`, Tailwind v4 `@custom-variant dark (&:is(.dark *))`.

### Palette — thème clair

```
Background principal  : #ffffff
Background secondaire : #f8fafc  (slate-50)
Border                : #e2e8f0  (slate-200)
Text primaire         : #0f172a  (slate-900)
Text secondaire       : #64748b  (slate-500)
Accent                : #6366f1  (indigo-500)
Destructif            : #ef4444  (red-500)
```

### Palette — thème sombre

```
Background principal  : #0f172a  (slate-900)
Background secondaire : #1e293b  (slate-800)
Border                : #334155  (slate-700)
Text primaire         : #f1f5f9  (slate-100)
Text secondaire       : #94a3b8  (slate-400)
Accent                : #818cf8  (indigo-400)
Destructif            : #f87171  (red-400)
```

---

## Typographie

| Usage | Taille | Poids |
|-------|--------|-------|
| Titre de page | 24px | 700 |
| Titre de section | 18px | 600 |
| Nom de projet (card) | 14px | 600 |
| Corps | 14px | 400 |
| Label / meta | 12px | 400 |

Police : **Inter** (Google Fonts), fallback system-ui.

---

## Composants clés

### Card projet
- `rounded-xl`, border 1px, `shadow-sm` → `shadow-md` au hover
- Cursor pointer, click navigue vers `/projects/:id`
- Menu ⋮ visible au hover (`opacity-0 group-hover:opacity-100`)

### Tags (pills)
- Fond couleur à ~15% opacité, texte couleur pleine, border à ~25% opacité
- `rounded-full`, 12px, padding 4px 10px

### Boutons
```
Primary   : bg-indigo-500 text-white hover:bg-indigo-600
Secondary : border bg-white hover:bg-slate-50
Danger    : bg-red-500 text-white hover:bg-red-600
Ghost     : transparent hover:bg-slate-100
```

### Modals
- Overlay `bg-black/50`, centré, `rounded-2xl`
- Fermeture : clic overlay, Escape, bouton ✕
- Focus trap implicite

### Toasts
- Position : bas-droite, durée 4s (erreurs persistantes)
- Types : succès (vert), erreur (rouge), info (indigo)
- Border-left colorée par type

### Confirmations
- Focus sur "Annuler" par défaut (sécurité)
- Bouton de confirmation en rouge (variant danger)

### Drag & Drop (`@dnd-kit/core`)
- Curseur `grab` / `grabbing`
- Élément draggé : `opacity-50`
- Activation : `distance: 5px` (évite les clics accidentels)

---

## États vides

| Contexte | Message | Action |
|----------|---------|--------|
| Aucun projet | "Commencez par créer votre premier projet" | Bouton "Créer un projet" |
| Aucun résultat de filtre | "Aucun projet ne correspond à ce filtre" | "Réinitialiser les filtres" |
| Todos vides | "Aucune tâche pour l'instant" | — |
| Chaos vide | Placeholder dans la textarea | — |
| Digest non généré | "Cliquez sur Générer..." | — |
| Widgets vides | Message + bouton "Ajouter un widget" | — |

---

## Accessibilité

- Contraste minimum 4.5:1 (WCAG AA)
- Focus visible sur tous les éléments interactifs (`focus-visible:ring-2`)
- `aria-label` sur les boutons icon-only
- Modals avec `role="dialog"` et `aria-modal="true"`
- Drag & drop avec alternatives clavier (boutons ← →)

---

## Navigation

```
/                     → HomePage
/projects/:id         → ProjectPage (onglet Description par défaut)
/settings             → SettingsPage
/login                → LoginPage (si non authentifié)
```

## Auto-save

- Debounce 1 seconde sur les champs texte (chaos, description)
- Indicateur discret "Sauvegarde..." en bas de page pendant la sauvegarde

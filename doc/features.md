# Spécification fonctionnelle

## Page d'accueil

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER : [Projection]  [+ Nouveau projet]  [⚡ Widgets]  [👤]│
├──────────┬───────────────────────────────────────────────────┤
│ SIDEBAR  │  [🔍 Recherche...]                                 │
│          │                                                    │
│ Tous (8) │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │
│ Travail(3│  │ Card 1 │ │ Card 2 │ │ Card 3 │ │ Card 4 │    │
│ Perso (2)│  └────────┘ └────────┘ └────────┘ └────────┘    │
│ Dev   (4)│  ┌────────┐ ┌────────┐ ...                       │
│          │  │ Card 5 │ │ Card 6 │                            │
│ + Tag    │  └────────┘ └────────┘                            │
└──────────┴───────────────────────────────────────────────────┘
```

### Sidebar (tags)

- Liste de tous les tags avec le nombre de projets associés
- Filtre "Tous" actif par défaut
- Clic sur un tag → filtre la grille en temps réel
- Plusieurs tags sélectionnables simultanément (mode ET)
- Bouton "+ Créer un tag" en bas de la liste
- Collapsible sur mobile (bouton hamburger)

### Header

- **"+ Nouveau projet"** : ouvre la modal de création
- **Bouton ⚡** : visible si au moins un widget existe. Confirmation avant regénération groupée.
- **Avatar** : menu → Paramètres, Déconnexion

### Barre de recherche

- Filtre en temps réel sur le nom (debounce 150ms)
- Compatible avec les filtres de tags

### Grille de cards

- **Desktop (≥1024px)** : 4 colonnes
- **Tablette (768–1023px)** : 2 colonnes
- **Mobile (<768px)** : 1 colonne
- Tri : date de modification décroissante (défaut) ou alphabétique

---

## Card de projet

Contenu conditionnel (n'apparaît que si rempli / activé) :
- Nom + menu ⋮ (Renommer, Archiver, Supprimer)
- Tags (colored pills)
- Description courte (si toggle activé)
- Liens web
- Points clés (si toggle activé, limités à N)
- Todos urgentes (si onglet todo existe, limitées à N)
- Widgets IA avec bouton ⟳ par widget

---

## Vue projet

### Layout

```
┌──────────────────────────────────────────────────────┐
│ ← Projets   Nom du projet   [Tags]                   │
├──────────────────────────────────────────────────────┤
│ [Description] [Todo] [Chaos] [Digest] [+]            │
├──────────────────────────────────────────────────────┤
│                                                       │
│  Contenu de l'onglet actif                           │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### Barre d'onglets

- Scrollable horizontalement
- Drag & drop pour réordonner (sauf Description, toujours en premier)
- Bouton "+" pour ajouter un onglet
- Menu kebab par onglet (au survol) : Renommer, Supprimer

### Modal d'ajout d'onglet

| Type | Limite | Grisé si |
|------|--------|----------|
| Todo | 1 par projet | Un Todo existe déjà |
| Chaos | Illimité | — |
| Digest | Illimité | Aucun Chaos n'existe |
| Widgets | 1 par projet | Un Widgets existe déjà |

---

## Onglet Description (non supprimable)

- **Description courte** : champ texte + toggle "Afficher sur la card"
- **Description longue** : textarea Markdown, auto-save 1s
- **Points clés** : liste éditables, drag & drop, toggle card + sélecteur du nombre affiché
- **Liens web** : liste URL + label, ajout/suppression

---

## Onglet Todo (max 1)

- Config : nombre d'urgentes sur la card (défaut 5)
- Ligne pointillée à la N-ième urgente
- Todos : checkbox, contenu, tag urgent (!), drag & drop
- **Indentation** : max 5 niveaux, Tab / Shift+Tab, boutons ← →
- Ajout : bouton "+ Ajouter" ou Entrée en fin de ligne
- Filtres : Toutes / Actives / Complétées

---

## Onglet Chaos (illimité)

- Titre personnalisable
- Grande textarea libre, auto-save 1s
- Timestamp de dernière modification

---

## Onglet Digest (illimité, lié à 1+ Chaos)

- À la création : sélection des onglets Chaos sources (1+ requis)
- Section prompt : collapsible si contenu existe, dépliée sinon
- Prompt par défaut modifiable, sauvegardé dans `tabs.config`
- Bouton "Générer" → appel Gemini → résultat en Markdown
- Date de dernière génération affichée
- Si clé manquante → bouton désactivé + message vers Paramètres

---

## Onglet Widgets (max 1)

- Bouton "+ Ajouter" → modal : widgets prédéfinis ou personnalisé
- Widgets prédéfinis : "5 todos prioritaires", "Prochaines dates importantes", "Résumé de l'avancement", "Points bloquants"
- Chaque widget : titre, contenu généré, ✎ (modifier prompt), ⟳ (regénérer), suppression
- Drag & drop pour réordonner
- Bouton "Regénérer tous" + confirmation si > 1
- Ces widgets apparaissent sur la card d'accueil

---

## Configuration utilisateur

- **Clé API Gemini** : champ masqué, bouton Afficher/Masquer, bouton Tester
- **Thème** : Système / Clair / Sombre, appliqué immédiatement
- **Gestion des tags** : créer, renommer, changer la couleur, supprimer

---

## Synchronisation temps réel

- Supabase Realtime propage les changements entre appareils
- Les hooks s'abonnent aux événements postgres_changes et refetch

## Mode offline

- Indicateur WifiOff dans le header
- Lecture depuis le cache Service Worker
- Écriture échoue gracieusement (toast d'erreur Supabase)

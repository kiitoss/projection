# User Stories — Projection

## Authentification

**US-001 — Connexion Google**
Je veux me connecter avec mon compte Google pour accéder à mes projets depuis n'importe quel appareil.
- La page `/login` s'affiche si je ne suis pas authentifié
- Un bouton "Se connecter avec Google" déclenche le flow OAuth Supabase
- Après authentification, je suis redirigé vers la home
- Un enregistrement `user_settings` est créé automatiquement à la première connexion

**US-002 — Déconnexion**
Je veux pouvoir me déconnecter pour sécuriser mon compte.
- Un menu accessible depuis l'avatar en haut à droite propose "Déconnexion"
- Après déconnexion, je suis redirigé vers `/login`
- La session est effacée du localStorage

**US-003 — Persistance de session**
Je veux rester connecté entre les visites pour ne pas me reconnecter à chaque fois.
- Au chargement de l'app, la session Supabase est restaurée automatiquement
- Si la session est expirée, je suis redirigé vers `/login`

---

## Page d'accueil

**US-004 — Voir tous mes projets**
Je veux voir tous mes projets sur la page d'accueil sous forme de grille.
- Affichage en 4 colonnes desktop, 2 tablette, 1 mobile
- Triés par date de modification décroissante par défaut
- Les projets archivés ne sont pas affichés
- Un état vide s'affiche si aucun projet n'existe

**US-005 — Filtrer par tag**
Je veux filtrer mes projets par tag depuis la sidebar pour trouver rapidement ce que je cherche.
- La sidebar affiche tous mes tags avec le nombre de projets associés
- "Tous" est sélectionné par défaut
- Le clic sur un tag filtre la grille en temps réel
- Plusieurs tags peuvent être sélectionnés simultanément (mode ET)
- Un clic sur un tag déjà sélectionné le désélectionne

**US-006 — Rechercher un projet**
Je veux rechercher un projet par nom pour y accéder rapidement.
- Une barre de recherche est visible en haut de la grille
- Le filtre s'applique en temps réel (debounce 150ms)
- La recherche est combinable avec les filtres de tags
- "Aucun résultat" s'affiche avec un bouton "Réinitialiser les filtres"

**US-007 — Trier les projets**
Je veux choisir l'ordre d'affichage de mes projets.
- Options : "Dernière modification" (défaut) et "Alphabétique A→Z"
- Le tri est appliqué instantanément

**US-008 — Sidebar responsive**
Je veux accéder aux filtres par tag sur mobile sans perdre de place.
- La sidebar est masquée par défaut sur mobile et tablette
- Un bouton hamburger l'ouvre en overlay
- Sur desktop, la sidebar est fixe et toujours visible

---

## Gestion des projets

**US-009 — Créer un projet**
Je veux créer un nouveau projet pour commencer à organiser mes informations.
- Le bouton "+ Nouveau projet" dans le header ouvre une modal
- Champs : nom (requis), tags (optionnel), description courte (optionnel)
- La validation échoue si le nom est vide
- Un onglet "Description" est créé automatiquement
- Le projet apparaît immédiatement dans la grille

**US-010 — Renommer un projet**
Je veux renommer un projet pour corriger ou faire évoluer son nom.
- Accessible via le menu ⋮ de la card ou depuis la vue projet
- Le nouveau nom est requis
- La modification est sauvegardée instantanément

**US-011 — Archiver un projet**
Je veux archiver un projet inactif pour désencombrer ma vue principale sans supprimer les données.
- Accessible via le menu ⋮ de la card
- Le projet disparaît de la grille principale

**US-012 — Supprimer un projet**
Je veux supprimer définitivement un projet dont je n'ai plus besoin.
- Accessible via le menu ⋮ de la card
- Une confirmation explicite est requise
- La suppression cascade sur tous les onglets, todos, chaos, digest, widgets

**US-013 — Naviguer vers un projet**
Je veux accéder à la vue détaillée d'un projet en cliquant sur sa card.
- Le clic sur la card navigue vers `/projects/:id`
- L'onglet Description est actif par défaut

---

## Card de projet

**US-014 — Voir les informations essentielles sur la card**
Je veux voir d'un coup d'œil les informations clés d'un projet sans l'ouvrir.
- La card affiche : nom, tags, description courte (si activée), liens, points clés (si activés), todos urgentes, widgets IA
- Chaque section n'apparaît que si elle a du contenu

**US-015 — Regénérer un widget depuis la card**
Je veux regénérer le contenu d'un widget IA directement depuis la home.
- Chaque widget sur la card affiche un bouton ⟳
- Le clic déclenche la regénération via Gemini
- Le contenu est mis à jour à la fin de la génération

**US-016 — Regénérer tous les widgets depuis la home**
Je veux regénérer tous les widgets de tous mes projets en une seule action.
- Un bouton ⚡ dans le header n'est visible que si au moins un widget existe
- Un dialog de confirmation indique le nombre de widgets concernés
- Les regénérations s'exécutent en parallèle

---

## Gestion des tags

**US-017 — Créer un tag**
Je veux créer un tag pour catégoriser mes projets.
- Accessible via la modal de création de projet ou les Paramètres
- Champs : nom (requis), couleur (palette prédéfinie)

**US-018 — Associer des tags à un projet**
Je veux associer des tags à un projet pour le catégoriser.
- Depuis la modal de création de projet
- Depuis la vue projet (à implémenter en V2)

**US-019 — Renommer un tag**
Je veux renommer un tag pour corriger son intitulé.
- Accessible depuis les Paramètres → section "Tags"

**US-020 — Changer la couleur d'un tag**
Je veux changer la couleur d'un tag pour améliorer la lisibilité visuelle.
- Accessible depuis les Paramètres

**US-021 — Supprimer un tag**
Je veux supprimer un tag qui ne sert plus.
- Accessible depuis les Paramètres
- La suppression désolidarise le tag de tous les projets

---

## Vue projet

**US-022 — Voir la barre d'onglets**
Je veux voir et naviguer entre les onglets d'un projet.
- La barre d'onglets est visible en haut de la vue projet
- Un breadcrumb "← Projets / Nom du projet" permet de revenir

**US-023 — Ajouter un onglet**
Je veux ajouter un nouvel onglet à un projet.
- Le bouton "+" ouvre une modal listant les types disponibles
- Les types indisponibles sont grisés avec tooltip explicatif

**US-024 — Supprimer un onglet**
Je veux supprimer un onglet devenu inutile.
- Accessible via le menu kebab de l'onglet
- L'onglet "Description" ne peut pas être supprimé
- Confirmation requise

**US-025 — Renommer un onglet**
Je veux renommer un onglet pour lui donner un titre plus parlant.
- Accessible via le menu kebab de l'onglet

**US-026 — Réordonner les onglets**
Je veux changer l'ordre des onglets par drag & drop.
- L'onglet "Description" reste toujours en première position

---

## Onglet Description

**US-027 — Ajouter une description courte**
Je veux ajouter une description courte affichée sur la card d'accueil.
- Champ texte, auto-save 1s

**US-028 — Afficher/masquer la description courte sur la card**
Je veux contrôler si la description courte apparaît sur la card.
- Toggle "Afficher sur la card" activé par défaut

**US-029 — Ajouter une description longue**
Je veux documenter l'historique et les détails importants du projet.
- Textarea Markdown, auto-save 1s

**US-030 — Gérer les points clés**
Je veux définir des points clés affichés sur la card d'accueil.
- Ajout, suppression, réordonnement drag & drop
- Toggle "Afficher sur la card" + sélecteur du nombre affiché

**US-031 — Gérer les liens web**
Je veux associer des liens à mon projet.
- Ajout via "+ Ajouter un lien" (URL + label optionnel)
- Suppression par lien, affichés sur la card

---

## Onglet Todo

**US-032 — Créer l'onglet Todo**
Je veux ajouter un onglet Todo à mon projet.
- Un seul onglet Todo par projet

**US-033 — Ajouter une todo**
Je veux ajouter une tâche à ma liste.
- Bouton "+ Ajouter une todo" ou Entrée en fin de ligne

**US-034 — Cocher une todo**
Je veux marquer une todo comme complétée.
- Checkbox, todo barrée visuellement

**US-035 — Marquer une todo comme urgente**
Je veux signaler qu'une tâche est urgente pour qu'elle apparaisse sur la card.
- Bouton ! sur chaque todo

**US-036 — Supprimer une todo**
Je veux supprimer une tâche.
- Bouton poubelle visible au hover

**US-037 — Réordonner les todos par drag & drop**
Je veux changer l'ordre des todos.
- Handle grip à gauche de chaque todo

**US-038 — Indenter une todo**
Je veux créer une hiérarchie dans mes todos.
- Tab pour indenter, Shift+Tab pour désindenter (max 5 niveaux)
- Boutons ← → visibles au hover

**US-039 — Configurer le nombre de todos sur la card**
Je veux choisir combien de todos urgentes apparaissent sur la card.
- Sélecteur en haut de l'onglet (défaut 5)
- Ligne pointillée sur la liste indique la limite

**US-040 — Filtrer les todos**
Je veux afficher uniquement les todos actives ou complétées.
- Filtres : Toutes / Actives / Complétées

---

## Onglet Chaos

**US-041 — Créer un onglet Chaos**
Je veux créer un espace de notes libres pour un projet.
- Titre personnalisé, plusieurs onglets Chaos par projet possibles

**US-042 — Saisir des notes libres**
Je veux écrire librement toutes mes informations sans structure imposée.
- Grande textarea, auto-save 1s, timestamp de dernière modification

---

## Onglet Digest

**US-043 — Créer un onglet Digest**
Je veux créer un résumé IA à partir de mes notes Chaos.
- Sélection des onglets Chaos sources à la création (1 minimum)
- Plusieurs Digest par projet possibles

**US-044 — Sélectionner les sources Chaos d'un Digest**
Je veux choisir quels onglets Chaos alimentent mon Digest.
- Sélection par checkboxes, minimum 1 source requise

**US-045 — Générer un Digest**
Je veux que l'IA synthétise mes notes en un compte rendu clair.
- Bouton "Générer", contenu envoyé à Gemini, résultat en Markdown
- Date de génération affichée

**US-046 — Personnaliser le prompt du Digest**
Je veux adapter les instructions données à l'IA.
- Champ prompt modifiable, prompt par défaut pré-rempli

**US-047 — Replier la section prompt après génération**
Je veux que la section prompt soit discrète une fois que j'ai un contenu.
- Section dépliée si vide, repliée par défaut si contenu existe

**US-048 — Message si aucune clé Gemini n'est configurée**
Je veux être guidé vers la configuration si je tente de générer sans clé API.
- Bouton désactivé + message avec lien vers Paramètres

---

## Onglet Widgets

**US-049 — Créer l'onglet Widgets**
Je veux activer les widgets IA pour qu'ils apparaissent sur ma card.
- Un seul onglet Widgets par projet

**US-050 — Ajouter un widget prédéfini**
Je veux choisir parmi des widgets IA prêts à l'emploi.
- 4 widgets prédéfinis disponibles dans la modal

**US-051 — Ajouter un widget personnalisé**
Je veux créer un widget avec mon propre prompt.
- Option "Widget personnalisé" → titre + prompt libres

**US-052 — Modifier le prompt d'un widget**
Je veux ajuster les instructions d'un widget.
- Bouton ✎ ouvre une modal avec titre et prompt modifiables

**US-053 — Regénérer un widget**
Je veux mettre à jour le contenu d'un widget spécifique.
- Bouton ⟳ par widget, spinner pendant la génération

**US-054 — Regénérer tous les widgets d'un projet**
Je veux mettre à jour tous les widgets en une seule action.
- Bouton "Regénérer tous" + confirmation si > 1

**US-055 — Réordonner les widgets**
Je veux choisir l'ordre d'affichage des widgets.
- Drag & drop sur la liste

**US-056 — Supprimer un widget**
Je veux supprimer un widget devenu inutile.
- Bouton poubelle par widget

---

## Configuration utilisateur

**US-057 — Saisir ma clé API Gemini**
Je veux configurer ma clé API Gemini pour activer les fonctionnalités IA.
- Champ masqué, bouton Afficher/Masquer, sauvegarde auto

**US-058 — Tester ma clé API Gemini**
Je veux vérifier que ma clé est valide avant de tenter une génération.
- Bouton "Tester" → feedback succès/erreur

**US-059 — Choisir le thème**
Je veux personnaliser l'apparence de l'application.
- Options : Système / Clair / Sombre, appliqué immédiatement

---

## PWA & Installation

**US-060 — Installer l'application sur mon appareil**
Je veux installer Projection comme une application native.
- Manifest PWA configuré, installation possible depuis le navigateur

**US-061 — Consulter mes projets hors ligne**
Je veux accéder à mes projets même sans connexion internet.
- Cache Service Worker, indicateur WifiOff dans le header

**US-062 — Être informé qu'une modification est impossible offline**
Je veux savoir pourquoi je ne peux pas modifier mes données hors ligne.
- Les actions de modification échouent avec un toast d'erreur

**US-063 — Retrouver mes données synchronisées au retour en ligne**
Je veux que mes données soient à jour automatiquement quand la connexion revient.
- Abonnements Realtime se reconnectent automatiquement

---

## Synchronisation multi-appareils

**US-064 — Voir les modifications d'un autre appareil en temps réel**
Je veux que les changements effectués sur mon téléphone apparaissent instantanément sur mon PC.
- Supabase Realtime, latence < 1s sur réseau normal

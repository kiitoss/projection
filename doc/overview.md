# Projection — Vue d'ensemble

## Vision

Projection est un outil de gestion de projets personnels, conçu pour être installable et utilisable sur tous les appareils (PC, tablette, smartphone) avec synchronisation automatique. L'interface est volontairement épurée et orientée vers l'essentiel : voir l'état de ses projets d'un coup d'œil, et accéder rapidement aux informations importantes.

## Public cible

Usage personnel, un seul utilisateur. Pas de collaboration en V1.

## Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Frontend | React 18 + Vite | Pas de SSR nécessaire, build rapide, écosystème riche |
| Styles | Tailwind CSS v4 | Utility-first, cohérence, responsive natif |
| PWA | vite-plugin-pwa (Workbox) | Installation native, cache offline |
| Backend / DB | Supabase | BaaS complet : auth, PostgreSQL, realtime, RLS |
| Auth | Google OAuth via Supabase Auth | Login unique, pas de mot de passe à gérer |
| IA | Gemini API (clé fournie par l'utilisateur) | Génération de Digests et widgets, appels directs depuis le frontend |
| Routing | React Router v6 | SPA navigation |
| Drag & Drop | @dnd-kit/core | Accessible, flexible, pas de dépendances lourdes |
| Icônes | Lucide React | Cohérent, léger, tree-shakeable |

## Décisions architecturales

### Pas de backend custom
Les appels à l'API Gemini sont effectués directement depuis le navigateur avec la clé fournie par l'utilisateur. Supabase gère tout le reste (auth, données, realtime). Aucun serveur à déployer ou maintenir.

### Clé API Gemini côté client
La clé est stockée dans la table `user_settings` (Supabase, chiffrement at-rest inclus) et récupérée à la session. Elle transite en HTTPS uniquement. L'utilisateur est responsable de sa propre clé.

### Supabase comme seul datastore
PostgreSQL gère parfaitement de grandes quantités de texte sans limite pratique (contrairement à Firestore qui est limité à 1 Mo par document). Les onglets Chaos peuvent donc être aussi longs que nécessaire.

### PWA offline en lecture seule
Le Service Worker met en cache les assets et les dernières données lues. En cas de perte de connexion, l'utilisateur peut consulter ses projets. Les modifications sont bloquées jusqu'au retour de la connexion, avec un indicateur visuel clair.

## Portée V1

**Inclus :**
- Authentification Google
- CRUD complet sur les projets
- Système de tags et filtres
- Onglets : Description, Todo (avec indentation), Chaos, Digest (IA), Widgets (IA)
- Synchronisation temps réel multi-appareils via Supabase Realtime
- PWA installable, mode offline lecture seule
- Configuration : clé Gemini, thème clair/sombre/système

**Hors scope V1 :**
- Collaboration / partage de projets
- Historique des versions des Digests
- Tri manuel des cards (drag & drop sur la home)
- Notifications push
- Export (PDF, JSON)
- Attachements fichiers

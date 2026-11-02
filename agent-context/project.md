# Ma Matrice Eisenhower - Contexte produit

Version Git : development

## Vision produit

```markdown
Ma Matrice Eisenhower
Objectif
Ma Matrice Eisenhower est une application personnelle de gestion des tâches destinée à transformer une liste de choses à faire en système simple de capture, de décision et d'exécution.

Principes
La matrice Eisenhower reste la fonction centrale.
L'application doit être extrêmement rapide à utiliser.
L'expérience doit être excellente sur PC et mobile.
L'application doit rester compréhensible sans formation.
Les fonctionnalités doivent réduire la friction et non ajouter de la gestion.
Les paramètres sont propres à chaque utilisateur.
Une utilisation familiale doit être possible sans partager les données entre utilisateurs.
Stack
React
Vite
JavaScript / JSX
Supabase Auth
PostgreSQL
Row Level Security
Vercel
PWA
GitHub
lucide-react
Quadrants
do : Faire maintenant
plan : Planifier
delegate : Déléguer
eliminate : Éliminer
Fonctionnalités actuelles
Authentification
Synchronisation Supabase
Matrice 4 quadrants
Vue liste
Ajout et modification de tâches
Notes
Tags
Échéances
Alerte échéance proche
Détection des retards
Heure de fin de journée configurable
Tâches terminées
Corbeille
Conservation configurable
Recherche
PWA
Mise à jour PWA
Interface responsive
Hors périmètre actuel
Ne pas transformer l'application en outil de gestion de projet complexe.

À éviter sauf besoin explicite :

Gantt
commentaires collaboratifs
permissions avancées
gestion de portefeuille
pièces jointes complexes
workflows d'entreprise
```

---

## Architecture

```markdown
Architecture
Application
React / Vite | v Supabase JS | +-- Auth | +-- PostgreSQL | +-- tasks | +-- user_settings

Déploiement
Codespaces | v GitHub | v Vercel | v PWA Production

Données
Chaque utilisateur dispose de son propre user_id.

Les politiques RLS assurent l'isolation des données.

Configuration
Les variables Vite utilisées pour Supabase sont fournies par l'environnement et ne doivent pas être codées en dur.

Les secrets Supabase ne doivent jamais être présents dans le code client.

PWA
La version Production utilise le domaine Vercel principal.

Les mises à jour de la PWA sont gérées par le service worker et ReloadPrompt.
```

---

## Décisions

```markdown
Décisions d'architecture
ADR-001
Supabase est le backend de référence.

ADR-002
L'application est une PWA et non une application Android native.

ADR-003
Vercel héberge la version Production.

ADR-004
GitHub est la source de vérité du code.

ADR-005
Les données sont séparées par user_id et protégées par RLS.

ADR-006
Les échéances utilisent l'heure locale de l'utilisateur.

ADR-007
L'heure de fin de journée est configurable.

ADR-008
Le seuil d'échéance proche est configurable.

ADR-009
La conservation des tâches terminées et de la corbeille sont deux paramètres différents.

ADR-010
La simplicité d'utilisation prime sur l'ajout de fonctionnalités.

ADR-011
Pour les modifications de code, préférer un patch ciblé à une réécriture complète.
```


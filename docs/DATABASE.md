## Table `tasks`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `id` | `uuid` | Primary |
| `user_id` | `uuid` |  |
| `title` | `text` |  |
| `quadrant` | `text` |  |
| `due_date` | `date` |  Nullable |
| `tag` | `text` |  Nullable |
| `notes` | `text` |  Nullable |
| `done` | `bool` |  |
| `deleted_at` | `timestamptz` |  Nullable |
| `created_at` | `timestamptz` |  |
| `updated_at` | `timestamptz` |  |
| `due` | `timestamptz` |  Nullable |
| `completed_at` | `timestamptz` |  Nullable |

Les tâches appartiennent à un utilisateur via user_id.

RLS est activé.

Un utilisateur authentifié ne doit pouvoir lire ou modifier que ses propres tâches.

## Table subtasks
Sous-tâches simples rattachées à une tâche principale.

### Colonnes

- id : uuid, clé primaire
- task_id : uuid, référence tasks.id, suppression en cascade
- user_id : uuid, propriétaire de la sous-tâche
- title : text, obligatoire, non vide, 300 caractères maximum
- due : date, échéance facultative indépendante de la tâche principale
- done : boolean, false par défaut
- created_at : timestamptz
- updated_at : timestamptz

### Comportement

- Une tâche peut avoir plusieurs sous-tâches.
- Une sous-tâche appartient à une seule tâche.
- Aucun niveau de sous-sous-tâche.
- La suppression définitive d’une tâche supprime ses sous-tâches.
- La mise en corbeille conserve les sous-tâches.
- Une sous-tâche possède sa propre échéance facultative.

### Sécurité

RLS est activé.

Les opérations SELECT, INSERT, UPDATE et DELETE sont réservées aux utilisateurs authentifiés propriétaires de la sous-tâche et de la tâche principale.

## Table `user_settings`

### Columns

| Name | Type | Constraints |
|------|------|-------------|
| `user_id` | `uuid` | Primary |
| `end_of_day` | `time` |  |
| `trash_retention_days` | `int4` |  |
| `updated_at` | `timestamptz` |  |
| `completed_retention_days` | `int4` |  |
| `due_soon_hours` | `int4` |  |

Les paramètres appartiennent individuellement à chaque utilisateur.

Règles fonctionnelles
Échéances
L'heure d'échéance d'une tâche est définie par :

user_settings.end_of_day

L'alerte orange dépend de :

user_settings.due_soon_hours

Corbeille
Une tâche est dans la corbeille lorsque :

deleted_at != null

La conservation dépend de :

trash_retention_days

Tâches terminées
Une tâche terminée possède :

done = true completed_at != null

La conservation dépend de :

completed_retention_days
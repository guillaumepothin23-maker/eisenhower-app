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
# Ma Matrice Eisenhower - État actuel du code source

Ce document contient le code source actuel de l'application Ma Matrice Eisenhower.

Version Git : development

## Inventaire des fichiers source

- src/App.jsx
- src/main.jsx
- src/index.css
- src/supabase.js
- src/ReloadPrompt.jsx
- package.json
- vite.config.js

---

# FILE: src/App.jsx

Path: src/App.jsx
Type: application source file

```jsx
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Check,
  X,
  LayoutGrid,
  List,
  Wifi,
  RotateCcw,
  Tag,
  Clock3,
  LogOut,
  Loader2,
  Settings
} from "lucide-react";
import ReloadPrompt from './ReloadPrompt'

import { supabase } from "./supabase";
import "./index.css";

const QUADRANTS = [
  {
    id: "do",
    title: "Faire maintenant",
    subtitle: "Urgent + important",
    className: "quadrant-red",
  },
  {
    id: "plan",
    title: "Planifier",
    subtitle: "Important, non urgent",
    className: "quadrant-blue",
  },
  {
    id: "delegate",
    title: "Déléguer",
    subtitle: "Urgent, moins important",
    className: "quadrant-amber",
  },
  {
    id: "eliminate",
    title: "Éliminer ou Bonus",
    subtitle: "Ni urgent, ni important",
    className: "quadrant-grey",
  },
];

const TAGS = [
  "Travail",
  "Maison",
  "Famille",
  "Finance",
  "Admin",
  "Perso",
];

const EMPTY_FORM = {
  title: "",
  quadrant: "do",
  due: "",
  tag: "Perso",
  notes: "",
};

const DEFAULT_SETTINGS = {
  end_of_day: "17:00",
  due_soon_hours: 48,
  trash_retention_days: 30,
  completed_retention_days: 7,
};

const formatDueDate = (due) => {
  if (!due) return "";

  const normalizedDate = String(due).slice(0, 10);

  return /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)
    ? normalizedDate
    : "";
};

function getDeadlineInfo(
                          due,
                          done,
                          endOfDay = "17:00",
                          dueSoonHours = 48
                        ) {
  if (!due || done) return null;

  // On ne conserve que YYYY-MM-DD, comme formatDueDate()
  const normalizedDate = String(due).slice(0, 10);

  const match = normalizedDate.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (!match) {
    return {
      type: "normal",
      label: null,
    };
  }

  const [, year, month, day] = match;

  // Une tâche est considérée comme due à la fin du jour choisi.
  // Construction en heure LOCALE pour éviter les décalages UTC.
  const [endHour, endMinute] = String(endOfDay)
  .split(":")
  .map(Number);

  const safeHour = Number.isInteger(endHour)
    ? endHour
    : 17;

  const safeMinute = Number.isInteger(endMinute)
    ? endMinute
    : 0;

  const deadline = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    safeHour,
    safeMinute,
    0,
    0
  );

  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();

  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  // Échéance dépassée
  if (diffMs < 0) {
    const overdueMs = Math.abs(diffMs);
    const days = Math.floor(overdueMs / DAY_MS);
    const hours = Math.floor(
      (overdueMs % DAY_MS) / HOUR_MS
    );

    return {
      type: "overdue",
      label:
        days > 0
          ? `En retard de ${days} j ${hours} h`
          : `En retard de ${hours} h`,
    };
  }

  // Échéance dans moins de 48 h
  const alertHours = Number(dueSoonHours);

  const safeAlertHours =
    Number.isFinite(alertHours) && alertHours > 0
      ? alertHours
      : 48;

  if (diffMs < safeAlertHours * HOUR_MS) {    const days = Math.floor(diffMs / DAY_MS);
    const hours = Math.floor(
      (diffMs % DAY_MS) / HOUR_MS
    );

    return {
      type: "soon",
      label:
        days > 0
          ? `Dans ${days} j ${hours} h`
          : `Dans ${hours} h`,
    };
  }

  return {
    type: "normal",
    label: null,
  };
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("Tous");
  const [view, setView] = useState("grid");
  const [section, setSection] = useState("tasks");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  async function loadSettings() {
    if (!session?.user?.id) return null;

    setSettingsLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("user_settings")
      .select(
        "end_of_day, due_soon_hours, trash_retention_days, completed_retention_days"
      )
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (error) {
      setError(
        `Impossible de charger les paramètres : ${error.message}`
      );
      setSettingsLoading(false);
      return null;
    }

    // Première connexion : création des paramètres par défaut
    if (!data) {
      const initialSettings = {
        user_id: session.user.id,
        ...DEFAULT_SETTINGS,
      };

      const { data: created, error: insertError } =
        await supabase
          .from("user_settings")
          .insert(initialSettings)
          .select(
            "end_of_day, due_soon_hours, trash_retention_days, completed_retention_days"
          )
          .single();

      if (insertError) {
        setError(
          `Impossible de créer les paramètres : ${insertError.message}`
        );
        setSettingsLoading(false);
        return null;
      }

      const normalizedSettings = {
        end_of_day: String(
          created.end_of_day
        ).slice(0, 5),
        due_soon_hours: Number(
          created.due_soon_hours
        ),
        trash_retention_days: Number(
          created.trash_retention_days
        ),
        completed_retention_days: Number(
          created.completed_retention_days
        ),
      };

      setSettings(normalizedSettings);
      setSettingsLoading(false);

      return normalizedSettings;
    }

    const normalizedSettings = {
      end_of_day: String(
        data.end_of_day
      ).slice(0, 5),
      due_soon_hours: Number(
        data.due_soon_hours
      ),
      trash_retention_days: Number(
        data.trash_retention_days
      ),
      completed_retention_days: Number(
        data.completed_retention_days
      ),
    };

setSettings(normalizedSettings);
setSettingsLoading(false);

return normalizedSettings;

    return data;
}

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setTasks([]);
      setSettings(DEFAULT_SETTINGS);
      return;
    }

    initializeUserData();
  }, [session?.user?.id]);

  async function signIn(event) {
    event.preventDefault();

    setAuthError("");
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setAuthError(error.message);
    }

    setAuthLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function loadTasks() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data ?? []);
    }

    setLoading(false);
  }

  async function purgeExpiredTrash(retentionDays) {
    if (!session?.user?.id) return;

    const days = Number(retentionDays);

    if (!Number.isFinite(days) || days <= 0) {
      return;
    }

    const cutoff = new Date();

    cutoff.setDate(
      cutoff.getDate() - days
    );

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", session.user.id)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff.toISOString());

    if (error) {
      console.error(
        "Erreur pendant la purge de la corbeille :",
        error.message
      );

      setError(
        `La purge automatique n’a pas pu être effectuée : ${error.message}`
      );
    }
  }

  async function purgeExpiredCompleted(retentionDays) {
    if (!session?.user?.id) return;

    const days = Number(retentionDays);

    if (!Number.isFinite(days) || days <= 0) {
      return;
    }

    const cutoff = new Date();

    cutoff.setDate(
      cutoff.getDate() - days
    );

    const { error: purgeError } = await supabase
      .from("tasks")
      .delete()
      .eq("user_id", session.user.id)
      .eq("done", true)
      .is("deleted_at", null)
      .not("completed_at", "is", null)
      .lt("completed_at", cutoff.toISOString());

    if (purgeError) {
      console.error(
        "Erreur pendant la purge des tâches terminées :",
        purgeError.message
      );

      setError(
        `La purge des tâches terminées n’a pas pu être effectuée : ${purgeError.message}`
      );

      return false;
    }

    return true;
  }

  async function initializeUserData() {
    const loadedSettings = await loadSettings();

    if (!loadedSettings) {
      await loadTasks();
      return;
    }

    await purgeExpiredTrash(
      loadedSettings.trash_retention_days
    );

    await purgeExpiredCompleted(
      loadedSettings.completed_retention_days
    );

    await loadTasks();
  }

  async function saveSettings() {
    if (!session?.user?.id) return;

    setSettingsSaving(true);
    setError("");

    const values = {
      user_id: session.user.id,
      end_of_day: String(
        settings.end_of_day
      ).slice(0, 5),
      due_soon_hours: Number(
        settings.due_soon_hours
      ),
      trash_retention_days: Number(
        settings.trash_retention_days
      ),
      completed_retention_days: Number(
        settings.completed_retention_days
      ),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("user_settings")
      .upsert(values, {
        onConflict: "user_id",
      })
      .select(
        "end_of_day, due_soon_hours, trash_retention_days, completed_retention_days"
      )
      .single();

    if (error) {
      setError(
        `Impossible d’enregistrer les paramètres : ${error.message}`
      );
      setSettingsSaving(false);
      return;
    }

    setSettings(data);
    setSettingsOpen(false);
    setSettingsSaving(false);

    // Appliquer immédiatement le nouveau délai de rétention
    await purgeExpiredTrash(
      data.trash_retention_days
    );

    await purgeExpiredCompleted(
      data.completed_retention_days
    );

    await loadTasks();
  }

  function openNewTask(quadrant = "do") {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      quadrant,
    });
    setModalOpen(true);
  }

  function openEditTask(task) {
    setEditingId(task.id);

    setForm({
      title: task.title,
      quadrant: task.quadrant,
      due: formatDueDate(task.due) ?? "",
      tag: task.tag ?? "Perso",
      notes: task.notes ?? "",
    });

    setModalOpen(true);
  }

  async function saveTask() {
    if (!form.title.trim()) return;

    setError("");

    const values = {
      title: form.title.trim(),
      quadrant: form.quadrant,
      due: form.due || null,
      tag: form.tag,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    let result;

    if (editingId) {
      result = await supabase
        .from("tasks")
        .update(values)
        .eq("id", editingId);
    } else {
      result = await supabase.from("tasks").insert({
        ...values,
        user_id: session.user.id,
        done: false,
      });
    }

    if (result.error) {
      setError(result.error.message);
      return;
    }

    setModalOpen(false);
    setForm(EMPTY_FORM);

    await loadTasks();
  }

  async function updateTask(id, changes) {
    setError("");

    const { error } = await supabase
      .from("tasks")
      .update({
        ...changes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadTasks();
  }

  async function moveToTrash(task) {
    await updateTask(task.id, {
      deleted_at: new Date().toISOString(),
    });
  }

  async function restoreTask(task) {
    await updateTask(task.id, {
      deleted_at: null,
    });
  }

  async function deletePermanently(task) {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", task.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadTasks();
  }

  async function handleDrop(event, quadrant) {
    event.preventDefault();

    const id = event.dataTransfer.getData("taskId");

    if (!id) return;

    await updateTask(id, { quadrant });
  }

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const searchable =
        `${task.title} ${task.notes ?? ""} ${task.tag ?? ""}`.toLowerCase();

      const matchesSearch = !q || searchable.includes(q);

      const matchesTag =
        tagFilter === "Tous" || task.tag === tagFilter;

      return matchesSearch && matchesTag;
    });
  }, [tasks, search, tagFilter]);

  const activeTasks = filteredTasks.filter(
    (task) => !task.done && !task.deleted_at
  );

  const completedTasks = filteredTasks.filter(
    (task) => task.done && !task.deleted_at
  );

  const trashTasks = filteredTasks.filter(
    (task) => Boolean(task.deleted_at)
  );

  const activeCount = tasks.filter(
    (task) => !task.done && !task.deleted_at
  ).length;

  const completedCount = tasks.filter(
    (task) => task.done && !task.deleted_at
  ).length;

  const trashCount = tasks.filter(
    (task) => Boolean(task.deleted_at)
  ).length;

  if (authLoading && !session) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={32} />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">E</div>

          <h1>Ma Matrice Eisenhower</h1>

          <p className="login-description">
            Décider vite, agir sur l'essentiel.
          </p>

          <form onSubmit={signIn}>
            <label>
              E-mail
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.fr"
              />
            </label>

            <label>
              Mot de passe
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ton mot de passe"
              />
            </label>

            {authError && (
              <div className="error-box">
                {authError}
              </div>
            )}

            <button
              type="submit"
              className="primary-button login-button"
              disabled={authLoading}
            >
              {authLoading ? (
                <>
                  <Loader2 size={17} className="spin" />
                  Connexion...
                </>
              ) : (
                "Se connecter"
              )}
            </button>
          </form>

          <div className="login-footer">
            Connexion à ton espace personnel
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <h1>Ma Matrice Eisenhower</h1>
          <p>Décider vite, agir sur l'essentiel</p>
        </div>

        <div className="search">
          <Search size={17} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une tâche, une note ou un tag"
          />
        </div>

        <button
          className="secondary-button"
          onClick={() =>
            setView(view === "grid" ? "list" : "grid")
          }
        >
          {view === "grid" ? <List size={17} /> : <LayoutGrid size={17} />}
          {view === "grid" ? "Liste" : "Matrice"}
        </button>

        <button
          className="primary-button"
          onClick={() => openNewTask()}
        >
          <Plus size={17} />
          Ajouter
        </button>

        <button
          className="icon-button"
          onClick={() => setSettingsOpen(true)}
          title="Paramètres"
        >
          <Settings size={18} />
        </button>

        <button
          className="icon-button"
          onClick={signOut}
          title={`Déconnexion de ${session.user.email}`}
        >
          <LogOut size={18} />
        </button>
      </header>

      <main className="content">
        <div className="toolbar">
          <div className="sections">
            <button
              className={section === "tasks" ? "pill pill-active" : "pill"}
              onClick={() => setSection("tasks")}
            >
              Tâches {activeCount}
            </button>

            <button
              className={section === "done" ? "pill pill-done" : "pill"}
              onClick={() => setSection("done")}
            >
              Terminées {completedCount}
            </button>

            <button
              className={section === "trash" ? "pill pill-trash" : "pill"}
              onClick={() => setSection("trash")}
            >
              Corbeille {trashCount}
            </button>
          </div>

          <div className="sync-status">
            {loading ? (
              <Loader2 size={15} className="spin" />
            ) : (
              <Wifi size={15} />
            )}

            {loading ? "Synchronisation..." : "Supabase connecté"}
          </div>
        </div>

        <div className="tag-filter">
          {["Tous", ...TAGS].map((tag) => (
            <button
              key={tag}
              className={
                tagFilter === tag
                  ? "tag-button tag-button-active"
                  : "tag-button"
              }
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {error && <div className="error-box">{error}</div>}

        {section === "tasks" && (
          <>
            {view === "grid" ? (
              <div className="matrix">
                {QUADRANTS.map((quadrant) => {
                  const quadrantTasks = activeTasks.filter(
                    (task) => task.quadrant === quadrant.id
                  );

                  return (
                    <section
                      key={quadrant.id}
                      className={`quadrant ${quadrant.className}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, quadrant.id)}
                    >
                      <div className="quadrant-header">
                        <div>
                          <h2>
                            <span className="quadrant-dot" />
                            {quadrant.title}
                          </h2>

                          <p>
                            {quadrant.subtitle} · {quadrantTasks.length}
                          </p>
                        </div>

                        <button
                          className="icon-button"
                          onClick={() => openNewTask(quadrant.id)}
                        >
                          <Plus size={18} />
                        </button>
                      </div>

                      <div className="task-list">
                        {quadrantTasks.map((task) => (
                          <TaskCard
                            settings={settings}
                            key={task.id}
                            task={task}
                            onEdit={() => openEditTask(task)}
                            onComplete={() =>
                              updateTask(task.id, {
                                done: true,
                                completed_at: new Date().toISOString(),
                              })
                            }
                            onDelete={() => moveToTrash(task)}
                          />
                        ))}

                        {quadrantTasks.length === 0 && (
                          <button
                            className="empty-quadrant"
                            onClick={() => openNewTask(quadrant.id)}
                          >
                            <Plus size={17} />
                            Ajouter une tâche
                          </button>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            ) : (
              <div className="list-panel">
                {activeTasks.length ? (
                  activeTasks.map((task) => (
                    <TaskCard
                      settings={settings}
                      key={task.id}
                      task={task}
                      onEdit={() => openEditTask(task)}
                      onComplete={() =>
                        updateTask(task.id, {
                          done: true,
                          completed_at: new Date().toISOString(),
                        })
                      }
                      onDelete={() => moveToTrash(task)}
                    />
                  ))
                ) : (
                  <EmptyState text="Aucune tâche active." />
                )}
              </div>
            )}
          </>
        )}

        {section === "done" && (
          <div className="list-panel">
            <h2>Tâches terminées</h2>

            {completedTasks.length ? (
              completedTasks.map((task) => (
                <TaskCard
                  settings={settings}
                  key={task.id}
                  task={task}
                  onEdit={() => openEditTask(task)}
                  onComplete={() =>
                    updateTask(task.id, {
                      done: false,
                      completed_at: null,
                    })
                  }
                  onDelete={() => moveToTrash(task)}
                />
              ))
            ) : (
              <EmptyState text="Aucune tâche terminée." />
            )}
          </div>
        )}

        {section === "trash" && (
          <div className="list-panel">
            <h2>Corbeille</h2>

            {trashTasks.length ? (
              trashTasks.map((task) => (
                <div className="trash-item" key={task.id}>
                  <strong>{task.title}</strong>

                  <div className="trash-actions">
                    <button
                      className="secondary-button"
                      onClick={() => restoreTask(task)}
                    >
                      <RotateCcw size={15} />
                      Restaurer
                    </button>

                    <button
                      className="danger-button"
                      onClick={() => deletePermanently(task)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState text="La corbeille est vide." />
            )}
          </div>
        )}

        <div className="alexa-card">
          <div className="alexa-icon">A</div>

          <div>
            <strong>Alexa</strong>
            <p>
              La base Supabase servira ensuite de source commune
              à l'application et à l'intégration vocale.
            </p>
          </div>

          <span>À connecter ensuite</span>
        </div>
      </main>

      {modalOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setModalOpen(false)}
        >
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>
                {editingId ? "Modifier la tâche" : "Nouvelle tâche"}
              </h2>

              <button
                className="icon-button"
                onClick={() => setModalOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <label>
              Intitulé

              <input
                autoFocus
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                placeholder="Que faut-il faire ?"
              />
            </label>

            <div className="form-grid">
              <label>
                Quadrant

                <select
                  value={form.quadrant}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      quadrant: e.target.value,
                    })
                  }
                >
                  {QUADRANTS.map((quadrant) => (
                    <option
                      key={quadrant.id}
                      value={quadrant.id}
                    >
                      {quadrant.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Échéance

                <input
                  type="date"
                  value={form.due}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      due: e.target.value,
                    })
                  }
                />
              </label>

              <label>
                Tag

                <select
                  value={form.tag}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      tag: e.target.value,
                    })
                  }
                >
                  {TAGS.map((tag) => (
                    <option key={tag}>{tag}</option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              Notes

              <textarea
                rows="4"
                value={form.notes}
                onChange={(e) =>
                  setForm({
                    ...form,
                    notes: e.target.value,
                  })
                }
                placeholder="Contexte, prochaine action, lien utile..."
              />
            </label>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setModalOpen(false)}
              >
                Annuler
              </button>

              <button
                className="primary-button"
                onClick={saveTask}
              >
                <Check size={17} />
                {editingId ? "Enregistrer" : "Ajouter"}
              </button>
            </div>
          </div>
        </div>
      )}
      {settingsOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={() => setSettingsOpen(false)}
        >
          <div
            className="modal settings-modal"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2>Paramètres</h2>
                <p className="settings-description">
                  Ces préférences sont propres à ton compte.
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="settings-section">
              <h3>Organisation</h3>

              <label>
                Heure de fin de journée

                <input
                  type="time"
                  value={String(settings.end_of_day).slice(0, 5)}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      end_of_day: e.target.value,
                    })
                  }
                />
              </label>

              <p className="settings-help">
                Une tâche sera considérée en retard après cette
                heure le jour de son échéance.
              </p>

              <label>
                Alerte d’échéance proche

                <select
                  value={settings.due_soon_hours}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      due_soon_hours: Number(e.target.value),
                    })
                  }
                >
                  <option value={12}>12 heures</option>
                  <option value={24}>24 heures</option>
                  <option value={48}>48 heures</option>
                  <option value={72}>3 jours</option>
                  <option value={168}>7 jours</option>
                </select>
              </label>
            </div>

            <div className="settings-section">
              <h3>Corbeille</h3>

              <label>
                Purger les tâches terminées et supprimées après

                <select
                  value={settings.trash_retention_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      trash_retention_days: Number(e.target.value),
                    })
                  }
                >
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={60}>60 jours</option>
                  <option value={90}>90 jours</option>
                </select>
              </label>

              <p className="settings-help">
                Toute tâche placée dans la corbeille sera supprimée
                définitivement une fois ce délai dépassé, qu’elle ait
                été terminée ou non.
              </p>
            </div>

            <div className="settings-section">
              <h3>Historique</h3>

              <label>
                Conserver les tâches terminées pendant

                <select
                  value={settings.completed_retention_days}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      completed_retention_days: Number(
                        e.target.value
                      ),
                    })
                  }
                >
                  <option value={1}>1 jour</option>
                  <option value={3}>3 jours</option>
                  <option value={7}>7 jours</option>
                  <option value={14}>14 jours</option>
                  <option value={30}>30 jours</option>
                  <option value={90}>90 jours</option>
                </select>
              </label>

              <p className="settings-help">
                Les tâches terminées depuis plus longtemps
                seront supprimées définitivement.
              </p>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setSettingsOpen(false)}
              >
                Annuler
              </button>

              <button
                className="primary-button"
                onClick={saveSettings}
                disabled={settingsSaving}
              >
                {settingsSaving ? (
                  <>
                    <Loader2 size={17} className="spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Check size={17} />
                    Enregistrer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({
  settings,
  task,
  onEdit,
  onComplete,
  onDelete,
}) {

  const deadlineInfo = getDeadlineInfo(
    task.due,
    task.done,
    settings?.end_of_day,
    settings?.due_soon_hours
  );

  function formatDate(date) {
    if (!date) return "Sans échéance";

    const normalizedDate = String(date).slice(0, 10);
    const match = normalizedDate.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) {
      console.warn("Date d'échéance invalide :", date);
      return "Date invalide";
    }

    const [, year, month, day] = match;

    const parsedDate = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      12,
      0,
      0
    );

    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(parsedDate);
  }

  return (
    <article
      className="task"
      draggable={!task.done}
      onDragStart={(e) =>
        e.dataTransfer.setData("taskId", task.id)
      }
    >
      <>
      <ReloadPrompt />
      </>
      <button
        className={
          task.done
            ? "task-check task-check-done"
            : "task-check"
        }
        onClick={onComplete}
      >
        {task.done && <Check size={13} />}
      </button>

      <div className="task-content">
        <div
          className={
            task.done
              ? "task-title task-title-done"
              : "task-title"
          }
        >
          {task.title}
        </div>

        {task.notes && (
          <p className="task-notes">
            {task.notes}
          </p>
        )}

        <div className="task-meta">
          <span
            className={
              deadlineInfo?.type === "overdue"
                ? "deadline overdue"
                : deadlineInfo?.type === "soon"
                ? "deadline soon"
                : "deadline"
            }
          >
            <Clock3 size={13} />

            {deadlineInfo?.label || formatDate(task.due)}
          </span>

          <span className="task-tag">
            <Tag size={12} />
            {task.tag}
          </span>
        </div>
      </div>

      <div className="task-actions">
        <button
          className="icon-button"
          onClick={onEdit}
        >
          <Pencil size={15} />
        </button>

        <button
          className="icon-button icon-danger"
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </article>
  );
}

function EmptyState({ text }) {
  return <div className="empty-state">{text}</div>;
}
```

---

# FILE: src/main.jsx

Path: src/main.jsx
Type: application source file

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true
})

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

---

# FILE: src/index.css

Path: src/index.css
Type: application source file

```css
:root {
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;

  color: #0f172a;
  background: #f1f5f9;
  font-synthesis: none;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-width: 320px;
  min-height: 100%;
}

body {
  min-height: 100vh;
  background: #f1f5f9;
  color: #0f172a;
}

button,
input,
select,
textarea {
  font: inherit;
}

button {
  cursor: pointer;
}

.app {
  min-height: 100vh;
}

.header {
  position: sticky;
  top: 0;
  z-index: 20;

  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  padding: 14px max(20px, calc((100vw - 1400px) / 2));

  background: rgba(255, 255, 255, 0.97);
  border-bottom: 1px solid #cbd5e1;
}

.brand {
  margin-right: auto;
}

.brand h1 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.brand p {
  margin: 2px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.content {
  width: min(1400px, calc(100% - 32px));
  margin: 0 auto;
  padding: 20px 0 40px;
}

.search {
  display: flex;
  align-items: center;
  gap: 8px;

  width: min(360px, 100%);
  padding: 0 12px;

  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
}

.search svg {
  flex: none;
  color: #475569;
}

.search input {
  width: 100%;
  padding: 10px 0;

  color: #0f172a;
  background: white;

  border: 0;
  outline: 0;
}

.search input::placeholder,
input::placeholder,
textarea::placeholder {
  color: #64748b;
}

.primary-button,
.secondary-button,
.danger-button,
.icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;

  border-radius: 10px;

  font-weight: 700;
  transition: 0.15s;
}

.primary-button {
  padding: 10px 15px;

  color: white;
  background: #2563eb;
  border: 1px solid #2563eb;
}

.primary-button:hover {
  background: #1d4ed8;
}

.secondary-button {
  padding: 9px 13px;

  color: #1e293b;
  background: white;
  border: 1px solid #cbd5e1;
}

.secondary-button:hover {
  background: #f8fafc;
}

.danger-button {
  padding: 9px;

  color: #b91c1c;
  background: #fff;
  border: 1px solid #fecaca;
}

.icon-button {
  padding: 8px;

  color: #334155;
  background: transparent;
  border: 0;
}

.icon-button:hover {
  background: #e2e8f0;
}

.icon-danger {
  color: #b91c1c;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;

  margin-bottom: 14px;
}

.sections {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.pill {
  padding: 7px 13px;

  color: #334155;
  background: white;

  border: 0;
  border-radius: 999px;

  font-size: 12px;
  font-weight: 750;

  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.pill-active {
  color: white;
  background: #0f172a;
}

.pill-done {
  color: white;
  background: #047857;
}

.pill-trash {
  color: white;
  background: #475569;
}

.sync-status {
  display: flex;
  align-items: center;
  gap: 6px;

  margin-left: auto;

  padding: 7px 11px;

  color: #166534;
  background: white;

  border-radius: 999px;

  font-size: 12px;
  font-weight: 750;

  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tag-filter {
  display: flex;
  gap: 8px;

  padding-bottom: 5px;
  margin-bottom: 15px;

  overflow-x: auto;
}

.tag-button {
  flex: none;

  padding: 7px 12px;

  color: #334155;
  background: white;

  border: 1px solid #cbd5e1;
  border-radius: 9px;

  font-size: 12px;
  font-weight: 700;
}

.tag-button-active {
  color: white;
  background: #2563eb;
  border-color: #2563eb;
}

.matrix {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.quadrant {
  min-height: 300px;

  padding: 16px;

  border: 2px solid;
  border-radius: 18px;
}

.quadrant-red {
  background: #fff1f2;
  border-color: #fda4af;
}

.quadrant-red .quadrant-dot {
  background: #dc2626;
}

.quadrant-blue {
  background: #eff6ff;
  border-color: #93c5fd;
}

.quadrant-blue .quadrant-dot {
  background: #2563eb;
}

.quadrant-amber {
  background: #fffbeb;
  border-color: #fcd34d;
}

.quadrant-amber .quadrant-dot {
  background: #d97706;
}

.quadrant-grey {
  background: #f8fafc;
  border-color: #cbd5e1;
}

.quadrant-grey .quadrant-dot {
  background: #475569;
}

.quadrant-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;

  margin-bottom: 12px;
}

.quadrant-header h2 {
  display: flex;
  align-items: center;
  gap: 8px;

  margin: 0;

  color: #0f172a;

  font-size: 16px;
}

.quadrant-header p {
  margin: 5px 0 0;

  color: #334155;

  font-size: 12px;
  font-weight: 650;
}

.quadrant-dot {
  display: inline-block;

  width: 10px;
  height: 10px;

  border-radius: 999px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.task {
  display: flex;
  align-items: flex-start;
  gap: 9px;

  padding: 12px;

  color: #0f172a;
  background: white;

  border: 1px solid #cbd5e1;
  border-radius: 13px;

  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}

.task[draggable="true"] {
  cursor: grab;
}

.task-check {
  flex: none;

  display: grid;
  place-items: center;

  width: 21px;
  height: 21px;

  padding: 0;

  color: white;
  background: white;

  border: 1.5px solid #64748b;
  border-radius: 999px;
}

.task-check-done {
  background: #047857;
  border-color: #047857;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  color: #0f172a;

  font-size: 14px;
  font-weight: 750;
}

.task-title-done {
  color: #475569;
  text-decoration: line-through;
}

.task-notes {
  margin: 5px 0 0;

  color: #475569;

  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 9px;
  flex-wrap: wrap;

  margin-top: 9px;

  color: #334155;

  font-size: 11px;
  font-weight: 700;
}

.task-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.task-tag {
  padding: 3px 7px;

  background: #f1f5f9;

  border-radius: 999px;
}

.overdue {
  color: #b91c1c;
}

.task-actions {
  display: flex;
  flex: none;
}

.empty-quadrant {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;

  width: 100%;

  padding: 20px;

  color: #475569;
  background: rgba(255, 255, 255, 0.5);

  border: 1px dashed #94a3b8;
  border-radius: 12px;

  font-weight: 650;
}

.list-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;

  padding: 16px;

  background: white;

  border: 1px solid #cbd5e1;
  border-radius: 18px;
}

.list-panel h2 {
  margin: 0 0 6px;
}

.empty-state {
  padding: 30px;

  color: #475569;
  text-align: center;
  font-weight: 650;
}

.trash-item {
  display: flex;
  align-items: center;
  gap: 12px;

  padding: 12px;

  background: white;

  border: 1px solid #cbd5e1;
  border-radius: 12px;
}

.trash-item strong {
  flex: 1;
}

.trash-actions {
  display: flex;
  gap: 7px;
}

.alexa-card {
  display: flex;
  align-items: center;
  gap: 15px;
  flex-wrap: wrap;

  margin-top: 18px;
  padding: 16px;

  background:
    linear-gradient(
      90deg,
      #f5f3ff,
      #ffffff
    );

  border: 1px solid #c4b5fd;
  border-radius: 18px;
}

.alexa-icon {
  display: grid;
  place-items: center;

  width: 44px;
  height: 44px;

  color: white;
  background: #6d28d9;

  border-radius: 999px;

  font-size: 20px;
  font-weight: 800;
}

.alexa-card div:nth-child(2) {
  flex: 1;
}

.alexa-card p {
  margin: 3px 0 0;

  color: #475569;

  font-size: 13px;
}

.alexa-card span {
  padding: 6px 10px;

  color: #5b21b6;
  background: #ede9fe;

  border-radius: 999px;

  font-size: 11px;
  font-weight: 750;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;

  display: grid;
  place-items: center;

  padding: 20px;

  background: rgba(15, 23, 42, 0.55);
}

.modal {
  width: min(600px, 100%);

  padding: 20px;

  color: #0f172a;
  background: white;

  border-radius: 18px;

  box-shadow:
    0 25px 50px rgba(15, 23, 42, 0.25);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-header h2 {
  margin: 0;
}

.modal label,
.login-card label {
  display: block;

  margin-top: 15px;

  color: #0f172a;

  font-size: 13px;
  font-weight: 750;
}

.modal input,
.modal select,
.modal textarea,
.login-card input {
  width: 100%;

  margin-top: 6px;
  padding: 10px 11px;

  color: #0f172a;
  background: white;

  border: 1px solid #94a3b8;
  border-radius: 10px;

  outline: none;
}

.modal input:focus,
.modal select:focus,
.modal textarea:focus,
.login-card input:focus {
  border-color: #2563eb;

  box-shadow:
    0 0 0 3px rgba(37, 99, 235, 0.15);
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 9px;

  margin-top: 20px;
}

.login-page {
  display: grid;
  place-items: center;

  min-height: 100vh;

  padding: 20px;

  background:
    linear-gradient(
      135deg,
      #e2e8f0,
      #f8fafc
    );
}

.login-card {
  width: min(420px, 100%);

  padding: 30px;

  color: #0f172a;
  background: white;

  border: 1px solid #cbd5e1;
  border-radius: 22px;

  box-shadow:
    0 20px 45px rgba(15, 23, 42, 0.15);
}

.login-logo {
  display: grid;
  place-items: center;

  width: 48px;
  height: 48px;

  margin-bottom: 20px;

  color: white;
  background: #2563eb;

  border-radius: 14px;

  font-size: 24px;
  font-weight: 850;
}

.login-card h1 {
  margin: 0;

  color: #0f172a;

  font-size: 24px;
}

.login-description {
  margin: 7px 0 20px;

  color: #475569;

  font-weight: 550;
}

.login-button {
  width: 100%;
  margin-top: 20px;
}

.login-footer {
  margin-top: 16px;

  color: #64748b;

  text-align: center;

  font-size: 11px;
  font-weight: 600;
}

.error-box {
  margin: 12px 0;

  padding: 11px;

  color: #991b1b;
  background: #fef2f2;

  border: 1px solid #fecaca;
  border-radius: 10px;

  font-size: 13px;
  font-weight: 700;
}

.loading-screen {
  display: grid;
  place-items: center;

  min-height: 100vh;

  color: #334155;
  background: #f1f5f9;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 800px) {
  .matrix {
    grid-template-columns: 1fr;
  }

  .header {
    align-items: stretch;
  }

  .brand {
    width: 100%;
  }

  .search {
    width: 100%;
    max-width: none;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .sync-status {
    width: max-content;
    margin-left: 0;
  }
}

.deadline.soon {
  color: #c2410c;
  background: #ffedd5;
  font-weight: 700;
}

.deadline.overdue {
  color: #b91c1c;
  background: #fee2e2;
  font-weight: 700;
}

.settings-modal {
  max-width: 560px;
}

.settings-description {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 0.9rem;
}

.settings-section {
  margin-top: 22px;
  padding-top: 18px;
  border-top: 1px solid #e2e8f0;
}

.settings-section:first-of-type {
  margin-top: 8px;
}

.settings-section h3 {
  margin: 0 0 16px;
  color: #0f172a;
  font-size: 1rem;
}

.settings-section label {
  display: grid;
  gap: 7px;
  margin-top: 16px;
  color: #1e293b;
  font-weight: 650;
}

.settings-section input,
.settings-section select {
  width: 100%;
  box-sizing: border-box;
}

.settings-help {
  margin: 7px 0 0;
  color: #64748b;
  font-size: 0.82rem;
  line-height: 1.45;
}
```

---

# FILE: src/supabase.js

Path: src/supabase.js
Type: application source file

```javascript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Configuration Supabase manquante. Vérifie le fichier .env.local."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
```

---

# FILE: src/ReloadPrompt.jsx

Path: src/ReloadPrompt.jsx
Type: application source file

```jsx
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: '#ffffff',
        color: '#111827',
        padding: '12px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        border: '1px solid #e5e7eb',
      }}
    >
      <span>Nouvelle version disponible</span>

      <button
        onClick={() => updateServiceWorker(true)}
        style={{
          background: '#047857',
          color: '#ffffff',
          border: 'none',
          borderRadius: '8px',
          padding: '8px 12px',
          fontWeight: '600',
          cursor: 'pointer',
        }}
      >
        Actualiser
      </button>

      <button
        onClick={() => setNeedRefresh(false)}
        aria-label="Fermer"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontSize: '18px',
          color: '#6b7280',
        }}
      >
        ×
      </button>
    </div>
  )
}
```

---

# FILE: package.json

Path: package.json
Type: application source file

```json
{
  "name": "eisenhower-vite",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "prebuild": "node scripts/generate-agent-context.mjs",
    "build": "vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.118.0",
    "framer-motion": "^14.6.0",
    "lucide-react": "^1.61.0",
    "react": "^19.3.1",
    "react-dom": "^19.3.1"
  },
  "devDependencies": {
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.2",
    "oxlint": "^1.88.0",
    "vite": "^8.3.4",
    "vite-plugin-pwa": "^2.0.0"
  }
}

```

---

# FILE: vite.config.js

Path: vite.config.js
Type: application source file

```javascript
// import react from '@vitejs/plugin-react'
// import { defineConfig } from 'vite'

// // https://vite.dev/config/
// export default defineConfig({
//   plugins: [react()],
// })
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',

      workbox: {
        cleanupOutdatedCaches: true,
      },

      manifest: {
        name: 'Matrice Eisenhower',
        short_name: 'Eisenhower',
        description: 'Ma matrice Eisenhower personnelle',

        theme_color: '#ffffff',
        background_color: '#ffffff',

        display: 'standalone',

        start_url: '/',

        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
```


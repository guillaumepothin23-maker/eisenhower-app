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

const TAG_STYLES = {
  Travail: { color: "#e6007e", background: "#fce7f3" },
  Maison: { color: "#c2410c", background: "#ffedd5" },
  Famille: { color: "#1d4ed8", background: "#dbeafe" },
  Finance: { color: "#b91c1c", background: "#fee2e2" },
  Admin: { color: "#6d28d9", background: "#ede9fe" },
  Perso: { color: "#047857", background: "#d1fae5" },
};

const DEFAULT_TAG_STYLE = {
  color: "#475569",
  background: "#e2e8f0",
};

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
  const [subtasks, setSubtasks] = useState([]);
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
  const [quickTitles, setQuickTitles] = useState({});
  const [quickAddingQuadrant, setQuickAddingQuadrant] = useState(null);

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
      setSubtasks([]);
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

  async function loadSubtasks() {
    if (!session?.user?.id) return;

    const { data, error: loadError } = await supabase
      .from("subtasks")
      .select("id, task_id, user_id, title, due, done, created_at, updated_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: true });

    if (loadError) {
      setError(`Impossible de charger les sous-tâches : ${loadError.message}`);
      return;
    }

    setSubtasks(data ?? []);
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
      await Promise.all([loadTasks(), loadSubtasks()]);
      return;
    }

    await purgeExpiredTrash(
      loadedSettings.trash_retention_days
    );

    await purgeExpiredCompleted(
      loadedSettings.completed_retention_days
    );

    await Promise.all([loadTasks(), loadSubtasks()]);
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

  async function quickAddTask(quadrant) {
    const title = (quickTitles[quadrant] ?? "").trim();

    if (!title || quickAddingQuadrant) return;

    setError("");
    setQuickAddingQuadrant(quadrant);

    const { error: insertError } = await supabase.from("tasks").insert({
      title,
      quadrant,
      due: null,
      tag: "Perso",
      notes: null,
      user_id: session.user.id,
      done: false,
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      setError(insertError.message);
      setQuickAddingQuadrant(null);
      return;
    }

    setQuickTitles((current) => ({
      ...current,
      [quadrant]: "",
    }));
    setQuickAddingQuadrant(null);

    await loadTasks();
  }

  async function addSubtask(taskId, values) {
    const title = values.title.trim();

    if (!title || !session?.user?.id) return false;

    setError("");

    const { error: insertError } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        user_id: session.user.id,
        title,
        due: values.due || null,
      });

    if (insertError) {
      setError(`Impossible d’ajouter la sous-tâche : ${insertError.message}`);
      return false;
    }

    await loadSubtasks();
    return true;
  }

  async function updateSubtask(id, changes) {
    setError("");

    const values = {
      ...changes,
      updated_at: new Date().toISOString(),
    };

    if (Object.prototype.hasOwnProperty.call(values, "title")) {
      values.title = values.title.trim();

      if (!values.title) return false;
    }

    if (Object.prototype.hasOwnProperty.call(values, "due")) {
      values.due = values.due || null;
    }

    const { error: updateError } = await supabase
      .from("subtasks")
      .update(values)
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (updateError) {
      setError(`Impossible de modifier la sous-tâche : ${updateError.message}`);
      return false;
    }

    await loadSubtasks();
    return true;
  }

  async function deleteSubtask(id) {
    setError("");

    const { error: deleteError } = await supabase
      .from("subtasks")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (deleteError) {
      setError(`Impossible de supprimer la sous-tâche : ${deleteError.message}`);
      return false;
    }

    await loadSubtasks();
    return true;
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

                      <div className="quick-add">
                        <Plus size={15} aria-hidden="true" />
                        <input
                          value={quickTitles[quadrant.id] ?? ""}
                          onChange={(event) =>
                            setQuickTitles((current) => ({
                              ...current,
                              [quadrant.id]: event.target.value,
                            }))
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              quickAddTask(quadrant.id);
                            }

                            if (event.key === "Escape") {
                              setQuickTitles((current) => ({
                                ...current,
                                [quadrant.id]: "",
                              }));
                            }
                          }}
                          disabled={quickAddingQuadrant === quadrant.id}
                          placeholder="Ajouter une tâche…"
                          aria-label={`Ajouter une tâche dans ${quadrant.title}`}
                        />
                        {quickAddingQuadrant === quadrant.id && (
                          <Loader2 size={15} className="spin" />
                        )}
                      </div>

                      <div className="task-list">
                        {quadrantTasks.map((task) => (
                          <TaskCard
                            settings={settings}
                            key={task.id}
                            task={task}
                            subtasks={subtasks.filter((subtask) => subtask.task_id === task.id)}
                            onAddSubtask={addSubtask}
                            onUpdateSubtask={updateSubtask}
                            onDeleteSubtask={deleteSubtask}
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
                      subtasks={subtasks.filter((subtask) => subtask.task_id === task.id)}
                      onAddSubtask={addSubtask}
                      onUpdateSubtask={updateSubtask}
                      onDeleteSubtask={deleteSubtask}
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
                  subtasks={subtasks.filter((subtask) => subtask.task_id === task.id)}
                  onAddSubtask={addSubtask}
                  onUpdateSubtask={updateSubtask}
                  onDeleteSubtask={deleteSubtask}
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
  subtasks,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onEdit,
  onComplete,
  onDelete,
}) {
  const [subtaskFormOpen, setSubtaskFormOpen] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [newSubtaskDue, setNewSubtaskDue] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState("");
  const [editingSubtaskDue, setEditingSubtaskDue] = useState("");
  const [subtaskSaving, setSubtaskSaving] = useState(false);

  const tagStyle = TAG_STYLES[task.tag] ?? DEFAULT_TAG_STYLE;
  const completedSubtasks = subtasks.filter((subtask) => subtask.done).length;
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

  async function handleAddSubtask(event) {
    event.preventDefault();

    if (!newSubtaskTitle.trim() || subtaskSaving) return;

    setSubtaskSaving(true);
    const created = await onAddSubtask(task.id, {
      title: newSubtaskTitle,
      due: newSubtaskDue,
    });
    setSubtaskSaving(false);

    if (created) {
      setNewSubtaskTitle("");
      setNewSubtaskDue("");
      setSubtaskFormOpen(false);
    }
  }

  function startEditingSubtask(subtask) {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskTitle(subtask.title);
    setEditingSubtaskDue(formatDueDate(subtask.due));
  }

  async function saveEditedSubtask(subtaskId) {
    if (!editingSubtaskTitle.trim() || subtaskSaving) return;

    setSubtaskSaving(true);
    const updated = await onUpdateSubtask(subtaskId, {
      title: editingSubtaskTitle,
      due: editingSubtaskDue,
    });
    setSubtaskSaving(false);

    if (updated) {
      setEditingSubtaskId(null);
    }
  }

  return (
    <article
      className="task"
      style={{ "--tag-color": tagStyle.color }}
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

        {(subtasks.length > 0 || subtaskFormOpen) && (
          <div className="subtasks">
            {subtasks.length > 0 && (
              <>
                <div className="subtasks-summary">
                  <span>Sous-tâches</span>
                  <span className="subtask-progress">
                    {completedSubtasks}/{subtasks.length}
                  </span>
                </div>
                <div className="subtasks-panel">
          {subtasks.map((subtask) => {
            const subtaskDeadline = getDeadlineInfo(
              subtask.due,
              subtask.done,
              settings?.end_of_day,
              settings?.due_soon_hours
            );
            const isEditing = editingSubtaskId === subtask.id;

            return (
              <div className="subtask-row" key={subtask.id}>
                <button
                  type="button"
                  className={
                    subtask.done
                      ? "subtask-check subtask-check-done"
                      : "subtask-check"
                  }
                  onClick={() =>
                    onUpdateSubtask(subtask.id, { done: !subtask.done })
                  }
                  aria-label={
                    subtask.done
                      ? `Rouvrir ${subtask.title}`
                      : `Terminer ${subtask.title}`
                  }
                >
                  {subtask.done && <Check size={11} />}
                </button>

                {isEditing ? (
                  <div className="subtask-edit-fields">
                    <input
                      value={editingSubtaskTitle}
                      onChange={(event) => setEditingSubtaskTitle(event.target.value)}
                      aria-label="Titre de la sous-tâche"
                    />
                    <input
                      type="date"
                      value={editingSubtaskDue}
                      onChange={(event) => setEditingSubtaskDue(event.target.value)}
                      aria-label="Échéance de la sous-tâche"
                    />
                  </div>
                ) : (
                  <div className="subtask-content">
                    <span className={subtask.done ? "subtask-title subtask-title-done" : "subtask-title"}>
                      {subtask.title}
                    </span>
                    {subtask.due && (
                      <span
                        className={
                          subtaskDeadline?.type === "overdue"
                            ? "subtask-due overdue"
                            : subtaskDeadline?.type === "soon"
                            ? "subtask-due soon"
                            : "subtask-due"
                        }
                      >
                        <Clock3 size={11} />
                        {subtaskDeadline?.label || formatDate(subtask.due)}
                      </span>
                    )}
                  </div>
                )}

                <div className="subtask-actions">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => saveEditedSubtask(subtask.id)}
                        disabled={subtaskSaving}
                        aria-label="Enregistrer la sous-tâche"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setEditingSubtaskId(null)}
                        aria-label="Annuler la modification"
                      >
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => startEditingSubtask(subtask)}
                        aria-label={`Modifier ${subtask.title}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-danger"
                        onClick={() => onDeleteSubtask(subtask.id)}
                        aria-label={`Supprimer ${subtask.title}`}
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

                </div>
              </>
            )}

            {subtaskFormOpen && (
              <form className="subtask-add" onSubmit={handleAddSubtask}>
                <input
                  autoFocus
                  value={newSubtaskTitle}
                  onChange={(event) => setNewSubtaskTitle(event.target.value)}
                  placeholder="Ajouter une sous-tâche…"
                  aria-label="Nouvelle sous-tâche"
                />
                <input
                  type="date"
                  value={newSubtaskDue}
                  onChange={(event) => setNewSubtaskDue(event.target.value)}
                  aria-label="Échéance de la nouvelle sous-tâche"
                />
                <button
                  type="submit"
                  className="icon-button"
                  disabled={!newSubtaskTitle.trim() || subtaskSaving}
                  aria-label="Ajouter la sous-tâche"
                >
                  {subtaskSaving ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => {
                    setSubtaskFormOpen(false);
                    setNewSubtaskTitle("");
                    setNewSubtaskDue("");
                  }}
                  aria-label="Annuler l’ajout de la sous-tâche"
                >
                  <X size={14} />
                </button>
              </form>
            )}
          </div>
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

          <span
            className="task-tag"
            style={{
              color: tagStyle.color,
              backgroundColor: tagStyle.background,
            }}
          >
            <Tag size={12} />
            {task.tag || "Sans tag"}
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
          type="button"
          className="icon-button"
          onClick={() => setSubtaskFormOpen(true)}
          aria-label={`Ajouter une sous-tâche à ${task.title}`}
          title="Ajouter une sous-tâche"
        >
          <Plus size={15} />
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
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
} from "lucide-react";

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
    title: "Éliminer",
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

const { data, error } = await supabase
  .from("tasks")
  .select("*")
  .eq("user_id", session.user.id)
  .order("created_at", { ascending: false });

const formatDueDate = (due) => {
  if (!due) return null

  const date = new Date(due)

  if (isNaN(date.getTime())) return null

  return format(date, 'dd/MM/yyyy')
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
    if (session?.user) {
      loadTasks();
    } else {
      setTasks([]);
    }
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
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data ?? []);
    }

    setLoading(false);
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
    </div>
  );
}

function TaskCard({
  task,
  onEdit,
  onComplete,
  onDelete,
}) {
  const today = new Date().toISOString().slice(0, 10);

  const overdue =
    task.due &&
    task.due < today &&
    !task.done;

  function formatDate(date) {
    if (!date) return "Sans échéance";

    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${date}T12:00:00`));
  }

  return (
    <article
      className="task"
      draggable={!task.done}
      onDragStart={(e) =>
        e.dataTransfer.setData("taskId", task.id)
      }
    >
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
          <span className={overdue ? "overdue" : ""}>
            <Clock3 size={13} />
            {formatDate(task.due)}
            {overdue && " · en retard"}
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
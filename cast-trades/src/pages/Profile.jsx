import React, { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

function loadUsers() {
  try {
    return JSON.parse(localStorage.getItem("casttrades_users") || "[]");
  } catch {
    return [];
  }
}

function saveUsers(next) {
  localStorage.setItem("casttrades_users", JSON.stringify(next));
}

export default function Profile() {
  const { user, updateProfile } = useAuth();

  const [editing, setEditing] = useState(null); 
  const [draft, setDraft] = useState("");

  const fields = useMemo(() => {
    return [
      { key: "name", label: "Name", value: user?.name ?? "" },
      { key: "lastName", label: "Last name", value: user?.lastName ?? "" },
      { key: "pernerNumber", label: "Perner number", value: user?.pernerNumber ?? "" },
      { key: "email", label: "Email", value: user?.email ?? "", readOnly: true },
    ];
  }, [user]);

  const startEdit = (key, currentValue) => {
    setEditing(key);
    setDraft(String(currentValue ?? ""));
  };

  const cancelEdit = () => {
    setEditing(null);
    setDraft("");
  };

  const saveEdit = () => {
    if (!user?.uid || !editing) return;

    const trimmed = draft.trim();

    if (editing !== "email" && !trimmed) {
      alert("This field can’t be empty.");
      return;
    }

    if (editing === "pernerNumber" && !/^\d+$/.test(trimmed)) {
      alert("Perner number must be numeric.");
      return;
    }

    updateProfile({ [editing]: trimmed });

    setEditing(null);
    setDraft("");
  };

  return (
    <div className="page">
      <h1>Profile</h1>

      <div className="card">
        <div className="muted" style={{ marginBottom: 10 }}>
          Tap the pencil to edit your info.
        </div>

        <div className="list">
          {fields.map((f) => {
            const isEditing = editing === f.key;

            return (
              <div key={f.key} className="list-card">
                <div className="list-row">
                  <div>
                    <div className="label">{f.label}</div>

                    {!isEditing ? (
                      <div className="list-title" style={{ marginTop: 6 }}>
                        {f.value || <span className="muted">—</span>}
                      </div>
                    ) : (
                      <input
                        className="input"
                        value={draft}
                        inputMode={f.key === "pernerNumber" ? "numeric" : "text"}
                        onChange={(e) => setDraft(e.target.value)}
                        autoFocus
                      />
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {!isEditing ? (
                      f.readOnly ? null : (
                        <button
                          className="icon-btn"
                          type="button"
                          onClick={() => startEdit(f.key, f.value)}
                          aria-label={`Edit ${f.label}`}
                          title={`Edit ${f.label}`}
                        >
                          ✏️
                        </button>
                      )
                    ) : (
                      <>
                        <button className="btn small confirm" type="button" onClick={saveEdit}>
                          Save
                        </button>
                        <button className="btn small danger" type="button" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

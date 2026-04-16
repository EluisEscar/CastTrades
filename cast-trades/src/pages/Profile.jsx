import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5Z" />
      <path d="m13.5 6 4.5 4.5" />
    </svg>
  );
}

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [pernerNumber, setPernerNumber] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingContact, setIsEditingContact] = useState(false);

  useEffect(() => {
    setEmail(user?.email ?? "");
    setPernerNumber(user?.pernerNumber ?? "");
  }, [user?.email, user?.pernerNumber]);

  const fields = useMemo(() => {
    return [
      { key: "firstName", label: "First name", value: user?.firstName ?? "" },
      { key: "lastName", label: "Last name", value: user?.lastName ?? "" },
    ];
  }, [user]);

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPernerNumber = pernerNumber.trim();
  const hasChanges =
    normalizedEmail !== (user?.email ?? "") ||
    normalizedPernerNumber !== (user?.pernerNumber ?? "");

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!/^\d{8}$/.test(normalizedPernerNumber)) {
      setError("Perner number must contain exactly 8 digits.");
      setSuccess("");
      return;
    }

    if (!normalizedEmail) {
      setError("Email is required.");
      setSuccess("");
      return;
    }

    if (!hasChanges) {
      setError("");
      setSuccess("No changes to save.");
      return;
    }

    try {
      setIsSaving(true);
      setError("");
      setSuccess("");
      await updateProfile({
        email: normalizedEmail,
        pernerNumber: normalizedPernerNumber,
      });
      setSuccess("Profile updated.");
      setIsEditingContact(false);
    } catch (nextError) {
      setError(nextError.message || "Failed to update profile.");
      setSuccess("");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditing = () => {
    setEmail(user?.email ?? "");
    setPernerNumber(user?.pernerNumber ?? "");
    setError("");
    setSuccess("");
    setIsEditingContact(true);
  };

  const handleCancelEditing = () => {
    setEmail(user?.email ?? "");
    setPernerNumber(user?.pernerNumber ?? "");
    setError("");
    setSuccess("");
    setIsEditingContact(false);
  };

  return (
    <div className="page">
      <section className="card">
        <div className="section-header account-settings-header">
          <div>
            <div className="eyebrow">Account settings</div>
            <h2 className="section-title">Contact details</h2>
            <div className="muted">
              Use the edit button if you need to correct your email or perner number.
            </div>
          </div>

          <button
            className="icon-btn profile-edit-btn"
            type="button"
            onClick={handleStartEditing}
            disabled={isEditingContact}
            aria-label="Edit contact details"
            title="Edit contact details"
          >
            <EditIcon />
          </button>
        </div>

        <div className="field-grid">
          <div className="field-card">
            <div className="label">Email</div>
            <div className="field-value field-value-break">{user?.email || "-"}</div>
          </div>

          <div className="field-card">
            <div className="label">Perner number</div>
            <div className="field-value">{user?.pernerNumber || "-"}</div>
          </div>
        </div>

        {isEditingContact ? (
          <form className="field-stack profile-edit-form" onSubmit={handleSubmit}>
            <div className="split-grid">
              <div>
                <div className="label">Email</div>
                <input
                  className="input"
                  type="email"
                  value={email}
                  maxLength={254}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  required
                />
              </div>

              <div>
                <div className="label">Perner number</div>
                <input
                  className="input"
                  inputMode="numeric"
                  value={pernerNumber}
                  maxLength={8}
                  onChange={(event) => {
                    setPernerNumber(event.target.value);
                    setError("");
                    setSuccess("");
                  }}
                  required
                />
              </div>
            </div>

            {error ? <div className="error">{error}</div> : null}

            <div className="action-row">
              <button className="btn publish" type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save changes"}
              </button>

              <button
                className="ghost-btn"
                type="button"
                onClick={handleCancelEditing}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {!isEditingContact && success ? <div className="success-message">{success}</div> : null}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <div className="eyebrow">Identity snapshot</div>
            <h2 className="section-title">Current account details</h2>
          </div>
        </div>

        <div className="field-grid">
          {fields.map((field) => (
            <div key={field.key} className="field-card">
              <div className="label">{field.label}</div>
              <div className="field-value">{field.value || "-"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

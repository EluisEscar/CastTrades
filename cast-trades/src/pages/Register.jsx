import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthFrame from "../components/AuthFrame.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [perner, setPerner] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const pernerValue = perner.trim();

    if (!/^\d{8}$/.test(pernerValue)) {
      setErr("Perner number must contain exactly 8 digits.");
      return;
    }

    if (!password || password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    const payload = {
      firstName: name.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      pernerNumber: pernerValue,
      password,
    };

    try {
      await register(payload);
      navigate("/", { replace: true });
    } catch (error) {
      setErr(error.message || "Register failed");
    }
  };

  return (
    <AuthFrame
      eyebrow="New Session"
      title="Create account"
      description="Set up your access once and manage request creation, approvals, and updates from the same board."
      footer={
        <>
          Already registered?{" "}
          <Link className="link" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="auth-form-grid" onSubmit={onSubmit}>
        <div className="split-grid">
          <div>
            <div className="label">First name</div>
            <input
              className="input"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="label">Last name</div>
            <input
              className="input"
              value={lastName}
              maxLength={80}
              onChange={(e) => setLastName(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="label">Email</div>
        <input
          className="input"
          type="email"
          placeholder="name@email.com"
          value={email}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <div className="split-grid">
          <div>
            <div className="label">Password</div>
            <input
              className="input"
              type="password"
              placeholder="........"
              value={password}
              minLength={8}
              maxLength={72}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <div className="label">PERNER</div>
            <input
              className="input"
              inputMode="numeric"
              placeholder="12345678"
              value={perner}
              maxLength={8}
              onChange={(e) => setPerner(e.target.value)}
              required
            />
          </div>
        </div>

        {err ? <div className="error">{err}</div> : null}

        <button className="btn publish" type="submit">
          Create workspace
        </button>
      </form>
    </AuthFrame>
  );
}

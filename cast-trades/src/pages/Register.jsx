import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

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

    const pernerNum = Number(perner);

    if (!Number.isInteger(pernerNum) || pernerNum <= 0) {
      setErr("Perner number must be a valid number.");
      return;
    }
    if (!password || password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }

    const payload = {
      firstName: name.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      pernerNumber: pernerNum,
      password,
    };

    try {
      await register(payload);

      // Opción A: ya quedas logueado (porque backend devuelve token)
      navigate("/", { replace: true });

      // Opción B (si prefieres): mandarlo a login luego de registrar
      // navigate("/login", { replace: true });
    } catch (e2) {
      setErr(e2.message || "Register failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <form className="card" onSubmit={onSubmit}>
          <div className="auth-title">Register</div>

          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="label">Name</div>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="label">Last name</div>
              <input
                className="input"
                value={lastName}
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
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="label">Password</div>
          <input
            className="input"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <div className="label">Perner number</div>
          <input
            className="input"
            inputMode="numeric"
            placeholder="123456"
            value={perner}
            onChange={(e) => setPerner(e.target.value)}
            required
          />

          {err ? <div className="error">{err}</div> : null}

          <button className="btn publish" type="submit">
            Register
          </button>

          <div className="hint" style={{ textAlign: "center" }}>
            Already have an account?{" "}
            <Link className="link" to="/login">
              Login
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

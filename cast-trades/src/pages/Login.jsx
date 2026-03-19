import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

export default function Login() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [password, setPassword] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const em = email.trim();

    try {
      await login(em, password);
      navigate(from, { replace: true });
    } catch (e2) {
      setErr(e2.message || "Login failed");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <form className="card" onSubmit={onSubmit}>
          <div className="auth-title">Login</div>

          <div className="label">Email</div>
          <input
            className="input"
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setErr("");
            }}
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

          {err ? <div className="error">{err}</div> : null}

          <button className="btn publish" type="submit">
            Sign in
          </button>

          <div className="hint" style={{ textAlign: "center" }}>
            No account?{" "}
            <Link className="link" to="/register">
              Register
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

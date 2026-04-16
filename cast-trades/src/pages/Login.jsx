import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import AuthFrame from "../components/AuthFrame.jsx";

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

    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (error) {
      setErr(error.message || "Login failed");
    }
  };

  return (
    <AuthFrame
      eyebrow="Secure Access"
      title="Sign in"
      description="Enter your credentials to open the shift exchange workspace."
      footer={
        <>
          No account yet?{" "}
          <Link className="link" to="/register">
            Create one
          </Link>
        </>
      }
    >
      <form className="auth-form-grid" onSubmit={onSubmit}>
        <div className="label">Email</div>
        <input
          className="input"
          type="email"
          placeholder="name@email.com"
          value={email}
          maxLength={254}
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
          placeholder="........"
          value={password}
          maxLength={72}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {err ? <div className="error">{err}</div> : null}

        <button className="btn publish" type="submit">
          Enter workspace
        </button>
      </form>
    </AuthFrame>
  );
}

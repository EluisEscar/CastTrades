import React from "react";

export default function AuthFrame({
  eyebrow,
  title,
  description,
  footer,
  children,
}) {
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-badge">CT</div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 className="auth-heading">{title}</h1>
        <p className="auth-copy">{description}</p>

        <div className="card auth-form-card">{children}</div>

        {footer ? <div className="auth-footer-copy">{footer}</div> : null}
      </div>
    </div>
  );
}

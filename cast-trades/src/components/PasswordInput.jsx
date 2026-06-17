import React, { useState } from "react";

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M3 3l18 18" />
        <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
        <path d="M9.3 5.4A9.6 9.6 0 0 1 12 5c5 0 8 4.5 9 7a12.5 12.5 0 0 1-2.5 3.8" />
        <path d="M6.6 6.6A12.4 12.4 0 0 0 3 12c1 2.5 4 7 9 7a9.5 9.5 0 0 0 4.2-.9" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M3 12c1-2.5 4-7 9-7s8 4.5 9 7c-1 2.5-4 7-9 7s-8-4.5-9-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function PasswordInput({ className = "input", ...props }) {
  const [isVisible, setIsVisible] = useState(false);
  const buttonLabel = isVisible ? "Hide password" : "Show password";

  return (
    <div className="password-input-wrap">
      <input
        {...props}
        className={`${className} password-input`}
        type={isVisible ? "text" : "password"}
      />
      <button
        type="button"
        className="password-toggle"
        aria-label={buttonLabel}
        aria-pressed={isVisible}
        title={buttonLabel}
        onClick={() => setIsVisible((current) => !current)}
      >
        <EyeIcon hidden={!isVisible} />
      </button>
    </div>
  );
}

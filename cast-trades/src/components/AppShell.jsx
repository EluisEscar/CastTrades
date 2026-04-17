import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7.5h16V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M4 8l4.5 5h7L20 8" />
      <path d="M9 13h6" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 6 5.5v5.8c0 4.1 2.5 7.7 6 9.2 3.5-1.5 6-5.1 6-9.2V5.5Z" />
      <path d="m9.5 12 1.7 1.7 3.3-3.4" />
    </svg>
  );
}

const baseTabs = [
  { to: "/", label: "Home", icon: <HomeIcon /> },
  { to: "/inbox", label: "Inbox", icon: <InboxIcon /> },
  { to: "/profile", label: "Profile", icon: <ProfileIcon /> },
];

function buildGreeting(user) {
  const firstName = user?.firstName?.trim() || "Cast";
  const lastInitial = user?.lastName ? ` ${user.lastName.charAt(0).toUpperCase()}.` : "";
  return `${firstName}${lastInitial}`;
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const tabs =
    user?.role === "ADMIN" || user?.role === "SUPERADMIN"
      ? [...baseTabs, { to: "/admin", label: "Admin", icon: <AdminIcon /> }]
      : baseTabs;

  const handleLogout = async () => {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      await logout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="app">
      <div className="app-shell-glow" aria-hidden="true" />

      <header className="topbar">
        <div className="brand-cluster">
          <div className="brand-mark">
            <img src="/cast-trades-mark.svg" alt="Cast Trades" />
          </div>

          <div>
            <div className="eyebrow">Cast Trades</div>
            <div className="greeting">Hi, {buildGreeting(user)}</div>
          </div>
        </div>

        <div className="topbar-right">
          <div className="topbar-chip">PERNER {user?.pernerNumber || "--"}</div>

          <button
            className="logout-btn"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="tabbar">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
          >
            <div className="tab-icon">{tab.icon}</div>
            <div className="tab-label">{tab.label}</div>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

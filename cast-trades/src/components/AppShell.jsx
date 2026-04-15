import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";

const tabs = [
  { to: "/home", label: "Home", icon: "🏠" },
  { to: "/inbox", label: "Inbox", icon: "🔔" },
  { to: "/profile", label: "Profile", icon: "👤" }
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const firstName = (user?.firstName ?? "").toUpperCase();
  const lastInitial = user?.lastName ? user.lastName.charAt(0).toUpperCase() : "";

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <div className="greeting">
            HI {firstName} {lastInitial}
          </div>
        </div>

        <div className="topbar-right">
          <button className="logout-btn" type="button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <nav className="tabbar">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `tab ${isActive ? "active" : ""}`}
          >
            <div className="tab-icon">{t.icon}</div>
            <div className="tab-label">{t.label}</div>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}


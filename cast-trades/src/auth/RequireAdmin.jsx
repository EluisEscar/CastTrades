import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";

const ADMIN_ROLES = new Set(["ADMIN", "SUPERADMIN"]);

export default function RequireAdmin({ children }) {
  const { user, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return <div className="page">Loading session...</div>;
  }

  if (!user || !ADMIN_ROLES.has(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

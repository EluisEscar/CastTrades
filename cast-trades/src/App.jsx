import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import Home from "./pages/Home.jsx";
import Locations from "./pages/Locations.jsx";
import Profile from "./pages/Profile.jsx";
import Inbox from "./pages/Inbox.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import RequireAuth from "./auth/RequireAuth.jsx";
import RequireAdmin from "./auth/RequireAdmin.jsx";
import Admin from "./pages/Admin.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/locations" element={<Locations />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

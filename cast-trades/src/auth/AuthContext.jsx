/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../api/auth";
import {
  clearInboxCache,
  prefetchInbox,
  startInboxStream,
  stopInboxStream,
} from "../api/inbox";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const { user: nextUser } = await authApi.getCurrentUser();
        if (!cancelled) {
          setUser(nextUser);
        }
        if (nextUser) {
          prefetchInbox().catch(() => {});
          startInboxStream();
        }
      } catch {
        clearInboxCache();
        stopInboxStream();
        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsAuthLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email, password) => {
    const { user } = await authApi.login(email, password);
    setUser(user);
    prefetchInbox().catch(() => {});
    startInboxStream();
  };

  const register = async (payload) => {
    const { user } = await authApi.register(payload);
    setUser(user);
    prefetchInbox().catch(() => {});
    startInboxStream();
  };

  const logout = async () => {
    stopInboxStream();
    clearInboxCache();

    try {
      await authApi.logout();
    } catch {
      // Clear client state even if the request fails.
    }

    setUser(null);
  };

  const updateProfile = async (payload) => {
    const { user } = await authApi.updateCurrentUser(payload);
    setUser(user);
    return user;
  };

  const value = useMemo(
    () => ({ user, isAuthLoading, login, register, logout, updateProfile }),
    [user, isAuthLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { createContext, useContext, useMemo, useState } from "react";
import * as authApi from "../api/auth";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  const login = async (email, password) => {
    const { user, token } = await authApi.login(email, password);
    setUser(user);
    setToken(token);
  };

  const register = async (payload) => {
    const { user, token } = await authApi.register(payload);
    setUser(user);
    setToken(token);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
  };

  const value = useMemo(() => ({ user, token, login, register, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

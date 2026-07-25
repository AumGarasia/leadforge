import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { api } from "./api";

interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
}

interface AuthState {
  user: CurrentUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const raw = localStorage.getItem("currentUser");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    localStorage.setItem("accessToken", res.data.accessToken);
    localStorage.setItem("refreshToken", res.data.refreshToken);
    localStorage.setItem("currentUser", JSON.stringify(res.data.user));
    setUser(res.data.user);
  }

  function logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("currentUser");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// Client-side mirror of the server's ownership rule (SRS 3.4). This only
// controls what the UI shows/enables — every one of these actions is
// re-checked server-side, so this function being wrong would be a UX bug,
// never a security hole.
export function canMutateLead(user: CurrentUser | null, lead: { assignedToId: string | null }) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return lead.assignedToId === user.id;
}

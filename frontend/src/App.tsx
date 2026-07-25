import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { PublicCapturePage } from "./pages/PublicCapturePage";
import { LeadsListPage } from "./pages/LeadsListPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { AdminUsersPage } from "./pages/AdminUsersPage";
import "./index.css";

function Nav() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <nav className="nav">
      <span className="brand">LeadForge</span>
      <Link to="/leads">Leads</Link>
      {user.role === "ADMIN" && <Link to="/admin/users">Team</Link>}
      <span className="spacer" />
      <span className="muted">{user.name} · {user.role}</span>
      <button className="link-btn" onClick={logout}>Sign out</button>
    </nav>
  );
}

function Shell() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="container">
        <Routes>
          <Route path="/" element={<PublicCapturePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/leads" element={<ProtectedRoute><LeadsListPage /></ProtectedRoute>} />
          <Route path="/leads/:id" element={<ProtectedRoute><LeadDetailPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute><AdminUsersPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer">
        Built for Digital Heroes Training Task ·{" "}
        <a href="https://digitalheroesco.com" target="_blank" rel="noreferrer">digitalheroesco.com</a>
      </footer>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

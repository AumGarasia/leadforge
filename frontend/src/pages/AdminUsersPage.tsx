import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function AdminUsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "MEMBER" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.listUsers().then((res) => setUsers(res.data)); }, []);

  // Server enforces this too (403 on non-admins) — this redirect is only
  // for UX; see lib/auth.tsx for the shared rationale.
  if (user?.role !== "ADMIN") return <Navigate to="/leads" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createUser(form);
      const res = await api.listUsers();
      setUsers(res.data);
      setForm({ name: "", email: "", password: "", role: "MEMBER" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create user");
    }
  }

  return (
    <div>
      <h1>Team</h1>
      <table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.isActive ? "Yes" : "No"}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Add team member</h2>
      <form onSubmit={onSubmit} className="inline-form">
        <input placeholder="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Temp password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="submit">Add</button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

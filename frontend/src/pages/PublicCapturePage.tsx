import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "../lib/api";

export function PublicCapturePage() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.submitPublicLead(form);
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="auth-card">
        <h1>Thanks!</h1>
        <p className="muted">We've received your details and someone from our team will be in touch shortly.</p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Get in touch</h1>
      <p className="muted">Tell us a bit about what you're looking for.</p>
      <form onSubmit={onSubmit}>
        <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Company<input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></label>
        <label>Message<textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
        {status === "error" && <p className="error">Something went wrong — please try again.</p>}
        <button type="submit">Submit</button>
      </form>
    </div>
  );
}

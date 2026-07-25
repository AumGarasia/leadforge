import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth, canMutateLead } from "../lib/auth";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"];

export function LeadDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [lead, setLead] = useState<any>(null);
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await api.getLead(id!);
    setLead(res.data);
  }

  useEffect(() => { refresh(); }, [id]);

  if (!lead) return <p className="muted">Loading...</p>;

  const canMutate = canMutateLead(user, lead);

  async function handleStageChange(stage: string) {
    setError(null);
    try {
      let lostReason: string | undefined;
      if (stage === "LOST") {
        lostReason = window.prompt("Reason lead was lost?") || undefined;
        if (!lostReason) return;
      }
      await api.updateStage(id!, stage, lostReason);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update stage");
    }
  }

  async function handleAddNote() {
    if (!noteBody.trim()) return;
    try {
      await api.addNote(id!, noteBody);
      setNoteBody("");
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add note");
    }
  }

  async function handleClaim() {
    try {
      await api.claimLead(id!);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to claim lead");
    }
  }

  return (
    <div>
      <h1>{lead.name}</h1>
      <p className="muted">{lead.email} {lead.company ? `· ${lead.company}` : ""}</p>
      {lead.message && <p className="lead-message">"{lead.message}"</p>}

      <div className="row-between">
        <div>
          <span className={`badge badge-${lead.stage.toLowerCase()}`}>{lead.stage.replace("_", " ")}</span>
          {" "}
          {!lead.assignedToId && <button onClick={handleClaim}>Claim this lead</button>}
        </div>
        {canMutate && (
          <select value={lead.stage} onChange={(e) => handleStageChange(e.target.value)}>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {!canMutate && lead.assignedToId && (
        <p className="muted">This lead is assigned to someone else — you have read-only access.</p>
      )}

      <h2>Notes</h2>
      <ul className="notes">
        {lead.notes.map((n: any) => (
          <li key={n.id}><span className="muted">{new Date(n.createdAt).toLocaleString()}</span><p>{n.body}</p></li>
        ))}
      </ul>
      {canMutate && (
        <div className="note-form">
          <textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} placeholder="Add a note..." />
          <button onClick={handleAddNote}>Add note</button>
        </div>
      )}

      <h2>Activity</h2>
      <ul className="activity">
        {lead.activity.map((a: any) => (
          <li key={a.id}>
            <span className="muted">{new Date(a.createdAt).toLocaleString()}</span> — {a.eventType.replace("_", " ")}
            {a.eventType === "STAGE_CHANGED" && ` (${a.payload.from} → ${a.payload.to})`}
          </li>
        ))}
      </ul>
    </div>
  );
}

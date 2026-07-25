import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"];

interface Lead {
  id: string; name: string; email: string; company: string | null; stage: string; assignedToId: string | null;
}

export function LeadsListPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stage, setStage] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listLeads({ stage: stage || undefined, page, limit: 15 })
      .then((res) => { setLeads(res.data); setTotalPages(res.pagination.total_pages); })
      .finally(() => setLoading(false));
  }, [stage, page]);

  return (
    <div>
      <div className="row-between">
        <h1>Leads</h1>
        <select value={stage} onChange={(e) => { setStage(e.target.value); setPage(1); }}>
          <option value="">All stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Company</th><th>Stage</th><th>Assigned</th></tr></thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td><Link to={`/leads/${l.id}`}>{l.name}</Link></td>
                <td>{l.email}</td>
                <td>{l.company || "—"}</td>
                <td><span className={`badge badge-${l.stage.toLowerCase()}`}>{l.stage.replace("_", " ")}</span></td>
                <td>{l.assignedToId ? "Assigned" : <span className="muted">Unassigned</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pager">
        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
      </div>
    </div>
  );
}

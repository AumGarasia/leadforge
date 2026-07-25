import { randomUUID } from "node:crypto";
import { db } from "./db";

export type Role = "ADMIN" | "MEMBER";
export type Stage = "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL_SENT" | "WON" | "LOST";

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: number | boolean;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string | null;
  source: string;
  stage: Stage;
  lostReason: string | null;
  assignedToId: string | null;
  createdAt: string;
  updatedAt: string;
}

export const Users = {
  async create(input: { name: string; email: string; passwordHash: string; role?: Role }): Promise<User> {
    const id = randomUUID();
    await db.run(
      `INSERT INTO users (id, name, email, passwordHash, role) VALUES (?, ?, ?, ?, ?)`,
      [id, input.name, input.email, input.passwordHash, input.role ?? "MEMBER"]
    );
    return (await Users.findById(id))!;
  },
  async findByEmail(email: string): Promise<User | undefined> {
    return db.get(`SELECT * FROM users WHERE email = ?`, [email]);
  },
  async findById(id: string): Promise<User | undefined> {
    return db.get(`SELECT * FROM users WHERE id = ?`, [id]);
  },
  async list(): Promise<User[]> {
    return db.all(`SELECT * FROM users ORDER BY createdAt DESC`);
  },
  async setActive(id: string, isActive: boolean) {
    await db.run(`UPDATE users SET isActive = ? WHERE id = ?`, [isActive, id]);
  },
};

export const Leads = {
  async create(input: {
    name: string; email: string; company?: string | null; message?: string | null; source?: string;
  }): Promise<Lead> {
    const id = randomUUID();
    await db.run(
      `INSERT INTO leads (id, name, email, company, message, source) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name, input.email, input.company ?? null, input.message ?? null, input.source ?? "public_form"]
    );
    return (await Leads.findById(id))!;
  },
  async findById(id: string): Promise<Lead | undefined> {
    return db.get(`SELECT * FROM leads WHERE id = ?`, [id]);
  },
  async list(filters: { stage?: string; assignedToId?: string; page: number; limit: number }) {
    const clauses: string[] = [];
    const params: any[] = [];
    if (filters.stage) { clauses.push("stage = ?"); params.push(filters.stage); }
    if (filters.assignedToId) { clauses.push("assignedToId = ?"); params.push(filters.assignedToId); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const countRow = await db.get(`SELECT COUNT(*) as c FROM leads ${where}`, params);
    const total = Number(countRow.c);
    const offset = (filters.page - 1) * filters.limit;
    const rows = await db.all(
      `SELECT * FROM leads ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      [...params, filters.limit, offset]
    );

    return {
      data: rows as Lead[],
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        total_pages: Math.max(1, Math.ceil(total / filters.limit)),
      },
    };
  },
  async updateStage(id: string, stage: Stage, lostReason?: string | null) {
    await db.run(
      `UPDATE leads SET stage = ?, lostReason = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [stage, lostReason ?? null, id]
    );
    return (await Leads.findById(id))!;
  },
  async assign(id: string, assignedToId: string | null) {
    await db.run(
      `UPDATE leads SET assignedToId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?`,
      [assignedToId, id]
    );
    return (await Leads.findById(id))!;
  },
};

export const Notes = {
  async create(input: { leadId: string; authorId: string; body: string }) {
    const id = randomUUID();
    await db.run(`INSERT INTO notes (id, leadId, authorId, body) VALUES (?, ?, ?, ?)`, [
      id, input.leadId, input.authorId, input.body,
    ]);
    return db.get(`SELECT * FROM notes WHERE id = ?`, [id]);
  },
  async listForLead(leadId: string) {
    return db.all(`SELECT * FROM notes WHERE leadId = ? ORDER BY createdAt ASC`, [leadId]);
  },
};

export const Activity = {
  async log(input: { leadId: string; actorId?: string | null; eventType: string; payload: object }) {
    const id = randomUUID();
    await db.run(
      `INSERT INTO activity_log (id, leadId, actorId, eventType, payload) VALUES (?, ?, ?, ?, ?)`,
      [id, input.leadId, input.actorId ?? null, input.eventType, JSON.stringify(input.payload)]
    );
    return id;
  },
  async listForLead(leadId: string) {
    const rows = await db.all(`SELECT * FROM activity_log WHERE leadId = ? ORDER BY createdAt ASC`, [leadId]);
    return rows.map((row: any) => ({ ...row, payload: JSON.parse(row.payload) }));
  },
};

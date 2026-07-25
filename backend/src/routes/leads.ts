import { Router, Response } from "express";
import { z } from "zod";
import { authenticate, requireRole, AuthedRequest, fail } from "../middleware/auth";
import { Leads, Notes, Activity, Users } from "../lib/repositories";

const router = Router();
router.use(authenticate);

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"] as const;

// GET /api/leads?stage=&assigned_to=&page=&limit=  (FR-4)
router.get("/", async (req: AuthedRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
  const stage = req.query.stage ? String(req.query.stage) : undefined;
  const assignedToId = req.query.assigned_to ? String(req.query.assigned_to) : undefined;
  const result = await Leads.list({ stage, assignedToId, page, limit });
  res.json({ data: result.data, pagination: result.pagination });
});

// GET /api/leads/:id  (FR-5)
router.get("/:id", async (req: AuthedRequest, res: Response) => {
  const lead = await Leads.findById(String(req.params.id));
  if (!lead) return fail(res, 404, "NOT_FOUND", "Lead not found.");
  res.json({
    data: {
      ...lead,
      notes: await Notes.listForLead(lead.id),
      activity: await Activity.listForLead(lead.id),
    },
  });
});

// Ownership rule per SRS 3.4: Members may mutate only leads assigned to them; Admins may mutate any lead.
function canMutate(req: AuthedRequest, lead: { assignedToId: string | null }): boolean {
  if (req.user!.role === "ADMIN") return true;
  return lead.assignedToId === req.user!.id;
}

const stageSchema = z.object({
  stage: z.enum(STAGES),
  lostReason: z.string().max(500).optional(),
});

// PATCH /api/leads/:id/stage  (FR-6)
router.patch("/:id/stage", async (req: AuthedRequest, res: Response) => {
  const lead = await Leads.findById(String(req.params.id));
  if (!lead) return fail(res, 404, "NOT_FOUND", "Lead not found.");
  if (!canMutate(req, lead)) return fail(res, 403, "FORBIDDEN", "You can only update leads assigned to you.");

  const parsed = stageSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", parsed.error.message);
  if (parsed.data.stage === "LOST" && !parsed.data.lostReason) {
    return fail(res, 400, "VALIDATION_ERROR", "lostReason is required when stage is LOST.");
  }

  const updated = await Leads.updateStage(lead.id, parsed.data.stage, parsed.data.lostReason ?? null);
  await Activity.log({
    leadId: lead.id, actorId: req.user!.id, eventType: "STAGE_CHANGED",
    payload: { from: lead.stage, to: parsed.data.stage },
  });
  res.json({ data: updated });
});

const noteSchema = z.object({ body: z.string().min(1).max(5000) });

// POST /api/leads/:id/notes  (FR-7)
router.post("/:id/notes", async (req: AuthedRequest, res: Response) => {
  const lead = await Leads.findById(String(req.params.id));
  if (!lead) return fail(res, 404, "NOT_FOUND", "Lead not found.");
  if (!canMutate(req, lead)) return fail(res, 403, "FORBIDDEN", "You can only add notes to leads assigned to you.");

  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", parsed.error.message);

  const note = await Notes.create({ leadId: lead.id, authorId: req.user!.id, body: parsed.data.body });
  await Activity.log({ leadId: lead.id, actorId: req.user!.id, eventType: "NOTE_ADDED", payload: {} });
  res.status(201).json({ data: note });
});

const assignSchema = z.object({ userId: z.string().min(1) });

// PATCH /api/leads/:id/assign  (FR-8, Admin only)
router.patch("/:id/assign", requireRole("ADMIN"), async (req: AuthedRequest, res: Response) => {
  const lead = await Leads.findById(String(req.params.id));
  if (!lead) return fail(res, 404, "NOT_FOUND", "Lead not found.");

  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return fail(res, 400, "VALIDATION_ERROR", parsed.error.message);
  const target = await Users.findById(parsed.data.userId);
  if (!target) return fail(res, 404, "NOT_FOUND", "Target user not found.");

  const updated = await Leads.assign(lead.id, target.id);
  await Activity.log({ leadId: lead.id, actorId: req.user!.id, eventType: "ASSIGNED", payload: { to: target.id } });
  res.json({ data: updated });
});

// POST /api/leads/:id/claim  (FR-8, self-claim)
router.post("/:id/claim", async (req: AuthedRequest, res: Response) => {
  const lead = await Leads.findById(String(req.params.id));
  if (!lead) return fail(res, 404, "NOT_FOUND", "Lead not found.");
  if (lead.assignedToId) return fail(res, 400, "ALREADY_ASSIGNED", "This lead is already assigned.");

  const updated = await Leads.assign(lead.id, req.user!.id);
  await Activity.log({ leadId: lead.id, actorId: req.user!.id, eventType: "ASSIGNED", payload: { to: req.user!.id, via: "self-claim" } });
  res.json({ data: updated });
});

export default router;

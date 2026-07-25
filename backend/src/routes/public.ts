import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { Leads, Activity } from "../lib/repositories";

const router = Router();

// Rate-limited by IP: public endpoint, no auth, so this is the only
// abuse control available (NFR-Security).
const captureLimiter = rateLimit({
  windowMs: 60_000,
  max: process.env.NODE_ENV === "test" ? 1000 : 10,
});

const captureSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  company: z.string().max(200).optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(100).optional(),
});

router.post("/leads", captureLimiter, async (req, res) => {
  const parsed = captureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  const lead = await Leads.create(parsed.data);
  await Activity.log({ leadId: lead.id, actorId: null, eventType: "CREATED", payload: { source: lead.source } });
  return res.status(201).json({ data: { id: lead.id } });
});

export default router;

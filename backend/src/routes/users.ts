import { Router } from "express";
import { z } from "zod";
import { authenticate, requireRole } from "../middleware/auth";
import { Users } from "../lib/repositories";
import { hashPassword } from "../lib/auth";

const router = Router();

router.use(authenticate, requireRole("ADMIN"));

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MEMBER"]).optional(),
});

router.get("/", async (_req, res) => {
  const users = (await Users.list()).map(({ passwordHash, ...safe }) => safe);
  res.json({ data: users });
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  if (await Users.findByEmail(parsed.data.email)) {
    return res.status(400).json({ error: { code: "EMAIL_TAKEN", message: "A user with this email already exists." } });
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await Users.create({ ...parsed.data, passwordHash });
  const { passwordHash: _, ...safe } = user;
  res.status(201).json({ data: safe });
});

router.patch("/:id/deactivate", async (req, res) => {
  const user = await Users.findById(String(req.params.id));
  if (!user) return res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
  await Users.setActive(user.id, false);
  res.json({ data: { id: user.id, isActive: false } });
});

export default router;

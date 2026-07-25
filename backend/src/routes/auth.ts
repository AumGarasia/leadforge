import { Router } from "express";
import { z } from "zod";
import { Users } from "../lib/repositories";
import { verifyPassword, signAccessToken, signRefreshToken, verifyToken } from "../lib/auth";

const router = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  const user = await Users.findByEmail(parsed.data.email);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." } });
  }
  const payload = { sub: user.id, role: user.role as "ADMIN" | "MEMBER" };
  return res.json({
    data: {
      accessToken: signAccessToken(payload),
      refreshToken: signRefreshToken(payload),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    },
  });
});

const refreshSchema = z.object({ refreshToken: z.string() });

router.post("/refresh", (req, res) => {
  const parsed = refreshSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsed.error.message } });
  }
  try {
    const payload = verifyToken(parsed.data.refreshToken);
    return res.json({ data: { accessToken: signAccessToken({ sub: payload.sub, role: payload.role }) } });
  } catch {
    return res.status(401).json({ error: { code: "INVALID_TOKEN", message: "Refresh token is invalid or expired." } });
  }
});

export default router;

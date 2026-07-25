import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { Users } from "../lib/repositories";

export interface AuthedRequest extends Request {
  user?: { id: string; role: "ADMIN" | "MEMBER" };
}

function fail(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ error: { code, message } });
}

export async function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return fail(res, 401, "UNAUTHENTICATED", "Missing or malformed Authorization header.");
  }
  try {
    const payload = verifyToken(header.slice("Bearer ".length));
    const user = await Users.findById(payload.sub);
    if (!user || !user.isActive) {
      return fail(res, 401, "UNAUTHENTICATED", "Account not found or deactivated.");
    }
    req.user = { id: user.id, role: user.role };
    next();
  } catch {
    return fail(res, 401, "UNAUTHENTICATED", "Invalid or expired token.");
  }
}

export function requireRole(...roles: Array<"ADMIN" | "MEMBER">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return fail(res, 403, "FORBIDDEN", "You do not have permission to perform this action.");
    }
    next();
  };
}

export { fail };

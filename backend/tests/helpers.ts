import request from "supertest";
import { Express } from "express";
import { Users } from "../src/lib/repositories";
import { hashPassword } from "../src/lib/auth";

export async function seedUser(app: Express, opts: { name: string; email: string; password: string; role: "ADMIN" | "MEMBER" }) {
  const passwordHash = await hashPassword(opts.password);
  const user = await Users.create({ name: opts.name, email: opts.email, passwordHash, role: opts.role });
  const login = await request(app).post("/api/auth/login").send({ email: opts.email, password: opts.password });
  return { user, token: login.body.data.accessToken as string };
}

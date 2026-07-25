import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "../src/lib/db";
import { seedUser } from "./helpers";

const app = createApp();

beforeEach(() => resetDb());

describe("authentication", () => {
  it("rejects requests with no token", async () => {
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("rejects requests with a malformed token", async () => {
    const res = await request(app).get("/api/leads").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("logs in with valid credentials and rejects invalid ones", async () => {
    await seedUser(app, { name: "Ada", email: "ada@leadforge.dev", password: "correcthorse1", role: "MEMBER" });

    const good = await request(app).post("/api/auth/login").send({ email: "ada@leadforge.dev", password: "correcthorse1" });
    expect(good.status).toBe(200);
    expect(good.body.data.accessToken).toBeDefined();

    const bad = await request(app).post("/api/auth/login").send({ email: "ada@leadforge.dev", password: "wrong" });
    expect(bad.status).toBe(401);
  });
});

describe("role-based permissions (server-enforced, FR-10)", () => {
  it("denies a MEMBER creating another user (admin-only route)", async () => {
    const { token } = await seedUser(app, { name: "Mo", email: "mo@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New", email: "new@leadforge.dev", password: "correcthorse1" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("allows an ADMIN to create a user", async () => {
    const { token } = await seedUser(app, { name: "Ann", email: "ann@leadforge.dev", password: "correcthorse1", role: "ADMIN" });
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New", email: "new@leadforge.dev", password: "correcthorse1" });
    expect(res.status).toBe(201);
  });

  it("denies a MEMBER editing another member's assigned lead", async () => {
    const owner = await seedUser(app, { name: "Owner", email: "owner@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const other = await seedUser(app, { name: "Other", email: "other@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const admin = await seedUser(app, { name: "Admin2", email: "admin2@leadforge.dev", password: "correcthorse1", role: "ADMIN" });

    const capture = await request(app).post("/api/public/leads").send({ name: "Prospect", email: "p@x.com" });
    const leadId = capture.body.data.id;

    await request(app)
      .patch(`/api/leads/${leadId}/assign`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ userId: owner.user.id });

    const denied = await request(app)
      .patch(`/api/leads/${leadId}/stage`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ stage: "CONTACTED" });
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/leads/${leadId}/stage`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ stage: "CONTACTED" });
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.stage).toBe("CONTACTED");
  });

  it("denies a MEMBER from reassigning a lead (admin-only)", async () => {
    const member = await seedUser(app, { name: "M", email: "m@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const capture = await request(app).post("/api/public/leads").send({ name: "P2", email: "p2@x.com" });
    const leadId = capture.body.data.id;

    const res = await request(app)
      .patch(`/api/leads/${leadId}/assign`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({ userId: member.user.id });
    expect(res.status).toBe(403);
  });
});

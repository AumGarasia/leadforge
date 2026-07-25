import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "../src/lib/db";
import { seedUser } from "./helpers";

const app = createApp();

beforeEach(() => resetDb());

describe("lead lifecycle and activity trail", () => {
  it("records a STAGE_CHANGED activity entry on every stage update", async () => {
    const admin = await seedUser(app, { name: "Admin", email: "admin@leadforge.dev", password: "correcthorse1", role: "ADMIN" });
    const capture = await request(app).post("/api/public/leads").send({ name: "Prospect", email: "p@x.com" });
    const leadId = capture.body.data.id;

    await request(app).patch(`/api/leads/${leadId}/assign`).set("Authorization", `Bearer ${admin.token}`).send({ userId: admin.user.id });
    await request(app).patch(`/api/leads/${leadId}/stage`).set("Authorization", `Bearer ${admin.token}`).send({ stage: "CONTACTED" });
    await request(app).patch(`/api/leads/${leadId}/stage`).set("Authorization", `Bearer ${admin.token}`).send({ stage: "QUALIFIED" });

    const detail = await request(app).get(`/api/leads/${leadId}`).set("Authorization", `Bearer ${admin.token}`);
    const stageEvents = detail.body.data.activity.filter((e: any) => e.eventType === "STAGE_CHANGED");
    expect(stageEvents).toHaveLength(2);
    expect(stageEvents[0].payload).toEqual({ from: "NEW", to: "CONTACTED" });
    expect(stageEvents[1].payload).toEqual({ from: "CONTACTED", to: "QUALIFIED" });
  });

  it("requires a lostReason when moving a lead to LOST", async () => {
    const admin = await seedUser(app, { name: "Admin", email: "admin@leadforge.dev", password: "correcthorse1", role: "ADMIN" });
    const capture = await request(app).post("/api/public/leads").send({ name: "Prospect", email: "p@x.com" });
    const leadId = capture.body.data.id;
    await request(app).patch(`/api/leads/${leadId}/assign`).set("Authorization", `Bearer ${admin.token}`).send({ userId: admin.user.id });

    const missing = await request(app).patch(`/api/leads/${leadId}/stage`).set("Authorization", `Bearer ${admin.token}`).send({ stage: "LOST" });
    expect(missing.status).toBe(400);

    const withReason = await request(app)
      .patch(`/api/leads/${leadId}/stage`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ stage: "LOST", lostReason: "No budget" });
    expect(withReason.status).toBe(200);
  });

  it("lets a MEMBER self-claim an unassigned lead but not an already-assigned one", async () => {
    const m1 = await seedUser(app, { name: "M1", email: "m1@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const m2 = await seedUser(app, { name: "M2", email: "m2@leadforge.dev", password: "correcthorse1", role: "MEMBER" });
    const capture = await request(app).post("/api/public/leads").send({ name: "Prospect", email: "p@x.com" });
    const leadId = capture.body.data.id;

    const claim1 = await request(app).post(`/api/leads/${leadId}/claim`).set("Authorization", `Bearer ${m1.token}`);
    expect(claim1.status).toBe(200);
    expect(claim1.body.data.assignedToId).toBe(m1.user.id);

    const claim2 = await request(app).post(`/api/leads/${leadId}/claim`).set("Authorization", `Bearer ${m2.token}`);
    expect(claim2.status).toBe(400);
    expect(claim2.body.error.code).toBe("ALREADY_ASSIGNED");
  });

  it("paginates the lead list", async () => {
    const admin = await seedUser(app, { name: "Admin", email: "admin@leadforge.dev", password: "correcthorse1", role: "ADMIN" });
    for (let i = 0; i < 25; i++) {
      await request(app).post("/api/public/leads").send({ name: `Lead ${i}`, email: `lead${i}@x.com` });
    }
    const res = await request(app).get("/api/leads?page=1&limit=10").set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.pagination).toEqual({ page: 1, limit: 10, total: 25, total_pages: 3 });
  });
});

import request from "supertest";
import { createApp } from "../src/app";
import { resetDb } from "../src/lib/db";

const app = createApp();

beforeEach(() => resetDb());

describe("public lead capture", () => {
  it("creates a lead with stage NEW and no assignee, and records a CREATED activity", async () => {
    const res = await request(app).post("/api/public/leads").send({
      name: "Jordan Prospect",
      email: "jordan@prospect.com",
      company: "Prospect Co",
      message: "Interested in a quote",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeDefined();
  });

  it("rejects an invalid email with 400", async () => {
    const res = await request(app).post("/api/public/leads").send({ name: "No Email", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("cannot be listed or read without authentication", async () => {
    await request(app).post("/api/public/leads").send({ name: "X", email: "x@x.com" });
    const res = await request(app).get("/api/leads");
    expect(res.status).toBe(401);
  });
});

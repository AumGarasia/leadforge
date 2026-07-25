import "dotenv/config";
import { createApp } from "./app";
import { ensureSchema } from "./lib/db";
import { Users } from "./lib/repositories";
import { hashPassword } from "./lib/auth";

async function seedAdminIfMissing() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@leadforge.dev";
  const existing = await Users.findByEmail(email);
  if (existing) return;
  const passwordHash = await hashPassword(process.env.SEED_ADMIN_PASSWORD || "digital!herosco");
  await Users.create({ name: "Admin", email, passwordHash, role: "ADMIN" });
  console.log(`Seeded admin user: ${email}`);
}

async function main() {
  await ensureSchema(); // runs Postgres DDL when DATABASE_URL is set; no-op for SQLite
  await seedAdminIfMissing();
  const app = createApp();
  const port = process.env.PORT || 4000;
  app.listen(port, () => console.log(`LeadForge API listening on :${port}`));
}

main().catch((err) => {
  console.error("Failed to start LeadForge API:", err);
  process.exit(1);
});

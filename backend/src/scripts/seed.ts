/**
 * Seeds LeadForge with realistic demo data: a small team, leads spread
 * across every pipeline stage, notes, and a matching activity trail —
 * so a fresh clone (or fresh production database) doesn't open to an
 * empty app. Works against SQLite (local) or Postgres (production) —
 * whichever DATABASE_URL/DATABASE_PATH selects.
 *
 * Usage:
 *   npm run seed            # adds demo data (skips if leads already exist)
 *   npm run seed -- --reset # wipes users/leads/notes/activity first, then seeds
 */
import "dotenv/config";
import { Users, Leads, Notes, Activity, User } from "../lib/repositories";
import { hashPassword } from "../lib/auth";
import { db, resetDb, ensureSchema } from "../lib/db";

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "WON", "LOST"] as const;

const TEAM = [
  { name: "Aum Garasia", email: "admin@leadforge.dev", password: "ChangeMe123!", role: "ADMIN" as const },
  { name: "Sam Rep", email: "sam@leadforge.dev", password: "MemberPass123", role: "MEMBER" as const },
  { name: "Riya Mehta", email: "riya@leadforge.dev", password: "MemberPass123", role: "MEMBER" as const },
  { name: "Diego Alvarez", email: "diego@leadforge.dev", password: "MemberPass123", role: "MEMBER" as const },
];

// [name, email, company, message, source]
const LEADS: Array<[string, string, string, string, string]> = [
  ["Priya Nair", "priya.nair@brightpath.io", "Brightpath Retail", "Looking for a full storefront rebuild before Q4.", "public_form"],
  ["Marcus Chen", "mchen@fernwoodgoods.com", "Fernwood Goods", "Saw your work on the Ledgerline case study, want to talk.", "public_form"],
  ["Alicia Torres", "alicia@northbridgeco.com", "Northbridge & Co", "Need a quote for a Shopify migration.", "referral"],
  ["Owen Baxter", "owen.b@haleandpine.com", "Hale & Pine", "Current site is on WordPress, wants to move to something faster.", "public_form"],
  ["Fatima Rahman", "fatima@driftwear.com", "Driftwear", "Interested in performance marketing + a landing page refresh.", "linkedin_ad"],
  ["Tomasz Kowalski", "t.kowalski@ledgerline.app", "Ledgerline", "Wants a follow-up on the accounting automation proposal.", "public_form"],
  ["Grace Oyelaran", "grace@ovalstudio.co", "Oval Studio", "Referred by an existing client, wants a brand + site combo.", "referral"],
  ["Ben Whitfield", "ben@whitfieldlaw.com", "Whitfield & Partners", "Law firm site, mostly needs SEO and a redesign.", "public_form"],
  ["Nadia Petrova", "nadia@petrovadesign.com", "Petrova Design", "Freelancer looking for a dev partner on client projects.", "public_form"],
  ["Isaac Osei", "isaac@primevalley.com", "Prime Valley Foods", "E-commerce for a small food brand, launching in 6 weeks.", "public_form"],
  ["Lena Fischer", "lena.fischer@northlightco.com", "Northlight Co", "Wants a quote but budget seems tight — flagged in notes.", "public_form"],
  ["Carlos Jimenez", "carlos@jimenezauto.com", "Jimenez Auto Group", "Multi-location dealership site, complex inventory sync needs.", "referral"],
];

async function main() {
  await ensureSchema();

  const reset = process.argv.includes("--reset");
  if (reset) {
    resetDb();
    console.log("Existing data cleared (--reset).");
  }

  const existingLeads = (await Leads.list({ page: 1, limit: 1 })).pagination.total;
  if (existingLeads > 0 && !reset) {
    console.log(`Database already has ${existingLeads} lead(s). Run "npm run seed -- --reset" to reseed from empty.`);
    return;
  }

  // --- Team ---
  const users: Record<string, User> = {};
  for (const member of TEAM) {
    const existing = await Users.findByEmail(member.email);
    if (existing) {
      users[member.email] = existing;
      continue;
    }
    const passwordHash = await hashPassword(member.password);
    users[member.email] = await Users.create({ name: member.name, email: member.email, passwordHash, role: member.role });
  }
  const memberEmails = TEAM.filter((t) => t.role === "MEMBER").map((t) => t.email);
  console.log(`Seeded ${TEAM.length} users (1 admin, ${memberEmails.length} members).`);

  // --- Leads, spread deliberately across every stage so the pipeline looks real ---
  let stageCursor = 0;
  let leadCount = 0;
  let noteCount = 0;

  for (const [name, email, company, message, source] of LEADS) {
    const lead = await Leads.create({ name, email, company, message, source });
    await Activity.log({ leadId: lead.id, actorId: null, eventType: "CREATED", payload: { source } });
    leadCount++;

    const targetStage = STAGES[stageCursor % STAGES.length];
    stageCursor++;

    if (targetStage === "NEW") continue; // leave some genuinely unassigned/untouched

    const owner = users[memberEmails[leadCount % memberEmails.length]];
    await Leads.assign(lead.id, owner.id);
    await Activity.log({ leadId: lead.id, actorId: users["admin@leadforge.dev"].id, eventType: "ASSIGNED", payload: { to: owner.id } });

    const lostReason = targetStage === "LOST" ? "No budget this quarter" : null;
    await Leads.updateStage(lead.id, targetStage, lostReason);
    await Activity.log({ leadId: lead.id, actorId: owner.id, eventType: "STAGE_CHANGED", payload: { from: "NEW", to: targetStage } });

    if (targetStage !== "CONTACTED") {
      await Notes.create({ leadId: lead.id, authorId: owner.id, body: "Had an initial call — good fit, moving forward." });
      await Activity.log({ leadId: lead.id, actorId: owner.id, eventType: "NOTE_ADDED", payload: {} });
      noteCount++;
    }
    if (targetStage === "PROPOSAL_SENT" || targetStage === "WON") {
      await Notes.create({ leadId: lead.id, authorId: owner.id, body: "Sent proposal, following up early next week." });
      await Activity.log({ leadId: lead.id, actorId: owner.id, eventType: "NOTE_ADDED", payload: {} });
      noteCount++;
    }
    if (targetStage === "LOST") {
      await Notes.create({ leadId: lead.id, authorId: owner.id, body: `Marked lost: ${lostReason}` });
      await Activity.log({ leadId: lead.id, actorId: owner.id, eventType: "NOTE_ADDED", payload: {} });
      noteCount++;
    }
  }

  console.log(`Seeded ${leadCount} leads across all ${STAGES.length} stages, with ${noteCount} notes.`);
  console.log("\nDemo logins:");
  for (const t of TEAM) console.log(`  ${t.role.padEnd(6)} ${t.email} / ${t.password}`);
}

main()
  .then(() => { db.close(); })
  .catch((err) => { console.error(err); db.close(); process.exit(1); });

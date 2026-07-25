const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, AlignmentType, LevelFormat, PageBreak, Header, Footer, PageNumber
} = require("docx");
const fs = require("fs");

const PAGE_W = 12240, PAGE_H = 15840;

const H1 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 160 } });
const H2 = (text) => new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 120 } });
const P = (text, opts = {}) => new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 120 } });
const bullet = (text) => new Paragraph({ text, numbering: { reference: "b", level: 0 }, spacing: { after: 60 } });

function cell(text, { header = false, width, mono = false } = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    shading: header ? { type: ShadingType.CLEAR, fill: "2F2F2F" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: header, color: header ? "FFFFFF" : "000000", size: 20, font: mono ? "Consolas" : undefined })]
    })]
  });
}
function table(headerRow, rows, widths) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headerRow.map((h, i) => cell(h, { header: true, width: widths[i] })) }),
      ...rows.map(r => new TableRow({ children: r.map((c, i) => cell(c, { width: widths[i], mono: c._mono })) }))
    ]
  });
}
function codeBlock(lines) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: "F0F0EC" },
    border: { top: { style: "single", size: 2, color: "D0D0CC" }, bottom: { style: "single", size: 2, color: "D0D0CC" }, left: { style: "single", size: 2, color: "D0D0CC" }, right: { style: "single", size: 2, color: "D0D0CC" } },
    spacing: { after: 160 },
    children: lines.split("\n").flatMap((line, i) => [
      ...(i > 0 ? [new TextRun({ break: 1 })] : []),
      new TextRun({ text: line || " ", font: "Consolas", size: 18 })
    ])
  });
}

const doc = new Document({
  numbering: { config: [{ reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Task B — Inherit and Improve", size: 16, color: "888888" })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "888888" })] })] }) },
    children: [
      new Paragraph({ text: "Task B — Inherit and Improve", heading: HeadingLevel.TITLE, spacing: { after: 200 } }),
      P("Digital Heroes Full Stack Development Qualification Task, Role 04/16", { bold: true }),
      P("Prepared by: Aum · July 2026"),
      new Paragraph({ text: "", spacing: { after: 200 } }),
      P("Method note: the brief describes a codebase, not a literal file, so I reproduced the described anti-patterns as a concrete sample (before/discounts.route.js — a coupon-application endpoint) and assessed and refactored that. This makes every claim below checkable against real code rather than assessed in the abstract.", { italics: true }),

      new Paragraph({ children: [new PageBreak()] }),

      H1("1. Assessment"),
      P("Three anti-patterns were reproduced, matching the brief's description: business logic inside route handlers, direct/raw DB calls built by string concatenation, and a hardcoded secret. Risk-ranked by blast radius if left in place, not by how easy each is to fix:"),
      table(
        ["Issue", "Risk if left in place", "Severity"],
        [
          ["Hardcoded DB credential in source (committed to git history)", "Immediate, unbounded — anyone with repo access (past or present, including a fork or leaked clone) has production DB credentials. Rotating after the fact doesn't undo exposure; git history must be treated as compromised.", "Critical"],
          ["Raw SQL via string concatenation", "Direct SQL-injection surface on any user-controlled field (couponCode, orderId, userId all flow into queries unescaped). Exploitable today by anyone hitting the endpoint.", "Critical"],
          ["Business logic embedded in the route handler", "Not an acute risk, but a compounding one: every new discount rule adds another nested callback, coverage requires spinning up the full HTTP+DB stack, and the logic can't be reused (e.g. same discount math needed at checkout preview) without copy-paste.", "Medium (compounding)"],
        ],
        [3200, 5400, 1100]
      ),

      H1("2. Migration Plan"),
      P("Phased so the system — which \u201Ccannot go down\u201D per the brief — is never in a half-migrated, worse-than-before state. Each phase is a safety net before it's a refactor."),
      H2("Week 1 — stop the bleeding, add a safety net"),
      bullet("Rotate the DB credential immediately; move it to environment variables / a secrets manager. Treat the old value as permanently compromised, not just replaced."),
      bullet("Audit git history for any other committed secrets while doing this — a hardcoded credential is rarely the only one."),
      bullet("Add a smoke test around the highest-risk endpoint (this one) at the HTTP level, black-box — asserting current behavior, not refactoring anything yet. This is the net that makes every later step safe to ship."),
      bullet("Parameterize the SQL in place, without restructuring the handler yet — closes the injection hole today without waiting on the full refactor."),
      H2("Month 1 — extract the service layer"),
      bullet("Pull business logic out of the route handler into a service class (as in discountService.ts), one endpoint at a time, each one landing behind its own unit tests before the next starts."),
      bullet("Route handlers shrink to: parse request \u2192 call service \u2192 map result to HTTP response. No SQL, no discount math, no nested callbacks left in routes/."),
      H2("Quarter 1 — data-access layer + coverage baseline"),
      bullet("Introduce a repository layer (as in discountRepositories.ts) so no route or service talks to the database directly — this is what makes the service layer unit-testable without a live DB."),
      bullet("Backfill unit tests on the service layer for all endpoints touched so far, and set a minimum coverage gate in CI going forward (not retroactively enforced on untouched legacy code, to avoid stalling the whole migration on 100% day one)."),

      H1("3. Refactor Demonstration"),
      P("Full before/after code ships alongside this document (before/discounts.route.js and after/). Summary of what changed and why:"),
      table(
        ["", "Before", "After"],
        [
          ["Secret handling", "Hardcoded in source", "Read from env, rotated"],
          ["SQL", "String-concatenated, injectable", "Parameterized queries only, isolated in a repository layer"],
          ["Business logic", "Inline in route handler, 5 levels of nested callbacks", "Extracted to DiscountService — flat, synchronous, sequential"],
          ["Testability", "Requires a live HTTP server + real MySQL connection to test anything", "4 unit tests run in ~4 seconds against fake repositories, no DB or HTTP involved (see after/tests/discountService.test.ts — all passing)"],
          ["Error handling", "Ad hoc res.status(...).send(string) at each nesting level", "Typed DiscountError with a code, mapped to a consistent JSON error shape at the route boundary"],
        ],
        [1700, 3600, 4400]
      ),
      P("The concrete payoff, not just the abstract one: the after/tests/discountService.test.ts suite exercises percent vs. flat discount math, the discount-exceeds-total edge case, the already-redeemed rule, and the minimum-order rule — all in isolation. None of that was possible against the before version without standing up a full server and a real database per test."),

      H1("4. Standards Proposal"),
      P("Proposed as CI-enforced defaults, not a style doc — because a document nobody re-reads doesn't survive contact with a deadline, and \u201Cthe pipeline won't merge it\u201D is the only version of a standard that actually holds under pressure:"),
      bullet("Lint rule blocking raw string-concatenated SQL (custom ESLint rule or a grep-based CI check) — cheap to add, catches the highest-severity issue class directly."),
      bullet("A pre-commit + CI secret scanner (e.g. gitleaks) — blocks the hardcoded-credential class of issue before it ever reaches a branch, not just at review time."),
      bullet("A structural convention: routes/ may only import from services/, services/ may only import from repositories/ — enforced with an import-boundary lint rule so \u201Cbusiness logic in the route\u201D becomes a build failure, not a code-review judgment call."),
      bullet("New code requires tests to merge; existing untouched legacy code is grandfathered in and migrated opportunistically (per the phased plan above) rather than blocking unrelated work."),
      P("Adoption path for a team that's used to shipping fast without these: introduce each rule as a warning for two weeks before it becomes a merge-blocker, and pair the rollout with the week-1/month-1 migration work above so the team sees the standard already being followed on real code before it's enforced on theirs.")
    ]
  }]
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("/home/claude/leadforge/task-b/TaskB_Assessment_and_Migration_Plan.docx", buf);
  console.log("written");
});

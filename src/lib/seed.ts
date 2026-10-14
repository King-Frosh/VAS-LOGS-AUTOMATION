import { db } from "@/db";
import {
  users,
  partners,
  services,
  emailTemplates,
  smtpSettings,
  automationSettings,
  uploads,
  vasLogRows,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { hashPassword, encryptSecret } from "./security";
import { DEFAULT_SUBJECT, DEFAULT_BODY } from "./templates";

const SEED_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "BRICCS-Console-2026";

const SEED_PARTNERS = [
  {
    name: "Telewings Media Limited",
    code: "TWL",
    primaryEmail: "revenue.assurance@telewings.example",
    ccEmails: "finance@telewings.example",
    frequency: "daily",
    autoDelivery: true,
    services: [
      { serviceId: "SVC-8801", serviceName: "GAMEZONE" },
      { serviceId: "SVC-8802", serviceName: "CALLERTUNEZ" },
      { serviceId: "SVC-8817", serviceName: "SPORTSFLASH" },
    ],
  },
  {
    name: "Softridge Digital Limited",
    code: "SDL",
    primaryEmail: "vas.ops@softridge.example",
    ccEmails: "",
    frequency: "daily",
    autoDelivery: true,
    services: [
      { serviceId: "SVC-9120", serviceName: "NEWSWIRE247" },
      { serviceId: "SVC-9121", serviceName: "ASTROCAST" },
    ],
  },
  {
    name: "Northgate Interactive Nigeria",
    code: "NGI",
    primaryEmail: "billing@northgate-interactive.example",
    ccEmails: "audit@northgate-interactive.example",
    frequency: "weekly",
    autoDelivery: false,
    services: [
      { serviceId: "SVC-4405", serviceName: "MELODYBOX" },
      { serviceId: "SVC-4406", serviceName: "DEVOTIONAL" },
    ],
  },
  {
    name: "Pulsemobile Africa Limited",
    code: "PMA",
    primaryEmail: "reconciliation@pulsemobile.example",
    ccEmails: "",
    frequency: "monthly",
    autoDelivery: true,
    services: [
      { serviceId: "SVC-7033", serviceName: "LEARNU" },
      { serviceId: "SVC-7034", serviceName: "HOROSCOPE" },
    ],
  },
  {
    name: "Orbit Value Services Limited",
    code: "OVS",
    primaryEmail: "partners@orbitvalue.example",
    ccEmails: "",
    frequency: "daily",
    autoDelivery: false,
    services: [{ serviceId: "SVC-2210", serviceName: "FANTASYARENA" }],
  },
];

/** Idempotent bootstrap: safe to call on every request. */
export async function ensureSeeded(): Promise<void> {
  const globalForSeed = globalThis as typeof globalThis & { __briccsSeeded?: Promise<void> };
  if (globalForSeed.__briccsSeeded) return globalForSeed.__briccsSeeded;
  globalForSeed.__briccsSeeded = runSeed().catch((err) => {
    globalForSeed.__briccsSeeded = undefined;
    throw err;
  });
  return globalForSeed.__briccsSeeded;
}

async function runSeed(): Promise<void> {
  /* users */
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length === 0) {
    await db.insert(users).values([
      {
        email: "admin@briccs.ng",
        name: "Console Administrator",
        passwordHash: hashPassword(SEED_PASSWORD),
        role: "administrator",
      },
      {
        email: "operations@briccs.ng",
        name: "Revenue Operations",
        passwordHash: hashPassword(SEED_PASSWORD),
        role: "operations",
      },
      {
        email: "reviewer@briccs.ng",
        name: "Assurance Reviewer",
        passwordHash: hashPassword(SEED_PASSWORD),
        role: "reviewer",
      },
    ]);
  }

  /* partner register + manual service mapping */
  const existingPartners = await db.select().from(partners).limit(1);
  if (existingPartners.length === 0) {
    for (const p of SEED_PARTNERS) {
      const [row] = await db
        .insert(partners)
        .values({
          name: p.name,
          code: p.code,
          primaryEmail: p.primaryEmail,
          ccEmails: p.ccEmails,
          frequency: p.frequency,
          autoDelivery: p.autoDelivery,
          notes: "",
        })
        .returning();
      await db.insert(services).values(
        p.services.map((s) => ({
          partnerId: row.id,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
        }))
      );
    }
  }

  /* templates */
  const [tpl] = await db.select().from(emailTemplates).limit(1);
  if (!tpl) {
    await db.insert(emailTemplates).values({
      key: "unreconciled_logs",
      subject: DEFAULT_SUBJECT,
      body: DEFAULT_BODY,
      isDefault: true,
    });
  }

  /* smtp */
  const [smtp] = await db.select().from(smtpSettings).limit(1);
  if (!smtp) {
    await db.insert(smtpSettings).values({
      host: process.env.SMTP_HOST ?? "",
      port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
      login: process.env.SMTP_LOGIN ?? "",
      passwordEnc: process.env.SMTP_PASSWORD ? encryptSecret(process.env.SMTP_PASSWORD) : "",
      fromName: "BRICCS International Ideal Limited",
      fromEmail: process.env.SMTP_FROM ?? "",
      security: Number(process.env.SMTP_PORT) === 465 ? "TLS" : "STARTTLS",
      testEmail: process.env.SMTP_TEST_TO ?? "",
    });
  }

  /* automation */
  const [auto] = await db.select().from(automationSettings).limit(1);
  if (!auto) {
    await db.insert(automationSettings).values({
      enabled: false,
      frequency: "daily",
      timeOfDay: "07:30",
      timezone: "Africa/Lagos",
      lookbackDays: 1,
    });
  }

  /* demo source log rows so the console is alive on first visit */
  const [existingUpload] = await db.select().from(uploads).limit(1);
  if (!existingUpload) {
    await seedDemoRows();
  }
}

async function seedDemoRows() {
  const allServices = await db.select().from(services);
  const allPartners = await db.select().from(partners);
  const byCode = new Map(allPartners.map((p) => [p.code, p]));

  const [upload] = await db
    .insert(uploads)
    .values({
      filename: "MTN_UNRECONCILED_VAS_LOGS_SAMPLE.xlsx",
      storedPath: "storage/uploads/seed-sample.xlsx",
      sha256: "seed000000000000000000000000000000000000000000000000000000000000",
      sizeBytes: 264_180,
      uploaderName: "Console Administrator",
      status: "Ready for Review",
      headerIssues: [],
      message: "Reference dataset loaded for demonstration.",
    })
    .returning();

  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today.getTime() - offset * 86_400_000);
    return d.toISOString().slice(0, 10);
  };

  const transactions = ["SUCCESS", "PENDING", "REVERSED", "FAILED"];
  const rows: (typeof vasLogRows.$inferInsert)[] = [];
  let sourceRow = 2;

  for (let day = 0; day < 9; day++) {
    for (const svc of allServices) {
      const partner = allPartners.find((p) => p.id === svc.partnerId);
      const perDay = 2 + ((day + svc.id) % 3);
      for (let k = 0; k < perDay; k++) {
        const count = 40 + ((day * 17 + svc.id * 7 + k * 13) % 220);
        const pricePoint = [50, 100, 200, 500][(day + k) % 4];
        rows.push({
          uploadId: upload.id,
          sourceRow: sourceRow++,
          logDate: iso(day),
          servicePartner: partner?.name ?? "",
          serviceId: svc.serviceId,
          pricePoint: String(pricePoint),
          productId: `PRD-${String(100000 + svc.id * 137 + day * 11 + k).slice(0, 6)}`,
          productName: `${svc.serviceName} ${["DAILY", "WEEKLY", "MONTHLY"][(day + k) % 3]}`,
          transaction: transactions[(day + k) % transactions.length],
          countValue: count,
          revenueValue: (count * pricePoint).toFixed(2),
          rawDate: iso(day),
          partnerId: partner?.id ?? null,
          serviceIdRef: svc.id,
          matchStatus: "matched",
          issues: "",
        });
      }
    }
  }

  // A handful of rows the mapping register does not cover — they must be flagged, never guessed.
  const unknowns = [
    { partner: "UNKNOWN AGGREGATOR LTD", serviceId: "SVC-9999", name: "MYSTERYAPP" },
    { partner: "Telewings Media Limited", serviceId: "SVC-0001", name: "UNMAPPED SERVICE" },
    { partner: "  softridge digital limited  ", serviceId: "SVC-9121", name: "ASTROCAST" },
  ];
  for (let i = 0; i < unknowns.length; i++) {
    const u = unknowns[i];
    const partnerMatch = allPartners.find(
      (p) => p.name.trim().toLowerCase() === u.partner.trim().toLowerCase()
    );
    const svcMatch = allServices.find((s) => s.serviceId.trim() === u.serviceId);
    rows.push({
      uploadId: upload.id,
      sourceRow: sourceRow++,
      logDate: iso(2 + i),
      servicePartner: u.partner,
      serviceId: u.serviceId,
      pricePoint: "100",
      productId: `PRD-9${i}0011`,
      productName: u.name,
      transaction: "SUCCESS",
      countValue: 25 + i * 9,
      revenueValue: ((25 + i * 9) * 100).toFixed(2),
      rawDate: iso(2 + i),
      partnerId: partnerMatch?.id ?? null,
      serviceIdRef: svcMatch?.id ?? null,
      matchStatus: partnerMatch
        ? svcMatch
          ? "matched"
          : "unmatched_service"
        : "unmatched_partner",
      issues: partnerMatch
        ? svcMatch
          ? ""
          : `Service ID ${u.serviceId} is not present in the service mapping register.`
        : `SERVICE PARTNER "${u.partner.trim()}" is not in the Partner Register.`,
    });
  }

  // case/whitespace tolerant matching proof
  void byCode;

  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(vasLogRows).values(rows.slice(i, i + 200));
  }

  await db
    .update(uploads)
    .set({ totalRows: rows.length, validRows: rows.length - 2, invalidRows: 2 })
    .where(eq(uploads.id, upload.id));
}

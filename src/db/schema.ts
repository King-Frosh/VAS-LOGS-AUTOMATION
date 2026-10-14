import {
  pgTable,
  serial,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  numeric,
  uniqueIndex,
  index,
  jsonb,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Identity & access                                                   */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: varchar("role", { length: 24 }).notNull().default("operations"), // administrator | operations | reviewer
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Partner register                                                    */
/* ------------------------------------------------------------------ */

export const partners = pgTable(
  "partners",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    code: varchar("code", { length: 48 }).notNull(),
    primaryEmail: varchar("primary_email", { length: 254 }).notNull(),
    ccEmails: text("cc_emails").notNull().default(""),
    autoDelivery: boolean("auto_delivery").notNull().default(false),
    frequency: varchar("frequency", { length: 16 }).notNull().default("daily"), // daily | weekly | monthly
    active: boolean("active").notNull().default(true),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("partners_code_uq").on(t.code)]
);

/**
 * Manual service mapping register.
 * Service ID / Service Name -> Partner. Editable, extensible, never guessed.
 */
export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id, { onDelete: "cascade" }),
    serviceId: varchar("service_id", { length: 64 }).notNull(),
    serviceName: text("service_name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("services_service_id_uq").on(t.serviceId),
    index("services_partner_idx").on(t.partnerId),
    index("services_name_idx").on(t.serviceName),
  ]
);

/* ------------------------------------------------------------------ */
/* Source logs                                                         */
/* ------------------------------------------------------------------ */

export const uploads = pgTable("uploads", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  uploaderId: integer("uploader_id").references(() => users.id),
  uploaderName: text("uploader_name").notNull().default(""),
  status: varchar("status", { length: 24 }).notNull().default("Unprocessed"),
  totalRows: integer("total_rows").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  duplicateOfUploadId: integer("duplicate_of_upload_id"),
  headerIssues: jsonb("header_issues").$type<string[]>().notNull().default([]),
  message: text("message").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const vasLogRows = pgTable(
  "vas_log_rows",
  {
    id: serial("id").primaryKey(),
    uploadId: integer("upload_id")
      .notNull()
      .references(() => uploads.id, { onDelete: "cascade" }),
    sourceRow: integer("source_row").notNull(),
    logDate: date("log_date"),
    servicePartner: text("service_partner").notNull().default(""),
    serviceId: text("service_id").notNull().default(""),
    pricePoint: text("price_point").notNull().default(""),
    productId: text("product_id").notNull().default(""),
    productName: text("product_name").notNull().default(""),
    transaction: text("transaction").notNull().default(""),
    countValue: integer("count_value"),
    revenueValue: numeric("revenue_value", { precision: 18, scale: 2 }),
    rawDate: text("raw_date").notNull().default(""),
    partnerId: integer("partner_id").references(() => partners.id),
    serviceIdRef: integer("service_id_ref").references(() => services.id),
    matchStatus: varchar("match_status", { length: 32 }).notNull().default("unmatched_partner"),
    issues: text("issues").notNull().default(""),
  },
  (t) => [
    index("vas_rows_upload_idx").on(t.uploadId),
    index("vas_rows_match_idx").on(t.matchStatus),
    index("vas_rows_date_idx").on(t.logDate),
  ]
);

/* ------------------------------------------------------------------ */
/* Report batches & generated workbooks                                */
/* ------------------------------------------------------------------ */

export const reportBatches = pgTable("report_batches", {
  id: serial("id").primaryKey(),
  label: text("label").notNull().default(""),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  frequency: varchar("frequency", { length: 16 }).notNull().default("daily"),
  status: varchar("status", { length: 32 }).notNull().default("Processing"),
  createdBy: integer("created_by").references(() => users.id),
  createdByName: text("created_by_name").notNull().default(""),
  sourceRows: integer("source_rows").notNull().default(0),
  matchedRows: integer("matched_rows").notNull().default(0),
  unmatchedRows: integer("unmatched_rows").notNull().default(0),
  invalidRows: integer("invalid_rows").notNull().default(0),
  matchedCount: integer("matched_count").notNull().default(0),
  matchedRevenue: numeric("matched_revenue", { precision: 18, scale: 2 }).notNull().default("0"),
  unmatchedCount: integer("unmatched_count").notNull().default(0),
  unmatchedRevenue: numeric("unmatched_revenue", { precision: 18, scale: 2 }).notNull().default("0"),
  balanced: boolean("balanced").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const partnerReports = pgTable(
  "partner_reports",
  {
    id: serial("id").primaryKey(),
    batchId: integer("batch_id")
      .notNull()
      .references(() => reportBatches.id, { onDelete: "cascade" }),
    partnerId: integer("partner_id")
      .notNull()
      .references(() => partners.id),
    serviceId: integer("service_id").references(() => services.id),
    serviceName: text("service_name").notNull().default(""),
    partnerCode: text("partner_code").notNull().default(""),
    filename: text("filename").notNull(),
    filePath: text("file_path").notNull(),
    fileSize: integer("file_size").notNull().default(0),
    rowCount: integer("row_count").notNull().default(0),
    countTotal: integer("count_total").notNull().default(0),
    revenueTotal: numeric("revenue_total", { precision: 18, scale: 2 }).notNull().default("0"),
    status: varchar("status", { length: 32 }).notNull().default("Ready to Send"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("partner_reports_uq").on(t.batchId, t.partnerId, t.serviceId)]
);

/* ------------------------------------------------------------------ */
/* Email configuration                                                 */
/* ------------------------------------------------------------------ */

export const emailTemplates = pgTable("email_templates", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 48 }).notNull().unique(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  isDefault: boolean("is_default").notNull().default(true),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const smtpSettings = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  login: text("login").notNull().default(""),
  passwordEnc: text("password_enc").notNull().default(""),
  fromName: text("from_name").notNull().default("BRICCS International Ideal Limited"),
  fromEmail: text("from_email").notNull().default(""),
  security: varchar("security", { length: 16 }).notNull().default("STARTTLS"),
  testEmail: text("test_email").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").notNull().default(""),
});

export const automationSettings = pgTable("automation_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  frequency: varchar("frequency", { length: 16 }).notNull().default("daily"),
  timeOfDay: varchar("time_of_day", { length: 5 }).notNull().default("07:30"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  lookbackDays: integer("lookback_days").notNull().default(1),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastRunStatus: text("last_run_status").notNull().default("Never run"),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  updatedBy: text("updated_by").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Delivery tracking                                                   */
/* ------------------------------------------------------------------ */

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id").references(() => partnerReports.id),
    batchId: integer("batch_id").references(() => reportBatches.id),
    partnerId: integer("partner_id").references(() => partners.id),
    partnerName: text("partner_name").notNull().default(""),
    serviceName: text("service_name").notNull().default(""),
    toEmail: varchar("to_email", { length: 254 }).notNull(),
    ccEmails: text("cc_emails").notNull().default(""),
    subject: text("subject").notNull(),
    bodySnapshot: text("body_snapshot").notNull().default(""),
    attachmentFilename: text("attachment_filename").notNull().default(""),
    attachmentPath: text("attachment_path").notNull().default(""),
    attachmentBytes: integer("attachment_bytes").notNull().default(0),
    mode: varchar("mode", { length: 16 }).notNull().default("manual"), // manual | bulk | scheduled | resend
    status: varchar("status", { length: 32 }).notNull().default("Queued"),
    providerResponse: text("provider_response").notNull().default(""),
    errorMessage: text("error_message").notNull().default(""),
    attempts: integer("attempts").notNull().default(0),
    idempotencyKey: text("idempotency_key").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_deliveries_idem_uq").on(t.idempotencyKey)]
);

export const emailDeliveryAttempts = pgTable("email_delivery_attempts", {
  id: serial("id").primaryKey(),
  deliveryId: integer("delivery_id")
    .notNull()
    .references(() => emailDeliveries.id, { onDelete: "cascade" }),
  attemptNo: integer("attempt_no").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  errorMessage: text("error_message").notNull().default(""),
  providerResponse: text("provider_response").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorEmail: text("actor_email").notNull().default("system"),
    actorRole: text("actor_role").notNull().default("system"),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 48 }).notNull().default(""),
    entityId: text("entity_id").notNull().default(""),
    detail: text("detail").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)]
);

export type Partner = typeof partners.$inferSelect;
export type Service = typeof services.$inferSelect;
export type PartnerReport = typeof partnerReports.$inferSelect;
export type EmailDelivery = typeof emailDeliveries.$inferSelect;
export type User = typeof users.$inferSelect;

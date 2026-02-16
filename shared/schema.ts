import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, serial, timestamp, boolean, decimal, date, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const institutions = pgTable("institutions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  idUuid: varchar("id_uuid"),
  name: text("name").notNull(),
  address: text("address"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("patient"),
  institutionId: varchar("institution_id"),
  institutionUuid: varchar("institution_uuid"),
  approvalStatus: text("approval_status"),
  authUserId: varchar("auth_user_id"),
  healthDataConsent: boolean("health_data_consent"),
  femaleHealthConsent: boolean("female_health_consent"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const patients = pgTable("patients", {
  id: varchar("id").primaryKey(),
  userId: varchar("user_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  sex: text("sex"),
  dateOfBirth: date("date_of_birth"),
  bloodType: text("blood_type"),
  heightCm: real("height_cm"),
  weightKg: real("weight_kg"),
  phone: text("phone"),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  assignedClinicianId: varchar("assigned_clinician_id"),
  hospitalId: varchar("hospital_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const conditions = pgTable("conditions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vitalReadings = pgTable("vital_readings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  type: text("type").notNull(),
  value: decimal("value").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow(),
  source: text("source").default("mobile-sync"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const riskScores = pgTable("risk_scores", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  conditionId: integer("condition_id"),
  score: decimal("score"),
  level: text("level").notNull(),
  explanation: text("explanation"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  conditionId: integer("condition_id"),
  alertType: text("alert_type").notNull(),
  severity: text("severity"),
  message: text("message").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow(),
  isResolved: boolean("is_resolved").notNull().default(false),
  respondedById: varchar("responded_by_id"),
  respondedAt: timestamp("responded_at"),
});

export const clinicianProfiles = pgTable("clinician_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  fullName: text("full_name").notNull(),
  licenseNumber: text("license_number"),
  specialty: text("specialty"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: varchar("target_id"),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sponsorDependents = pgTable("sponsor_dependents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorUserId: varchar("sponsor_user_id"),
  dependentPatientId: varchar("dependent_patient_id"),
  status: text("status").notNull().default("pending"),
  relationship: text("relationship"),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

export const fileAttachments = pgTable("file_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  patientId: varchar("patient_id"),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  category: text("category").notNull().default("general"),
  description: text("description"),
  fileData: text("file_data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userInvites = pgTable("user_invites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  role: text("role").notNull().default("patient"),
  institutionId: varchar("institution_id"),
  invitedById: varchar("invited_by_id"),
  token: text("token").notNull().unique(),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userProfiles = pgTable("user_profiles", {
  userId: varchar("user_id").primaryKey(),
  role: text("role").notNull().default("patient"),
  institutionId: varchar("institution_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPatientSchema = createInsertSchema(patients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVitalReadingSchema = createInsertSchema(vitalReadings).omit({
  id: true,
  createdAt: true,
});

export const insertAlertSchema = createInsertSchema(alerts).omit({
  id: true,
});

export const insertInstitutionSchema = createInsertSchema(institutions).omit({
  id: true,
  createdAt: true,
});

export const insertClinicianProfileSchema = createInsertSchema(clinicianProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertUserInviteSchema = createInsertSchema(userInvites).omit({
  id: true,
  createdAt: true,
});

export const insertSponsorDependentSchema = createInsertSchema(sponsorDependents).omit({
  id: true,
  createdAt: true,
});

export const insertFileAttachmentSchema = createInsertSchema(fileAttachments).omit({
  id: true,
  createdAt: true,
});

export type User = typeof users.$inferSelect;
export type Patient = typeof patients.$inferSelect;
export type Condition = typeof conditions.$inferSelect;
export type VitalReading = typeof vitalReadings.$inferSelect;
export type RiskScore = typeof riskScores.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Institution = typeof institutions.$inferSelect;
export type ClinicianProfile = typeof clinicianProfiles.$inferSelect;

export type InsertPatient = z.infer<typeof insertPatientSchema>;
export type InsertVitalReading = z.infer<typeof insertVitalReadingSchema>;
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type InsertInstitution = z.infer<typeof insertInstitutionSchema>;
export type InsertClinicianProfile = z.infer<typeof insertClinicianProfileSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type UserInvite = typeof userInvites.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type InsertUserInvite = z.infer<typeof insertUserInviteSchema>;
export type SponsorDependent = typeof sponsorDependents.$inferSelect;
export type InsertSponsorDependent = z.infer<typeof insertSponsorDependentSchema>;
export type FileAttachment = typeof fileAttachments.$inferSelect;
export type InsertFileAttachment = z.infer<typeof insertFileAttachmentSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;

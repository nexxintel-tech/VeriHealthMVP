import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { db } from "./db";
import {
  users, userProfiles, patients, institutions, healthReadings,
  riskScores, alerts, clinicianProfiles, activityLogs, userInvites,
  sponsorDependents, fileAttachments, conditions, medications,
} from "../shared/schema";
import { eq, and, inArray, isNull, desc, asc, gte, lt, ne, count, sql, or } from "drizzle-orm";
import { authenticateUser, requireRole, requireApproved, signToken } from "./middleware/auth";
import { sendEmail, generateConfirmationEmail, generatePasswordResetEmail } from "./email";

const HEALTH_TYPE_MAP: Record<string, string> = {
  heart_rate: "Heart Rate",
  blood_pressure_systolic: "Blood Pressure Systolic",
  blood_pressure_diastolic: "Blood Pressure Diastolic",
  spo2: "SpO2",
  temperature: "Temperature",
  weight: "Weight",
  steps: "Steps",
  sleep: "Sleep",
  hrv: "HRV",
  respiratory_rate: "Respiratory Rate",
  blood_glucose: "Blood Glucose",
  bmi: "BMI",
};

const DISPLAY_TO_HEALTH_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(HEALTH_TYPE_MAP).map(([k, v]) => [v, k])
);

function toDisplayType(healthType: string): string {
  return HEALTH_TYPE_MAP[healthType] || healthType;
}

function toHealthType(displayType: string): string {
  return DISPLAY_TO_HEALTH_TYPE[displayType] || displayType;
}

function resolveInstitutionScope(institutionId: string | null | undefined): string | null {
  if (!institutionId || !institutionId.trim()) return null;
  return institutionId;
}

function getBase64DecodedSize(base64Input: string): number | null {
  if (!base64Input || typeof base64Input !== "string") return null;
  const base64 = base64Input.replace(/\s/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return null;
  try {
    return Buffer.from(base64, "base64").length;
  } catch {
    return null;
  }
}

function calcAge(dateOfBirth: string | null | undefined): number {
  if (!dateOfBirth) return 0;
  return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function logActivity(userId: string, action: string, targetType: string, targetId?: string | null, details?: string, ipAddress?: string) {
  try {
    await db.insert(activityLogs).values({
      id: crypto.randomUUID(),
      userId,
      action,
      targetType,
      targetId: targetId || null,
      details: details || null,
      ipAddress: ipAddress || null,
    });
  } catch (e) {
    console.error("Activity log error:", e);
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs: number, maxRequests: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rateLimitStore.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (entry.count >= maxRequests) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }
    entry.count++;
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  });
}, 60000);

export async function registerRoutes(app: Express): Promise<Server> {
  const authRateLimit = rateLimit(15 * 60 * 1000, 10);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // ============================================================
  // AUTH ENDPOINTS
  // ============================================================

  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (!user) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (user.disabledAt) {
        return res.status(403).json({ error: "Account disabled. Please contact support." });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, user.id)).limit(1);

      if (profile?.role === "clinician" && user.approvalStatus !== "approved") {
        const statusMessage = user.approvalStatus === "rejected"
          ? "Your clinician registration was rejected. Please contact your institution administrator."
          : "Your clinician account is pending approval by your institution administrator.";
        return res.status(403).json({ error: statusMessage, approvalStatus: user.approvalStatus });
      }

      const token = signToken({ userId: user.id, email: user.email, role: profile?.role || "patient" });

      res.json({
        user: { id: user.id, email: user.email, role: profile?.role || "patient" },
        session: { access_token: token },
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const { email, password, fullName, age, gender, institutionCode, inviteToken } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      let role = "patient";
      let targetInstitutionId: string | null = null;
      let inviteId: string | null = null;

      if (inviteToken) {
        const inviteTokenHash = hashToken(inviteToken);
        const [invite] = await db.select().from(userInvites)
          .where(and(eq(userInvites.tokenHash, inviteTokenHash), eq(userInvites.status, "pending")))
          .limit(1);

        if (!invite) {
          return res.status(400).json({ error: "Invalid or already used invitation link." });
        }
        if (new Date(invite.expiresAt) < new Date()) {
          await db.update(userInvites).set({ status: "expired" }).where(eq(userInvites.id, invite.id));
          return res.status(400).json({ error: "This invitation has expired. Please request a new one." });
        }
        if (invite.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ error: "This invitation was sent to a different email address." });
        }
        role = invite.role || "patient";
        targetInstitutionId = invite.institutionId || null;
        inviteId = invite.id;
      } else if (institutionCode) {
        const [inst] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, institutionCode)).limit(1);
        if (!inst) {
          return res.status(400).json({ error: "Invalid institution code. Please check and try again." });
        }
        targetInstitutionId = inst.id;
      } else {
        const [defaultInst] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.isDefault, true)).limit(1);
        if (defaultInst) targetInstitutionId = defaultInst.id;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();
      const approvalStatus = role === "institution_admin" ? "approved" : role === "clinician" ? "pending" : null;

      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        emailConfirmed: true,
        approvalStatus,
      });

      await db.insert(userProfiles).values({
        userId,
        role,
        institutionId: targetInstitutionId,
      });

      if (role === "patient") {
        const patientFullName = fullName || email.split("@")[0];
        const nameParts = patientFullName.split(" ");
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.slice(1).join(" ") || "";
        const patientSex = gender || "unknown";

        await db.insert(patients).values({
          id: crypto.randomUUID(),
          userId,
          firstName,
          lastName,
          sex: patientSex.toLowerCase(),
          hospitalId: targetInstitutionId || null,
          assignedClinicianId: null,
        });
      }

      if (inviteId) {
        await db.update(userInvites).set({ status: "used" }).where(eq(userInvites.id, inviteId));
      }

      const token = signToken({ userId, email: email.toLowerCase(), role });
      res.json({
        user: { id: userId, email: email.toLowerCase(), role },
        session: { access_token: token },
        message: "Registration successful",
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  app.get("/api/auth/verify-invite", authRateLimit, async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token is required" });
      }

      const inviteTokenHash = hashToken(token);
      const [invite] = await db.select().from(userInvites)
        .where(and(eq(userInvites.tokenHash, inviteTokenHash), eq(userInvites.status, "pending")))
        .limit(1);

      if (!invite) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }
      if (new Date(invite.expiresAt) < new Date()) {
        return res.status(400).json({ error: "This invitation has expired" });
      }

      res.json({ email: invite.email, role: invite.role });
    } catch (error) {
      console.error("Verify invite error:", error);
      res.status(500).json({ error: "Failed to verify invitation" });
    }
  });

  app.post("/api/auth/register-clinician", authRateLimit, async (req, res) => {
    try {
      const { email, password, fullName, licenseNumber, specialty, phone, institutionId } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Email, password, and full name are required" });
      }

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      let selectedInstitutionId = institutionId;
      if (!selectedInstitutionId) {
        const [defaultInstitution] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.isDefault, true)).limit(1);
        if (!defaultInstitution) {
          return res.status(400).json({ error: "No institution available. Please contact support." });
        }
        selectedInstitutionId = defaultInstitution.id;
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const userId = crypto.randomUUID();

      await db.insert(users).values({
        id: userId,
        email: email.toLowerCase(),
        passwordHash,
        emailConfirmed: true,
        approvalStatus: "pending",
      });

      await db.insert(userProfiles).values({
        userId,
        role: "clinician",
        institutionId: selectedInstitutionId,
      });

      await db.insert(clinicianProfiles).values({
        id: crypto.randomUUID(),
        userId,
        fullName,
        licenseNumber: licenseNumber || null,
        specialty: specialty || null,
        phone: phone || null,
      });

      res.json({
        message: "Registration successful. Your account is pending approval by your institution administrator.",
        requiresApproval: true,
      });
    } catch (error: any) {
      console.error("Clinician registration error:", error);
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  app.post("/api/auth/logout", authRateLimit, async (req, res) => {
    res.json({ message: "Logged out successfully" });
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const [user] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (!user) {
        return res.json({ message: "If an account exists with this email, a password reset link has been sent." });
      }

      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = hashToken(resetToken);
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await db.update(users).set({
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpires: resetExpires,
      }).where(eq(users.id, user.id));

      const resetUrl = `${process.env.VITE_DASHBOARD_URL || "http://localhost:5000"}/reset-password?token=${resetToken}`;
      try {
        const resetEmail = generatePasswordResetEmail(email, resetUrl);
        await sendEmail(resetEmail);
      } catch (emailError: any) {
        console.error("Error sending password reset email:", emailError);
      }

      res.json({ message: "If an account exists with this email, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to send password reset email" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const { password, token } = req.body;
      if (!password) return res.status(400).json({ error: "Password is required" });
      if (!token) return res.status(400).json({ error: "Reset token is required" });

      const resetTokenHash = hashToken(token);
      const [user] = await db.select().from(users)
        .where(eq(users.passwordResetTokenHash, resetTokenHash))
        .limit(1);

      if (!user || !user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
        return res.status(401).json({ error: "Invalid or expired reset token. Please request a new password reset link." });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      await db.update(users).set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpires: null,
      }).where(eq(users.id, user.id));

      res.json({ message: "Password reset successfully. Please log in with your new password." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
  });

  app.post("/api/auth/resend-confirmation", authRateLimit, async (req, res) => {
    res.json({ message: "If an account exists with this email, a confirmation link has been sent." });
  });

  app.get("/api/auth/me", authenticateUser, async (req, res) => {
    res.json({ user: req.user });
  });

  app.get("/api/session/check", authenticateUser, async (req, res) => {
    res.json({
      ok: true,
      userId: req.user!.id,
      role: req.user!.role,
      institutionId: req.user!.institutionId || null,
    });
  });

  // ============================================================
  // PATIENT ENDPOINTS (for clinicians/admins viewing patients)
  // ============================================================

  app.post("/api/patient/complete-profile", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (userRole !== "patient") {
        return res.status(403).json({ error: "Only patients can complete this profile" });
      }

      const { fullName, gender, sex, dateOfBirth, institutionCode } = req.body;
      if (!fullName) return res.status(400).json({ error: "Full name is required" });

      const [existingPatient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (existingPatient) return res.status(400).json({ error: "Patient profile already exists" });

      let targetInstitutionId: string | null = null;
      if (institutionCode) {
        const [inst] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.id, institutionCode)).limit(1);
        if (!inst) return res.status(400).json({ error: "Invalid institution code" });
        targetInstitutionId = inst.id;
      } else {
        const [defaultInst] = await db.select({ id: institutions.id }).from(institutions).where(eq(institutions.isDefault, true)).limit(1);
        if (defaultInst) targetInstitutionId = defaultInst.id;
      }

      const nameParts = fullName.split(" ");
      const firstName = nameParts[0] || "Unknown";
      const lastName = nameParts.slice(1).join(" ") || "";
      const patientSex = (sex || gender || "unknown").toLowerCase();

      const [patient] = await db.insert(patients).values({
        id: crypto.randomUUID(),
        userId,
        firstName,
        lastName,
        sex: patientSex,
        dateOfBirth: dateOfBirth || null,
        hospitalId: targetInstitutionId || null,
        assignedClinicianId: null,
      }).returning();

      if (targetInstitutionId) {
        await db.update(userProfiles).set({ institutionId: targetInstitutionId }).where(eq(userProfiles.userId, userId));
      }

      res.json({ patient, message: "Profile completed successfully" });
    } catch (error: any) {
      console.error("Complete profile error:", error);
      res.status(400).json({ error: error.message || "Failed to complete profile" });
    }
  });

  app.get("/api/patients/unassigned", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      let conditions_arr: any[] = [isNull(patients.assignedClinicianId)];

      if (userRole === "clinician" || userRole === "institution_admin") {
        if (!userInstitutionId) return res.json([]);
        conditions_arr.push(eq(patients.hospitalId, userInstitutionId));
      }

      const result = await db.select().from(patients).where(and(...conditions_arr)).orderBy(asc(patients.createdAt));

      const patientsWithInstitution = await Promise.all(
        result.map(async (patient) => {
          let institutionName = null;
          if (patient.hospitalId) {
            const [inst] = await db.select({ name: institutions.name }).from(institutions).where(eq(institutions.id, patient.hospitalId)).limit(1);
            institutionName = inst?.name || null;
          }
          const name = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown";
          const age = calcAge(patient.dateOfBirth);
          return { ...patient, name, age, gender: patient.sex, institutionName };
        })
      );

      res.json(patientsWithInstitution);
    } catch (error: any) {
      console.error("Error fetching unassigned patients:", error);
      res.status(500).json({ error: "Failed to fetch unassigned patients" });
    }
  });

  app.post("/api/patients/:id/claim", authenticateUser, requireRole("clinician"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const clinicianId = req.user!.id;
      const clinicianInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      if (!clinicianInstitutionId) {
        return res.status(403).json({ error: "Clinician account is not linked to an institution" });
      }

      const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      if (patient.assignedClinicianId) return res.status(400).json({ error: "This patient is already assigned to a clinician" });
      if (!patient.hospitalId || String(patient.hospitalId) !== String(clinicianInstitutionId)) {
        return res.status(403).json({ error: "You can only claim patients within your institution" });
      }

      const updated = await db.update(patients).set({ assignedClinicianId: clinicianId })
        .where(and(eq(patients.id, id), isNull(patients.assignedClinicianId)))
        .returning({ id: patients.id });

      if (!updated.length) {
        return res.status(400).json({ error: "This patient was just claimed by another clinician" });
      }

      const patientName = `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown";
      res.json({ message: `Patient ${patientName} has been assigned to you`, patientId: id });
    } catch (error: any) {
      console.error("Error claiming patient:", error);
      res.status(500).json({ error: "Failed to claim patient" });
    }
  });

  app.get("/api/patients", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      let whereConditions: any[] = [];
      if (userRole === "clinician") {
        whereConditions.push(eq(patients.assignedClinicianId, userId));
      } else if (userRole === "institution_admin") {
        if (!userInstitutionId) return res.status(403).json({ error: "Institution admin account is not linked to an institution" });
        whereConditions.push(eq(patients.hospitalId, userInstitutionId));
      }

      const patientList = await db.select().from(patients)
        .where(whereConditions.length ? and(...whereConditions) : undefined)
        .orderBy(desc(patients.createdAt));

      if (!patientList.length) return res.json([]);

      const patientUserIds = patientList.map((p) => p.userId).filter(Boolean) as string[];
      let latestRiskByUserId: Record<string, any> = {};

      if (patientUserIds.length > 0) {
        const allRiskScores = await db.select().from(riskScores)
          .where(inArray(riskScores.userId, patientUserIds))
          .orderBy(desc(riskScores.generatedAt));

        latestRiskByUserId = allRiskScores.reduce((acc, rs) => {
          if (!acc[rs.userId!]) acc[rs.userId!] = rs;
          return acc;
        }, {} as Record<string, any>);
      }

      const allConditions = await db.select().from(conditions);
      const conditionMap = allConditions.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<number, string>);

      const allRiskScoresForConditions = patientUserIds.length > 0
        ? await db.select({ userId: riskScores.userId, conditionId: riskScores.conditionId })
            .from(riskScores)
            .where(inArray(riskScores.userId, patientUserIds))
        : [];

      const conditionsByUserId: Record<string, string[]> = {};
      allRiskScoresForConditions.forEach((rs) => {
        if (rs.userId && rs.conditionId) {
          if (!conditionsByUserId[rs.userId]) conditionsByUserId[rs.userId] = [];
          const condName = conditionMap[rs.conditionId];
          if (condName && !conditionsByUserId[rs.userId].includes(condName)) {
            conditionsByUserId[rs.userId].push(condName);
          }
        }
      });

      const transformedPatients = patientList.map((patient) => {
        const riskData = patient.userId ? latestRiskByUserId[patient.userId] : null;
        return {
          id: patient.id,
          name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
          age: calcAge(patient.dateOfBirth),
          gender: patient.sex || "N/A",
          conditions: patient.userId ? (conditionsByUserId[patient.userId] || []) : [],
          riskScore: riskData?.score || 0,
          riskLevel: riskData?.level || "low",
          lastSync: riskData?.generatedAt || patient.createdAt,
        };
      });

      res.json(transformedPatients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      if (userRole === "institution_admin" && !userInstitutionId) {
        return res.status(403).json({ error: "Institution admin account is not linked to an institution" });
      }

      const [patient] = await db.select().from(patients).where(eq(patients.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      if (userRole === "clinician" && patient.assignedClinicianId !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === "institution_admin" && String(patient.hospitalId) !== String(userInstitutionId)) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      let riskData: any = null;
      let patientConditions: string[] = [];
      if (patient.userId) {
        const [rs] = await db.select().from(riskScores)
          .where(eq(riskScores.userId, patient.userId))
          .orderBy(desc(riskScores.generatedAt))
          .limit(1);
        riskData = rs;

        const patientRiskScores = await db.select({ conditionId: riskScores.conditionId })
          .from(riskScores)
          .where(eq(riskScores.userId, patient.userId));
        const conditionIdSet = new Set(patientRiskScores.map((r) => r.conditionId).filter(Boolean) as number[]);
        const conditionIds = Array.from(conditionIdSet);
        if (conditionIds.length > 0) {
          const condList = await db.select({ id: conditions.id, name: conditions.name })
            .from(conditions)
            .where(inArray(conditions.id, conditionIds));
          patientConditions = condList.map((c) => c.name);
        }
      }

      res.json({
        id: patient.id,
        name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
        age: calcAge(patient.dateOfBirth),
        gender: patient.sex || "N/A",
        conditions: patientConditions,
        riskScore: riskData?.score || 0,
        riskLevel: riskData?.level || "low",
        lastSync: riskData?.generatedAt || patient.createdAt,
      });
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  app.get("/api/patients/:id/vitals", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const { type, days = 7 } = req.query;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      if (userRole === "institution_admin" && !userInstitutionId) {
        return res.status(403).json({ error: "Institution admin account is not linked to an institution" });
      }

      const [patient] = await db.select({
        userId: patients.userId,
        assignedClinicianId: patients.assignedClinicianId,
        hospitalId: patients.hospitalId,
      }).from(patients).where(eq(patients.id, id)).limit(1);

      if (!patient) return res.status(404).json({ error: "Patient not found" });

      if (userRole === "clinician" && patient.assignedClinicianId !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === "institution_admin" && String(patient.hospitalId) !== String(userInstitutionId)) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      if (!patient.userId) return res.status(404).json({ error: "Patient user_id not found" });

      const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();

      let whereClause: any = and(
        eq(healthReadings.userId, patient.userId as any),
        gte(healthReadings.recordedAt, new Date(since))
      );

      if (type) {
        const healthType = toHealthType(type as string);
        whereClause = and(whereClause, eq(healthReadings.type, healthType));
      }

      const vitals = await db.select().from(healthReadings).where(whereClause).orderBy(desc(healthReadings.recordedAt));

      const transformed = vitals.map((v) => ({ ...v, type: toDisplayType(v.type) }));
      res.json(transformed);
    } catch (error) {
      console.error("Error fetching vitals:", error);
      res.status(500).json({ error: "Failed to fetch vitals" });
    }
  });

  // ============================================================
  // MEDICATIONS
  // ============================================================

  app.get("/api/patients/:id/medications", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      const [patient] = await db.select({ assignedClinicianId: patients.assignedClinicianId, hospitalId: patients.hospitalId })
        .from(patients).where(eq(patients.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      if (userRole === "clinician" && patient.assignedClinicianId !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === "institution_admin" && String(patient.hospitalId) !== String(userInstitutionId)) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      const medList = await db.select().from(medications)
        .where(eq(medications.patientId, id))
        .orderBy(desc(medications.createdAt));

      res.json(medList);
    } catch (error) {
      console.error("Error fetching medications:", error);
      res.status(500).json({ error: "Failed to fetch medications" });
    }
  });

  app.post("/api/patients/:id/medications", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      const [patient] = await db.select({ assignedClinicianId: patients.assignedClinicianId, hospitalId: patients.hospitalId })
        .from(patients).where(eq(patients.id, id)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      if (userRole === "clinician" && patient.assignedClinicianId !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === "institution_admin" && String(patient.hospitalId) !== String(userInstitutionId)) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      const { name, dosage, frequency, prescribedBy, startDate, isActive } = req.body;
      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ error: "Medication name is required" });
      }

      const [medication] = await db.insert(medications).values({
        patientId: id,
        name: name.trim(),
        dosage: dosage || null,
        frequency: frequency || null,
        prescribedBy: prescribedBy || null,
        startDate: startDate || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      }).returning();

      res.json(medication);
    } catch (error) {
      console.error("Error creating medication:", error);
      res.status(500).json({ error: "Failed to create medication" });
    }
  });

  // ============================================================
  // ALERTS
  // ============================================================

  app.get("/api/alerts", authenticateUser, requireRole("clinician", "admin"), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      let patientUserIds: string[] = [];
      if (userRole === "clinician") {
        const clinicianPatients = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.assignedClinicianId, userId));
        patientUserIds = clinicianPatients.map((p) => p.userId).filter(Boolean) as string[];
      }

      if (userRole === "clinician" && patientUserIds.length === 0) return res.json([]);

      const whereCondition = userRole === "clinician"
        ? and(inArray(alerts.userId, patientUserIds))
        : undefined;

      const alertList = await db.select().from(alerts)
        .where(whereCondition)
        .orderBy(desc(alerts.triggeredAt))
        .limit(50);

      const alertUserIds = Array.from(new Set(alertList.map((a) => a.userId).filter(Boolean) as string[]));
      let patientNamesByUserId: Record<string, string> = {};

      if (alertUserIds.length > 0) {
        const patientsForAlerts = await db.select({ userId: patients.userId, firstName: patients.firstName, lastName: patients.lastName })
          .from(patients)
          .where(inArray(patients.userId, alertUserIds));
        patientsForAlerts.forEach((p) => {
          if (p.userId) patientNamesByUserId[p.userId] = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
        });
      }

      const transformedAlerts = alertList.map((a) => ({
        id: a.id,
        patientId: a.userId,
        patientName: a.userId ? (patientNamesByUserId[a.userId] || "Unknown") : "Unknown",
        type: a.alertType,
        message: a.message,
        severity: a.severity,
        timestamp: a.triggeredAt,
        isRead: a.isResolved,
      }));

      res.json(transformedAlerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.patch("/api/alerts/:id", authenticateUser, requireRole("clinician", "admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const alertId = parseInt(id, 10);
      if (isNaN(alertId)) return res.status(400).json({ error: "Invalid alert ID" });
      const { isRead } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      const [alert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
      if (!alert) return res.status(404).json({ error: "Alert not found" });

      if (userRole === "clinician" && alert.userId) {
        const [patient] = await db.select({ assignedClinicianId: patients.assignedClinicianId })
          .from(patients).where(eq(patients.userId, alert.userId)).limit(1);
        if (patient?.assignedClinicianId !== userId) {
          return res.status(403).json({ error: "Access denied - patient not assigned to you" });
        }
      }

      const [updated] = await db.update(alerts).set({ isResolved: isRead }).where(eq(alerts.id, alertId)).returning();
      res.json(updated);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  app.patch("/api/alerts/:id/respond", authenticateUser, requireRole("clinician", "admin"), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const alertId = parseInt(id, 10);
      if (isNaN(alertId)) return res.status(400).json({ error: "Invalid alert ID" });
      const clinicianId = req.user!.id;
      const userRole = req.user!.role;

      const [existingAlert] = await db.select().from(alerts).where(eq(alerts.id, alertId)).limit(1);
      if (!existingAlert) return res.status(404).json({ error: "Alert not found" });

      if (userRole === "clinician" && existingAlert.userId) {
        const [patient] = await db.select({ assignedClinicianId: patients.assignedClinicianId })
          .from(patients).where(eq(patients.userId, existingAlert.userId)).limit(1);
        if (patient?.assignedClinicianId !== clinicianId) {
          return res.status(403).json({ error: "Access denied - patient not assigned to you" });
        }
      }

      if (existingAlert.respondedById) {
        return res.status(400).json({ error: "Alert already responded to" });
      }

      const [data] = await db.update(alerts).set({
        isResolved: true,
        respondedById: clinicianId,
        respondedAt: new Date(),
      }).where(and(eq(alerts.id, alertId), isNull(alerts.respondedById))).returning();

      res.json(data);
    } catch (error) {
      console.error("Error responding to alert:", error);
      res.status(500).json({ error: "Failed to respond to alert" });
    }
  });

  // ============================================================
  // DASHBOARD
  // ============================================================

  app.get("/api/dashboard/stats", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      if (userRole === "institution_admin") {
        if (!userInstitutionId) return res.status(403).json({ error: "Institution admin account is not linked to an institution" });

        const clinicianProfileList = await db.select({ userId: userProfiles.userId })
          .from(userProfiles)
          .where(and(eq(userProfiles.role, "clinician"), eq(userProfiles.institutionId, userInstitutionId)));

        const clinicianUserIds = clinicianProfileList.map((p) => p.userId);
        let clinicianList: any[] = [];

        if (clinicianUserIds.length > 0) {
          clinicianList = await db.select({ id: users.id, approvalStatus: users.approvalStatus })
            .from(users).where(inArray(users.id, clinicianUserIds));
        }

        const totalClinicians = clinicianList.length;
        const approvedClinicians = clinicianList.filter((c) => c.approvalStatus === "approved").length;
        const pendingApprovals = clinicianList.filter((c) => c.approvalStatus === "pending").length;

        const approvedClinicianIds = clinicianList.filter((c) => c.approvalStatus === "approved").map((c) => c.id);
        let avgPerformanceScore = 0;

        if (approvedClinicianIds.length > 0) {
          const respondedAlertList = await db.select({ respondedById: alerts.respondedById, triggeredAt: alerts.triggeredAt, respondedAt: alerts.respondedAt, isResolved: alerts.isResolved })
            .from(alerts)
            .where(and(inArray(alerts.respondedById, approvedClinicianIds)));

          const responseTimes = respondedAlertList
            .filter((a) => a.respondedAt)
            .map((a) => new Date(a.respondedAt!).getTime() - new Date(a.triggeredAt!).getTime())
            .filter((t) => t > 0);

          const totalRespondedAlerts = respondedAlertList.length;
          const resolvedAlerts = respondedAlertList.filter((a) => a.isResolved).length;
          const alertResolutionRate = totalRespondedAlerts > 0 ? resolvedAlerts / totalRespondedAlerts : 0;

          let responseTimeScore = 0;
          if (responseTimes.length > 0) {
            const avgResponseMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            responseTimeScore = Math.max(0, 40 - (avgResponseMs / 60000 / 5) * 8);
          }

          avgPerformanceScore = Math.max(0, Math.round(responseTimeScore + alertResolutionRate * 60));
        }

        return res.json({ totalClinicians, approvedClinicians, pendingApprovals, avgPerformanceScore, isClinicianView: true });
      }

      let patientWhereClause: any = undefined;
      if (userRole === "clinician") {
        patientWhereClause = eq(patients.assignedClinicianId, userId);
      }

      const patientList = await db.select({ id: patients.id, userId: patients.userId })
        .from(patients).where(patientWhereClause);
      const patientIds = patientList.map((p) => p.id);
      const totalPatients = patientIds.length;

      let unassignedCount = 0;
      let unassignedConditions: any[] = [isNull(patients.assignedClinicianId)];
      if (userRole === "clinician" && userInstitutionId) {
        unassignedConditions.push(eq(patients.hospitalId, userInstitutionId));
      }
      const [{ value: unassignedVal }] = await db.select({ value: count() }).from(patients).where(and(...unassignedConditions));
      unassignedCount = Number(unassignedVal);

      if (totalPatients === 0) {
        return res.json({ totalPatients: 0, highRiskCount: 0, activeAlerts: 0, avgRiskScore: 0, unassignedPatients: unassignedCount, isClinicianView: false });
      }

      const dashPatientUserIds = patientList.map((p) => p.userId).filter(Boolean) as string[];
      let latestRiskScores: any[] = [];

      if (dashPatientUserIds.length > 0) {
        const allRiskScores = await db.select().from(riskScores)
          .where(inArray(riskScores.userId, dashPatientUserIds))
          .orderBy(desc(riskScores.generatedAt));

        const latestRiskByUser = allRiskScores.reduce((acc, rs) => {
          if (!acc[rs.userId!]) acc[rs.userId!] = rs;
          return acc;
        }, {} as Record<string, any>);

        latestRiskScores = Object.values(latestRiskByUser);
      }

      const highRiskCount = latestRiskScores.filter((rs) => rs.level === "high").length;

      let activeAlerts = 0;
      if (dashPatientUserIds.length > 0) {
        const [{ value }] = await db.select({ value: count() }).from(alerts)
          .where(and(inArray(alerts.userId, dashPatientUserIds), eq(alerts.isResolved, false)));
        activeAlerts = Number(value);
      }

      const avgRiskScore = latestRiskScores.length
        ? Math.round(latestRiskScores.reduce((sum, r) => sum + Number(r.score), 0) / latestRiskScores.length)
        : 0;

      res.json({ totalPatients, highRiskCount, activeAlerts, avgRiskScore, unassignedPatients: unassignedCount, isClinicianView: false });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ============================================================
  // INSTITUTIONS
  // ============================================================

  app.get("/api/institutions", async (req, res) => {
    try {
      const institutionList = await db.select({ id: institutions.id, name: institutions.name, address: institutions.address })
        .from(institutions)
        .orderBy(desc(institutions.isDefault), asc(institutions.name));
      res.json(institutionList);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  // ============================================================
  // INSTITUTION ADMIN ENDPOINTS
  // ============================================================

  app.get("/api/admin/pending-clinicians", authenticateUser, requireRole("institution_admin"), async (req, res) => {
    try {
      const institutionId = req.user!.institutionId;
      if (!institutionId) return res.status(403).json({ error: "Institution admin must be assigned to an institution" });

      const clinicianProfileList = await db.select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(and(eq(userProfiles.role, "clinician"), eq(userProfiles.institutionId, institutionId)));

      const clinicianIds = clinicianProfileList.map((p) => p.userId);
      if (!clinicianIds.length) return res.json([]);

      const clinicianUsers = await db.select({ id: users.id, email: users.email, approvalStatus: users.approvalStatus, createdAt: users.createdAt })
        .from(users)
        .where(and(inArray(users.id, clinicianIds), inArray(users.approvalStatus, ["pending", "rejected"])))
        .orderBy(desc(users.createdAt));

      if (!clinicianUsers.length) return res.json([]);

      const userIds = clinicianUsers.map((u) => u.id);
      const profiles = await db.select().from(clinicianProfiles).where(inArray(clinicianProfiles.userId, userIds));
      const profilesByUserId = profiles.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {} as Record<string, any>);

      const pendingClinicians = clinicianUsers.map((user) => ({
        id: user.id,
        email: user.email,
        approvalStatus: user.approvalStatus,
        createdAt: user.createdAt,
        profile: profilesByUserId[user.id] || null,
      }));

      res.json(pendingClinicians);
    } catch (error) {
      console.error("Error fetching pending clinicians:", error);
      res.status(500).json({ error: "Failed to fetch pending clinicians" });
    }
  });

  app.post("/api/admin/approve-clinician", authenticateUser, requireRole("institution_admin"), async (req, res) => {
    try {
      const { clinicianId } = req.body;
      const institutionId = req.user!.institutionId;

      if (!clinicianId || typeof clinicianId !== "string") return res.status(400).json({ error: "Valid clinician ID is required" });
      if (!institutionId) return res.status(403).json({ error: "Institution admin must be assigned to an institution" });

      const [profile] = await db.select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(and(eq(userProfiles.userId, clinicianId), eq(userProfiles.role, "clinician"), eq(userProfiles.institutionId, institutionId)))
        .limit(1);

      if (!profile) return res.status(404).json({ error: "Clinician not found or not in your institution" });

      await db.update(users).set({ approvalStatus: "approved" }).where(eq(users.id, clinicianId));

      res.json({ message: "Clinician approved successfully" });
    } catch (error) {
      console.error("Error approving clinician:", error);
      res.status(500).json({ error: "Failed to approve clinician" });
    }
  });

  app.post("/api/admin/reject-clinician", authenticateUser, requireRole("institution_admin"), async (req, res) => {
    try {
      const { clinicianId } = req.body;
      const institutionId = req.user!.institutionId;

      if (!clinicianId || typeof clinicianId !== "string") return res.status(400).json({ error: "Valid clinician ID is required" });
      if (!institutionId) return res.status(403).json({ error: "Institution admin must be assigned to an institution" });

      const [profile] = await db.select({ userId: userProfiles.userId })
        .from(userProfiles)
        .where(and(eq(userProfiles.userId, clinicianId), eq(userProfiles.role, "clinician"), eq(userProfiles.institutionId, institutionId)))
        .limit(1);

      if (!profile) return res.status(404).json({ error: "Clinician not found or not in your institution" });

      await db.update(users).set({ approvalStatus: "rejected" }).where(eq(users.id, clinicianId));

      res.json({ message: "Clinician rejected" });
    } catch (error) {
      console.error("Error rejecting clinician:", error);
      res.status(500).json({ error: "Failed to reject clinician" });
    }
  });

  // ============================================================
  // SUPER ADMIN ENDPOINTS
  // ============================================================

  app.get("/api/admin/migration-sql", authenticateUser, requireRole("admin"), async (req, res) => {
    res.json({ sql: "-- Migration not needed, using Drizzle ORM with Replit PostgreSQL" });
  });

  app.get("/api/admin/users", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const userList = await db.select({ id: users.id, email: users.email, approvalStatus: users.approvalStatus, disabledAt: users.disabledAt, createdAt: users.createdAt })
        .from(users).orderBy(desc(users.createdAt));

      const allProfiles = await db.select().from(userProfiles);
      const profileByUserId = allProfiles.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {} as Record<string, any>);

      const allInstitutions = await db.select({ id: institutions.id, name: institutions.name }).from(institutions);
      const institutionMap = allInstitutions.reduce((acc, inst) => { acc[inst.id] = inst.name; return acc; }, {} as Record<string, string>);

      const allClinicianProfiles = await db.select({ userId: clinicianProfiles.userId, fullName: clinicianProfiles.fullName }).from(clinicianProfiles);
      const profileMap = allClinicianProfiles.reduce((acc, p) => { acc[p.userId] = p.fullName; return acc; }, {} as Record<string, string>);

      const transformedUsers = userList.map((user) => {
        const up = profileByUserId[user.id];
        return {
          id: user.id,
          email: user.email,
          name: profileMap[user.id] || user.email.split("@")[0],
          role: up?.role || "patient",
          institutionId: up?.institutionId || null,
          institutionName: up?.institutionId ? institutionMap[up.institutionId] : null,
          approvalStatus: user.approvalStatus,
          isActive: !user.disabledAt,
          disabledAt: user.disabledAt,
          createdAt: user.createdAt,
        };
      });

      res.json(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/export", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const userList = await db.select({ id: users.id, email: users.email, approvalStatus: users.approvalStatus, disabledAt: users.disabledAt, createdAt: users.createdAt })
        .from(users).orderBy(desc(users.createdAt));

      const allProfiles = await db.select().from(userProfiles);
      const exportProfileMap = allProfiles.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {} as Record<string, any>);

      const allInstitutions = await db.select({ id: institutions.id, name: institutions.name }).from(institutions);
      const institutionMap = allInstitutions.reduce((acc, inst) => { acc[inst.id] = inst.name; return acc; }, {} as Record<string, string>);

      const allClinicianProfiles = await db.select({ userId: clinicianProfiles.userId, fullName: clinicianProfiles.fullName }).from(clinicianProfiles);
      const profileMap = allClinicianProfiles.reduce((acc, p) => { acc[p.userId] = p.fullName; return acc; }, {} as Record<string, string>);

      const csvRows = [
        ["ID", "Email", "Name", "Role", "Institution", "Status", "Active", "Created At"].join(","),
        ...userList.map((u) => {
          const up = exportProfileMap[u.id];
          return [
            u.id, u.email, profileMap[u.id] || u.email.split("@")[0],
            up?.role || "patient",
            up?.institutionId ? institutionMap[up.institutionId] : "",
            u.approvalStatus || "", u.disabledAt ? "false" : "true", u.createdAt,
          ].map((v) => `"${String(v || "").replace(/"/g, '""')}"`).join(",");
        }),
      ];

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=users-export.csv");
      res.send(csvRows.join("\n"));
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ error: "Failed to export users" });
    }
  });

  app.get("/api/admin/users/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;

      const [user] = await db.select({ id: users.id, email: users.email, approvalStatus: users.approvalStatus, disabledAt: users.disabledAt, createdAt: users.createdAt })
        .from(users).where(eq(users.id, id)).limit(1);

      if (!user) return res.status(404).json({ error: "User not found" });

      const [userProfile] = await db.select({ role: userProfiles.role, institutionId: userProfiles.institutionId })
        .from(userProfiles).where(eq(userProfiles.userId, id)).limit(1);

      const role = userProfile?.role || "patient";
      const institutionId = userProfile?.institutionId || null;

      const [profile] = await db.select().from(clinicianProfiles).where(eq(clinicianProfiles.userId, id)).limit(1);

      let institution = null;
      if (institutionId) {
        const [inst] = await db.select().from(institutions).where(eq(institutions.id, institutionId)).limit(1);
        institution = inst;
      }

      let patientCount = 0;
      if (role === "clinician") {
        const [{ value }] = await db.select({ value: count() }).from(patients).where(eq(patients.assignedClinicianId, id));
        patientCount = Number(value);
      }

      res.json({ ...user, role, institution_id: institutionId, profile, institution, patientCount, isActive: !user.disabledAt });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.patch("/api/admin/users/:id/role", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { role, institutionId } = req.body;
      const adminId = req.user!.id;

      if (id === adminId) return res.status(400).json({ error: "Cannot change your own role" });

      const validRoles = ["patient", "clinician", "admin", "institution_admin"];
      if (!validRoles.includes(role)) return res.status(400).json({ error: "Invalid role" });

      const profileUpdate: any = { role };
      const userUpdate: any = {};

      if (role === "institution_admin" || role === "clinician") {
        if (!institutionId) return res.status(400).json({ error: "Institution is required for this role" });
        profileUpdate.institutionId = institutionId;
        if (role === "institution_admin") userUpdate.approvalStatus = "approved";
      }
      if (role === "patient" || role === "admin") {
        profileUpdate.institutionId = null;
        userUpdate.approvalStatus = null;
      }

      const [existing] = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.userId, id)).limit(1);

      let upData;
      if (existing) {
        const [updated] = await db.update(userProfiles).set({ ...profileUpdate, updatedAt: new Date() }).where(eq(userProfiles.userId, id)).returning();
        upData = updated;
      } else {
        const [inserted] = await db.insert(userProfiles).values({ userId: id, ...profileUpdate }).returning();
        upData = inserted;
      }

      if (Object.keys(userUpdate).length > 0) {
        await db.update(users).set(userUpdate).where(eq(users.id, id));
      }

      if (role === "institution_admin") {
        const [existingProfile] = await db.select({ userId: clinicianProfiles.userId }).from(clinicianProfiles).where(eq(clinicianProfiles.userId, id)).limit(1);
        if (!existingProfile) {
          const [userData] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
          const fullName = userData?.email?.split("@")[0] || "Admin";
          await db.insert(clinicianProfiles).values({ id: crypto.randomUUID(), userId: id, fullName });
        }
      }

      res.json({ message: "User role updated successfully", user: upData });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  app.patch("/api/admin/users/:id/status", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const adminId = req.user!.id;

      if (id === adminId) return res.status(400).json({ error: "Cannot disable your own account" });
      if (typeof isActive !== "boolean") return res.status(400).json({ error: "isActive must be a boolean" });

      const [updated] = await db.update(users).set({ disabledAt: isActive ? null : new Date() }).where(eq(users.id, id)).returning({ id: users.id });
      if (!updated) return res.status(404).json({ error: "User not found" });

      await logActivity(req.user!.id, isActive ? "enable" : "disable", "user", id, `${isActive ? "Enabled" : "Disabled"} user account`, req.ip);
      res.json({ message: `User ${isActive ? "enabled" : "disabled"} successfully` });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  app.post("/api/admin/users/bulk-update", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { userIds, action, role, institutionId } = req.body;
      const adminId = req.user!.id;

      if (!userIds || !Array.isArray(userIds) || !userIds.length) {
        return res.status(400).json({ error: "User IDs are required" });
      }

      const filteredIds = userIds.filter((id) => id !== adminId);

      if (action === "disable" || action === "enable") {
        await db.update(users).set({ disabledAt: action === "enable" ? null : new Date() }).where(inArray(users.id, filteredIds));
      } else if (action === "change_role" && role) {
        const profileUpdate: any = { role };
        const userUpdate: any = {};
        if (role === "institution_admin" || role === "clinician") {
          if (!institutionId) return res.status(400).json({ error: "Institution is required for this role" });
          profileUpdate.institutionId = institutionId;
          if (role === "institution_admin") userUpdate.approvalStatus = "approved";
        } else {
          profileUpdate.institutionId = null;
          userUpdate.approvalStatus = null;
        }
        for (const uid of filteredIds) {
          const [existing] = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.userId, uid)).limit(1);
          if (existing) {
            await db.update(userProfiles).set({ ...profileUpdate, updatedAt: new Date() }).where(eq(userProfiles.userId, uid));
          } else {
            await db.insert(userProfiles).values({ userId: uid, ...profileUpdate });
          }
        }
        if (Object.keys(userUpdate).length > 0) {
          await db.update(users).set(userUpdate).where(inArray(users.id, filteredIds));
        }
      }

      await logActivity(adminId, `bulk_${action}`, "user", null, `${action} applied to ${filteredIds.length} users`, req.ip);

      res.json({ message: "Bulk update completed successfully", count: filteredIds.length });
    } catch (error) {
      console.error("Error in bulk update:", error);
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  app.get("/api/admin/activity-logs", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const logs = await db.select().from(activityLogs)
        .orderBy(desc(activityLogs.createdAt))
        .limit(limitNum)
        .offset(offset);

      const [{ value: total }] = await db.select({ value: count() }).from(activityLogs);

      res.json({
        logs,
        pagination: { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum) },
      });
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/admin/institutions", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const institutionList = await db.select().from(institutions).orderBy(asc(institutions.name));
      res.json(institutionList);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  app.post("/api/admin/institutions", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { name, address, contactEmail, contactPhone } = req.body;
      if (!name) return res.status(400).json({ error: "Institution name is required" });

      const [data] = await db.insert(institutions).values({
        name, address: address || null, contactEmail: contactEmail || null, contactPhone: contactPhone || null, isDefault: false,
      }).returning();

      await logActivity(req.user!.id, "create", "institution", data.id, `Created institution: ${name}`, req.ip);
      res.json(data);
    } catch (error) {
      console.error("Error creating institution:", error);
      res.status(500).json({ error: "Failed to create institution" });
    }
  });

  app.patch("/api/admin/institutions/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, contactEmail, contactPhone, isDefault } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (address !== undefined) updateData.address = address;
      if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
      if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
      if (isDefault !== undefined) updateData.isDefault = isDefault;

      if (isDefault === true) {
        await db.update(institutions).set({ isDefault: false }).where(ne(institutions.id, id));
      }

      const [data] = await db.update(institutions).set(updateData).where(eq(institutions.id, id)).returning();
      if (!data) return res.status(404).json({ error: "Institution not found" });

      await logActivity(req.user!.id, "update", "institution", id, `Updated institution: ${data.name}`, req.ip);
      res.json(data);
    } catch (error) {
      console.error("Error updating institution:", error);
      res.status(500).json({ error: "Failed to update institution" });
    }
  });

  app.delete("/api/admin/institutions/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;

      const [profilesInInst] = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(eq(userProfiles.institutionId, id)).limit(1);
      if (profilesInInst) return res.status(400).json({ error: "Cannot delete institution with assigned users" });

      const [inst] = await db.select({ name: institutions.name }).from(institutions).where(eq(institutions.id, id)).limit(1);
      await db.delete(institutions).where(eq(institutions.id, id));

      await logActivity(req.user!.id, "delete", "institution", id, `Deleted institution: ${inst?.name || id}`, req.ip);
      res.json({ message: "Institution deleted successfully" });
    } catch (error) {
      console.error("Error deleting institution:", error);
      res.status(500).json({ error: "Failed to delete institution" });
    }
  });

  app.post("/api/admin/users/:id/email", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { subject, message } = req.body;
      if (!subject || !message) return res.status(400).json({ error: "Subject and message are required" });

      const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, id)).limit(1);
      if (!user) return res.status(404).json({ error: "User not found" });

      const sanitizedMessage = message
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/\n/g, "<br>");

      await sendEmail({
        to: user.email,
        subject,
        html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2 style="color: #333;">Message from VeriHealth Admin</h2><div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">${sanitizedMessage}</div><p style="color: #666; font-size: 12px; margin-top: 20px;">This message was sent from the VeriHealth administration team.</p></div>`,
      });

      await logActivity(req.user!.id, "email_sent", "user", id, `Sent email: ${subject}`, req.ip);
      res.json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/admin/invites", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { email, role, institutionId } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (existingUser) return res.status(400).json({ error: "User with this email already exists" });

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const [data] = await db.insert(userInvites).values({
        id: crypto.randomUUID(),
        email,
        role: role || "patient",
        institutionId: institutionId || null,
        invitedById: req.user!.id,
        token: null,
        tokenHash,
        status: "pending",
        expiresAt,
      }).returning();

      const inviteUrl = `${process.env.VITE_DASHBOARD_URL || "http://localhost:5000"}/register?invite=${token}`;
      try {
        await sendEmail({
          to: email,
          subject: "You've been invited to VeriHealth",
          html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h2>You're Invited to VeriHealth</h2><p>You've been invited to join VeriHealth as a <strong>${role || "patient"}</strong>.</p><a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#0066cc;color:white;text-decoration:none;border-radius:6px;margin:20px 0;">Accept Invitation</a><p style="color:#666;font-size:12px;">This invitation expires in 7 days.</p></div>`,
        });
      } catch (e) {
        console.error("Failed to send invite email:", e);
      }

      await logActivity(req.user!.id, "invite_sent", "invite", data.id, `Sent invite to ${email} as ${role || "patient"}`, req.ip);
      res.json({
        id: data.id,
        email: data.email,
        role: data.role,
        institutionId: data.institutionId,
        invitedById: data.invitedById,
        status: data.status,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
      });
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  app.get("/api/admin/invites", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const inviteList = await db.select({
        id: userInvites.id,
        email: userInvites.email,
        role: userInvites.role,
        institutionId: userInvites.institutionId,
        invitedById: userInvites.invitedById,
        status: userInvites.status,
        expiresAt: userInvites.expiresAt,
        createdAt: userInvites.createdAt,
      }).from(userInvites).orderBy(desc(userInvites.createdAt));
      res.json(inviteList);
    } catch (error) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  app.delete("/api/admin/invites/:id", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(userInvites).where(eq(userInvites.id, id));
      res.json({ message: "Invite cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invite:", error);
      res.status(500).json({ error: "Failed to cancel invite" });
    }
  });

  app.get("/api/admin/analytics", authenticateUser, requireRole("admin"), async (req, res) => {
    try {
      const userList = await db.select({ id: users.id, createdAt: users.createdAt }).from(users);
      const allUserProfiles = await db.select().from(userProfiles);
      const profileByUserId = allUserProfiles.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {} as Record<string, any>);

      const roleCounts: Record<string, number> = {};
      const usersByMonth: Record<string, number> = {};

      userList.forEach((u) => {
        const userRole = profileByUserId[u.id]?.role || "patient";
        roleCounts[userRole] = (roleCounts[userRole] || 0) + 1;
        if (u.createdAt) {
          const month = new Date(u.createdAt).toISOString().slice(0, 7);
          usersByMonth[month] = (usersByMonth[month] || 0) + 1;
        }
      });

      const [{ value: institutionCount }] = await db.select({ value: count() }).from(institutions);

      const recentActivity = await db.select({ action: activityLogs.action, createdAt: activityLogs.createdAt })
        .from(activityLogs).orderBy(desc(activityLogs.createdAt)).limit(100);

      const activityByDay: Record<string, number> = {};
      recentActivity.forEach((a) => {
        if (a.createdAt) {
          const day = new Date(a.createdAt).toISOString().slice(0, 10);
          activityByDay[day] = (activityByDay[day] || 0) + 1;
        }
      });

      res.json({
        totalUsers: userList.length,
        roleCounts,
        usersByMonth: Object.entries(usersByMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([month, c]) => ({ month, count: c })),
        institutionCount: Number(institutionCount),
        activityByDay: Object.entries(activityByDay).sort(([a], [b]) => a.localeCompare(b)).slice(-30).map(([date, c]) => ({ date, count: c })),
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============================================================
  // CLINICIANS
  // ============================================================

  app.get("/api/clinicians/top-performers", authenticateUser, requireRole("clinician", "admin", "institution_admin"), requireApproved, async (req, res) => {
    try {
      const userRole = req.user!.role;
      const userInstitutionId = resolveInstitutionScope(req.user!.institutionId);

      let profileConditions: any[] = [eq(userProfiles.role, "clinician")];
      if (userRole !== "admin") {
        if (!userInstitutionId) return res.status(403).json({ error: "Account is not linked to an institution" });
        profileConditions.push(eq(userProfiles.institutionId, userInstitutionId));
      }

      const tpProfiles = await db.select({ userId: userProfiles.userId }).from(userProfiles).where(and(...profileConditions));
      const tpUserIds = tpProfiles.map((p) => p.userId);
      if (!tpUserIds.length) return res.json([]);

      const approvedClinicianUsers = await db.select({ id: users.id, email: users.email })
        .from(users).where(and(inArray(users.id, tpUserIds), eq(users.approvalStatus, "approved")));

      if (!approvedClinicianUsers.length) return res.json([]);

      const clinicianIds = approvedClinicianUsers.map((c) => c.id);

      const profiles = await db.select({ userId: clinicianProfiles.userId, fullName: clinicianProfiles.fullName, specialty: clinicianProfiles.specialty })
        .from(clinicianProfiles).where(inArray(clinicianProfiles.userId, clinicianIds));
      const profilesByUserId = profiles.reduce((acc, p) => { acc[p.userId] = p; return acc; }, {} as Record<string, any>);

      const allAlertList = await db.select({ id: alerts.id, respondedById: alerts.respondedById, triggeredAt: alerts.triggeredAt, respondedAt: alerts.respondedAt, isResolved: alerts.isResolved, userId: alerts.userId })
        .from(alerts).limit(2000);

      const responseTimesByClinicianId: Record<string, number[]> = {};
      const totalAlertsByClinicianId: Record<string, number> = {};
      const resolvedAlertsByClinicianId: Record<string, number> = {};

      allAlertList.forEach((alert) => {
        if (alert.respondedById) {
          if (!totalAlertsByClinicianId[alert.respondedById]) totalAlertsByClinicianId[alert.respondedById] = 0;
          totalAlertsByClinicianId[alert.respondedById]++;
          if (alert.isResolved) {
            if (!resolvedAlertsByClinicianId[alert.respondedById]) resolvedAlertsByClinicianId[alert.respondedById] = 0;
            resolvedAlertsByClinicianId[alert.respondedById]++;
          }
          if (alert.respondedAt && alert.triggeredAt) {
            const responseTimeMs = new Date(alert.respondedAt).getTime() - new Date(alert.triggeredAt).getTime();
            if (responseTimeMs > 0) {
              if (!responseTimesByClinicianId[alert.respondedById]) responseTimesByClinicianId[alert.respondedById] = [];
              responseTimesByClinicianId[alert.respondedById].push(responseTimeMs);
            }
          }
        }
      });

      const avgResponseTimeByClinicianId: Record<string, number> = {};
      Object.entries(responseTimesByClinicianId).forEach(([cId, times]) => {
        avgResponseTimeByClinicianId[cId] = times.reduce((a, b) => a + b, 0) / times.length;
      });

      const clinicianPatientsList = await db.select({ assignedClinicianId: patients.assignedClinicianId, userId: patients.userId })
        .from(patients)
        .where(inArray(patients.assignedClinicianId, clinicianIds));

      const patientUserIdsByClinicianId: Record<string, string[]> = {};
      clinicianPatientsList.forEach((p) => {
        if (p.assignedClinicianId && p.userId) {
          if (!patientUserIdsByClinicianId[p.assignedClinicianId]) patientUserIdsByClinicianId[p.assignedClinicianId] = [];
          patientUserIdsByClinicianId[p.assignedClinicianId].push(p.userId);
        }
      });

      const allPatientUserIds = Object.values(patientUserIdsByClinicianId).flat();
      let allRiskScoresForOutcome: any[] = [];
      if (allPatientUserIds.length > 0) {
        allRiskScoresForOutcome = await db.select({ userId: riskScores.userId, level: riskScores.level, generatedAt: riskScores.generatedAt })
          .from(riskScores)
          .where(inArray(riskScores.userId, allPatientUserIds))
          .orderBy(asc(riskScores.generatedAt));
      }

      const riskScoresByUserId: Record<string, { earliest: string; latest: string }> = {};
      allRiskScoresForOutcome.forEach((rs) => {
        if (!rs.userId) return;
        if (!riskScoresByUserId[rs.userId]) {
          riskScoresByUserId[rs.userId] = { earliest: rs.level, latest: rs.level };
        } else {
          riskScoresByUserId[rs.userId].latest = rs.level;
        }
      });

      const riskLevelOrder: Record<string, number> = { low: 0, medium: 1, high: 2 };

      const topPerformers = approvedClinicianUsers.map((clinician) => {
        const profile = profilesByUserId[clinician.id];
        const avgResponseMs = avgResponseTimeByClinicianId[clinician.id];
        const alertsRespondedTo = responseTimesByClinicianId[clinician.id]?.length || 0;

        let avgResponseTime = "N/A";
        if (avgResponseMs) {
          const minutes = Math.floor(avgResponseMs / 60000);
          const hours = Math.floor(minutes / 60);
          avgResponseTime = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
        }

        const responseTotalForClinician = totalAlertsByClinicianId[clinician.id] || 0;
        const resolvedForClinician = resolvedAlertsByClinicianId[clinician.id] || 0;
        const alertResolutionRate = responseTotalForClinician > 0 ? resolvedForClinician / responseTotalForClinician : 0;

        let performanceScore = 0;
        if (avgResponseMs) performanceScore += Math.max(0, 40 - (avgResponseMs / 60000 / 5) * 8);
        performanceScore += alertResolutionRate * 60;

        const patientUserIds = patientUserIdsByClinicianId[clinician.id] || [];
        let improvedCount = 0;
        patientUserIds.forEach((uid) => {
          const rsData = riskScoresByUserId[uid];
          if (rsData && (riskLevelOrder[rsData.latest] ?? 0) < (riskLevelOrder[rsData.earliest] ?? 0)) {
            improvedCount++;
          }
        });
        const patientOutcomeRate = patientUserIds.length > 0 ? Math.round((improvedCount / patientUserIds.length) * 100) : 0;

        return {
          id: clinician.id,
          name: profile?.fullName || clinician.email.split("@")[0],
          specialty: profile?.specialty || "General",
          avgResponseTime,
          avgResponseTimeMs: avgResponseMs || null,
          alertsRespondedTo,
          patientOutcomeRate,
          performanceScore: Math.round(performanceScore),
        };
      });

      topPerformers.sort((a, b) => b.performanceScore - a.performanceScore);
      res.json(topPerformers.slice(0, 5));
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ error: "Failed to fetch top performers" });
    }
  });

  // ============================================================
  // PATIENT DASHBOARD (for patient role)
  // ============================================================

  app.get("/api/patient/my-dashboard", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (userRole !== "patient") return res.status(403).json({ error: "This endpoint is for patients only" });

      const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      let riskData: any = null;
      if (patient.userId) {
        const [rs] = await db.select().from(riskScores).where(eq(riskScores.userId, patient.userId)).orderBy(desc(riskScores.generatedAt)).limit(1);
        riskData = rs;
      }

      const rawVitals = await db.select().from(healthReadings)
        .where(and(
          eq(healthReadings.userId, userId as any),
          gte(healthReadings.recordedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        ))
        .orderBy(desc(healthReadings.recordedAt));

      const transformVital = (v: any) => ({ id: v.id, patientId: v.userId, type: toDisplayType(v.type), value: v.value, timestamp: v.recordedAt });
      const recentVitals = rawVitals.map(transformVital);
      const vitalsByType: Record<string, any> = {};
      recentVitals.forEach((v) => { if (!vitalsByType[v.type]) vitalsByType[v.type] = v; });

      let clinicianInfo = null;
      if (patient.assignedClinicianId) {
        const [clinician] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, patient.assignedClinicianId)).limit(1);
        if (clinician) {
          const [cp] = await db.select().from(clinicianProfiles).where(eq(clinicianProfiles.userId, clinician.id)).limit(1);
          clinicianInfo = { id: clinician.id, email: clinician.email, name: cp?.fullName || clinician.email.split("@")[0], specialty: cp?.specialty || "General Practice", phone: cp?.phone || null };
        }
      }

      let institutionInfo = null;
      if (patient.hospitalId) {
        const [institution] = await db.select().from(institutions).where(eq(institutions.id, patient.hospitalId)).limit(1);
        if (institution) institutionInfo = { id: institution.id, name: institution.name, address: institution.address, contactEmail: institution.contactEmail, contactPhone: institution.contactPhone };
      }

      const rawAlerts = await db.select().from(alerts)
        .where(eq(alerts.userId, userId))
        .orderBy(desc(alerts.triggeredAt))
        .limit(5);

      const recentAlerts = rawAlerts.map((a) => ({ id: a.id, type: a.alertType, message: a.message, severity: a.severity, isRead: a.isResolved, timestamp: a.triggeredAt }));

      res.json({
        patient: {
          id: patient.id,
          name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
          age: calcAge(patient.dateOfBirth),
          gender: patient.sex || "N/A",
          conditions: [],
          riskScore: riskData?.score || 0,
          riskLevel: riskData?.level || "low",
          lastSync: riskData?.generatedAt || patient.createdAt,
        },
        latestVitals: vitalsByType,
        recentVitals,
        clinician: clinicianInfo,
        institution: institutionInfo,
        recentAlerts,
      });
    } catch (error) {
      console.error("Error fetching patient dashboard:", error);
      res.status(500).json({ error: "Failed to fetch patient dashboard" });
    }
  });

  app.get("/api/patient/my-vitals", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const type = req.query.type as string | undefined;
      const days = parseInt(req.query.days as string) || 30;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      let whereClause: any = and(eq(healthReadings.userId, userId as any), gte(healthReadings.recordedAt, since));
      if (type) whereClause = and(whereClause, eq(healthReadings.type, toHealthType(type)));

      const vitals = await db.select().from(healthReadings).where(whereClause).orderBy(desc(healthReadings.recordedAt));

      const transformed = vitals.map((v) => ({
        id: v.id, patientId: v.userId, type: toDisplayType(v.type), value: v.value, timestamp: v.recordedAt, createdAt: v.createdAt,
      }));

      res.json(transformed);
    } catch (error: any) {
      console.error("Error fetching patient vitals:", error);
      res.status(500).json({ error: "Failed to fetch vitals" });
    }
  });

  app.post("/api/vitals/ingest", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;

      const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      const { readings } = req.body;
      if (!readings || !Array.isArray(readings) || !readings.length) {
        return res.status(400).json({ error: "readings array is required and must not be empty" });
      }
      if (readings.length > 100) return res.status(400).json({ error: "Maximum 100 readings per request" });

      const validTypes = [
        "Heart Rate", "Blood Pressure Systolic", "Blood Pressure Diastolic",
        "SpO2", "Temperature", "Weight", "Steps", "Sleep", "HRV",
        "Respiratory Rate", "Blood Glucose", "BMI",
      ];

      const rows: any[] = [];
      const errors: string[] = [];

      for (let i = 0; i < readings.length; i++) {
        const r = readings[i];
        if (!r.type || typeof r.type !== "string") { errors.push(`Reading ${i}: type is required`); continue; }
        if (!validTypes.includes(r.type)) { errors.push(`Reading ${i}: invalid type "${r.type}"`); continue; }
        const value = Number(r.value);
        if (isNaN(value) || value < 0) { errors.push(`Reading ${i}: value must be a non-negative number`); continue; }
        rows.push({
          id: crypto.randomUUID(),
          userId,
          type: toHealthType(r.type),
          value: String(value),
          unit: r.unit || "",
          source: r.source || "manual",
          recordedAt: r.recorded_at ? new Date(r.recorded_at) : new Date(),
        });
      }

      if (!rows.length) return res.status(400).json({ error: "No valid readings to insert", details: errors });

      const inserted = await db.insert(healthReadings).values(rows).returning({ id: healthReadings.id, type: healthReadings.type, value: healthReadings.value, recordedAt: healthReadings.recordedAt, source: healthReadings.source });

      res.json({ message: `${inserted.length} reading(s) ingested successfully`, inserted: inserted.length, rejected: errors.length, details: errors.length > 0 ? errors : undefined, readings: inserted });
    } catch (error: any) {
      console.error("Error ingesting vitals:", error);
      res.status(500).json({ error: "Failed to ingest vital readings" });
    }
  });

  app.get("/api/patient/my-alerts", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;

      const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      const alertList = await db.select().from(alerts).where(eq(alerts.userId, userId)).orderBy(desc(alerts.triggeredAt)).limit(50);

      const transformed = alertList.map((a) => ({ id: a.id, patientId: a.userId, type: a.alertType, message: a.message, severity: a.severity, isRead: a.isResolved, timestamp: a.triggeredAt }));
      res.json(transformed);
    } catch (error: any) {
      console.error("Error fetching patient alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/patient/my-profile", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;

      const [patient] = await db.select().from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      let riskData: any = null;
      if (patient.userId) {
        const [rs] = await db.select().from(riskScores).where(eq(riskScores.userId, patient.userId)).orderBy(desc(riskScores.generatedAt)).limit(1);
        riskData = rs;
      }

      let clinicianInfo = null;
      if (patient.assignedClinicianId) {
        const [clinician] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, patient.assignedClinicianId)).limit(1);
        if (clinician) {
          const [cp] = await db.select().from(clinicianProfiles).where(eq(clinicianProfiles.userId, clinician.id)).limit(1);
          clinicianInfo = { id: clinician.id, email: clinician.email, name: cp?.fullName || clinician.email.split("@")[0], specialty: cp?.specialty || "General Practice", phone: cp?.phone || null };
        }
      }

      let institutionInfo = null;
      if (patient.hospitalId) {
        const [institution] = await db.select().from(institutions).where(eq(institutions.id, patient.hospitalId)).limit(1);
        if (institution) institutionInfo = { id: institution.id, name: institution.name, address: institution.address, contactEmail: institution.contactEmail, contactPhone: institution.contactPhone };
      }

      res.json({
        patient: {
          id: patient.id, userId: patient.userId,
          name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
          age: calcAge(patient.dateOfBirth), gender: patient.sex || "N/A", conditions: [],
          riskScore: riskData?.score || 0, riskLevel: riskData?.level || "low", lastSync: riskData?.generatedAt || patient.createdAt,
        },
        clinician: clinicianInfo,
        institution: institutionInfo,
      });
    } catch (error: any) {
      console.error("Error fetching patient profile:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.patch("/api/patient/my-profile", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, firstName, lastName, gender, sex, dateOfBirth, phone, address, emergencyContactName, emergencyContactPhone, bloodType, heightCm, weightKg } = req.body;

      const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      const updates: any = {};
      if (name !== undefined) {
        const parts = name.trim().split(" ");
        updates.firstName = parts[0] || "";
        updates.lastName = parts.slice(1).join(" ") || "";
      }
      if (firstName !== undefined) updates.firstName = firstName.trim();
      if (lastName !== undefined) updates.lastName = lastName.trim();
      if (dateOfBirth !== undefined) updates.dateOfBirth = dateOfBirth;
      if (sex !== undefined) updates.sex = sex.trim().toLowerCase();
      else if (gender !== undefined) updates.sex = gender.trim().toLowerCase();
      if (phone !== undefined) updates.phone = phone;
      if (address !== undefined) updates.address = address;
      if (emergencyContactName !== undefined) updates.emergencyContactName = emergencyContactName;
      if (emergencyContactPhone !== undefined) updates.emergencyContactPhone = emergencyContactPhone;
      if (bloodType !== undefined) updates.bloodType = bloodType;
      if (heightCm !== undefined) updates.heightCm = heightCm;
      if (weightKg !== undefined) updates.weightKg = weightKg;

      if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid fields to update" });

      const [updated] = await db.update(patients).set(updates).where(eq(patients.id, patient.id)).returning();

      res.json({
        patient: {
          id: updated.id, userId: updated.userId,
          name: `${updated.firstName || ""} ${updated.lastName || ""}`.trim() || "Unknown",
          age: calcAge(updated.dateOfBirth), gender: updated.sex || "N/A",
        },
        message: "Profile updated successfully",
      });
    } catch (error: any) {
      console.error("Error updating patient profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // ============================================================
  // FILE ATTACHMENTS
  // ============================================================

  app.post("/api/patient/files", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { patientId, fileName, fileType, fileSize, category, description, fileData } = req.body;
      const maxFileBytes = 10 * 1024 * 1024;

      if (!patientId || !fileName || !fileType || !fileSize || !fileData) {
        return res.status(400).json({ error: "patientId, fileName, fileType, fileSize, and fileData are required" });
      }
      if (typeof fileData !== "string") return res.status(400).json({ error: "fileData must be a base64 string" });

      const decodedBytes = getBase64DecodedSize(fileData);
      if (decodedBytes === null) return res.status(400).json({ error: "Invalid base64 file data" });
      if (decodedBytes > maxFileBytes) return res.status(413).json({ error: "File payload exceeds 10MB limit" });

      const parsedFileSize = Number(fileSize);
      if (!Number.isFinite(parsedFileSize) || parsedFileSize <= 0) return res.status(400).json({ error: "fileSize must be a positive number" });

      const validCategories = ["lab_result", "prescription", "referral", "imaging", "general"];
      const fileCategory = category || "general";
      if (!validCategories.includes(fileCategory)) return res.status(400).json({ error: `Category must be one of: ${validCategories.join(", ")}` });

      const [targetPatient] = await db.select({ id: patients.id, userId: patients.userId }).from(patients).where(eq(patients.id, patientId)).limit(1);
      if (!targetPatient) return res.status(404).json({ error: "Patient not found" });

      if (targetPatient.userId !== userId) {
        const [sponsorAccess] = await db.select().from(sponsorDependents)
          .where(and(eq(sponsorDependents.sponsorUserId, userId), eq(sponsorDependents.dependentPatientId, patientId), eq(sponsorDependents.status, "approved")))
          .limit(1);
        if (!sponsorAccess) return res.status(403).json({ error: "You do not have access to upload files for this patient" });
      }

      const [file] = await db.insert(fileAttachments).values({
        id: crypto.randomUUID(),
        patientId,
        uploadedByUserId: userId,
        fileName,
        fileType,
        fileSize: decodedBytes,
        category: fileCategory,
        description: description || null,
        fileData,
      }).returning();

      res.status(201).json({ id: file.id, patientId: file.patientId, uploadedByUserId: file.uploadedByUserId, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize, category: file.category, description: file.description, createdAt: file.createdAt });
    } catch (error: any) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  app.get("/api/patient/files", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const queryPatientId = req.query.patientId as string | undefined;

      let targetPatientId: string;

      if (queryPatientId) {
        const [sponsorAccess] = await db.select().from(sponsorDependents)
          .where(and(eq(sponsorDependents.sponsorUserId, userId), eq(sponsorDependents.dependentPatientId, queryPatientId), eq(sponsorDependents.status, "approved")))
          .limit(1);

        if (!sponsorAccess) {
          const [targetPatient] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, queryPatientId)).limit(1);
          if (!targetPatient || targetPatient.userId !== userId) return res.status(403).json({ error: "You do not have access to this patient's files" });
        }
        targetPatientId = queryPatientId;
      } else {
        const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
        if (!patient) return res.status(404).json({ error: "Patient profile not found" });
        targetPatientId = patient.id;
      }

      const files = await db.select({ id: fileAttachments.id, patientId: fileAttachments.patientId, uploadedByUserId: fileAttachments.uploadedByUserId, fileName: fileAttachments.fileName, fileType: fileAttachments.fileType, fileSize: fileAttachments.fileSize, category: fileAttachments.category, description: fileAttachments.description, createdAt: fileAttachments.createdAt })
        .from(fileAttachments).where(eq(fileAttachments.patientId, targetPatientId)).orderBy(desc(fileAttachments.createdAt));

      const transformed = files.map((f) => ({ id: f.id, patientId: f.patientId, uploadedByUserId: f.uploadedByUserId, fileName: f.fileName, fileType: f.fileType, fileSize: f.fileSize, category: f.category, description: f.description, createdAt: f.createdAt }));
      res.json(transformed);
    } catch (error: any) {
      console.error("Error fetching files:", error);
      res.status(500).json({ error: "Failed to fetch files" });
    }
  });

  app.get("/api/patient/files/:id", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const fileId = req.params.id;

      const [file] = await db.select().from(fileAttachments).where(eq(fileAttachments.id, fileId)).limit(1);
      if (!file) return res.status(404).json({ error: "File not found" });

      const [filePatient] = await db.select({ userId: patients.userId }).from(patients).where(eq(patients.id, file.patientId!)).limit(1);

      if (!filePatient || filePatient.userId !== userId) {
        const [sponsorAccess] = await db.select().from(sponsorDependents)
          .where(and(eq(sponsorDependents.sponsorUserId, userId), eq(sponsorDependents.dependentPatientId, file.patientId!), eq(sponsorDependents.status, "approved")))
          .limit(1);
        if (!sponsorAccess) return res.status(403).json({ error: "You do not have access to this file" });
      }

      res.json({ id: file.id, patientId: file.patientId, uploadedByUserId: file.uploadedByUserId, fileName: file.fileName, fileType: file.fileType, fileSize: file.fileSize, category: file.category, description: file.description, fileData: file.fileData, createdAt: file.createdAt });
    } catch (error: any) {
      console.error("Error fetching file:", error);
      res.status(500).json({ error: "Failed to fetch file" });
    }
  });

  app.delete("/api/patient/files/:id", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const fileId = req.params.id;

      const [file] = await db.select({ id: fileAttachments.id, uploadedByUserId: fileAttachments.uploadedByUserId }).from(fileAttachments).where(eq(fileAttachments.id, fileId)).limit(1);
      if (!file) return res.status(404).json({ error: "File not found" });
      if (file.uploadedByUserId !== userId) return res.status(403).json({ error: "Only the uploader can delete this file" });

      await db.delete(fileAttachments).where(eq(fileAttachments.id, fileId));
      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ============================================================
  // SPONSOR / DEPENDENTS
  // ============================================================

  app.get("/api/patient/dependents", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const dependents = await db.select().from(sponsorDependents).where(eq(sponsorDependents.sponsorUserId, userId));

      const enriched = await Promise.all(
        dependents.map(async (dep) => {
          const [patient] = await db.select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, sex: patients.sex, dateOfBirth: patients.dateOfBirth })
            .from(patients).where(eq(patients.id, dep.dependentPatientId!)).limit(1);

          return {
            id: dep.id, sponsorUserId: dep.sponsorUserId, dependentPatientId: dep.dependentPatientId,
            status: dep.status, relationship: dep.relationship, createdAt: dep.createdAt, approvedAt: dep.approvedAt,
            patient: patient ? {
              id: patient.id,
              name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
              age: calcAge(patient.dateOfBirth), gender: patient.sex || "N/A",
            } : null,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching dependents:", error);
      res.status(500).json({ error: "Failed to fetch dependents" });
    }
  });

  app.post("/api/patient/dependents/request", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const { dependentEmail, relationship } = req.body;
      if (!dependentEmail) return res.status(400).json({ error: "dependentEmail is required" });

      const [dependentUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, dependentEmail.toLowerCase())).limit(1);
      if (!dependentUser) return res.status(404).json({ error: "No user found with that email address" });

      const [dependentPatient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, dependentUser.id)).limit(1);
      if (!dependentPatient) return res.status(404).json({ error: "No patient profile found for that email address" });

      const [existing] = await db.select({ id: sponsorDependents.id, status: sponsorDependents.status })
        .from(sponsorDependents)
        .where(and(eq(sponsorDependents.sponsorUserId, userId), eq(sponsorDependents.dependentPatientId, dependentPatient.id)))
        .limit(1);
      if (existing) return res.status(400).json({ error: `A sponsor request already exists with status: ${existing.status}` });

      const [record] = await db.insert(sponsorDependents).values({
        id: crypto.randomUUID(),
        sponsorUserId: userId,
        dependentPatientId: dependentPatient.id,
        status: "pending",
        relationship: relationship || null,
      }).returning();

      res.status(201).json({ id: record.id, sponsorUserId: record.sponsorUserId, dependentPatientId: record.dependentPatientId, status: record.status, relationship: record.relationship, createdAt: record.createdAt });
    } catch (error: any) {
      console.error("Error creating sponsor request:", error);
      res.status(500).json({ error: "Failed to create sponsor request" });
    }
  });

  app.get("/api/patient/sponsor-requests", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;

      const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      const requestList = await db.select().from(sponsorDependents)
        .where(and(eq(sponsorDependents.dependentPatientId, patient.id), eq(sponsorDependents.status, "pending")));

      const enriched = await Promise.all(
        requestList.map(async (req_item) => {
          const [sponsorUser] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, req_item.sponsorUserId!)).limit(1);
          return {
            id: req_item.id, sponsorUserId: req_item.sponsorUserId, dependentPatientId: req_item.dependentPatientId,
            status: req_item.status, relationship: req_item.relationship, createdAt: req_item.createdAt,
            sponsor: sponsorUser ? { id: sponsorUser.id, email: sponsorUser.email } : null,
          };
        })
      );

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching sponsor requests:", error);
      res.status(500).json({ error: "Failed to fetch sponsor requests" });
    }
  });

  app.patch("/api/patient/sponsor-requests/:id", authenticateUser, requireRole("patient"), async (req, res) => {
    try {
      const userId = req.user!.id;
      const requestId = req.params.id;
      const { action } = req.body;

      if (!action || !["approve", "reject"].includes(action)) return res.status(400).json({ error: "action must be 'approve' or 'reject'" });

      const [patient] = await db.select({ id: patients.id }).from(patients).where(eq(patients.userId, userId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient profile not found" });

      const [request] = await db.select().from(sponsorDependents).where(eq(sponsorDependents.id, requestId)).limit(1);
      if (!request) return res.status(404).json({ error: "Sponsor request not found" });
      if (request.dependentPatientId !== patient.id) return res.status(403).json({ error: "Only the dependent patient can approve or reject this request" });
      if (request.status !== "pending") return res.status(400).json({ error: `This request has already been ${request.status}` });

      const updates: any = { status: action === "approve" ? "approved" : "rejected" };
      if (action === "approve") updates.approvedAt = new Date();

      const [updated] = await db.update(sponsorDependents).set(updates).where(eq(sponsorDependents.id, requestId)).returning();

      res.json({ id: updated.id, sponsorUserId: updated.sponsorUserId, dependentPatientId: updated.dependentPatientId, status: updated.status, relationship: updated.relationship, createdAt: updated.createdAt, approvedAt: updated.approvedAt, message: `Sponsor request ${action === "approve" ? "approved" : "rejected"} successfully` });
    } catch (error: any) {
      console.error("Error updating sponsor request:", error);
      res.status(500).json({ error: "Failed to update sponsor request" });
    }
  });

  app.get("/api/patient/dependent/:patientId/dashboard", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const dependentPatientId = req.params.patientId;

      const [sponsorAccess] = await db.select().from(sponsorDependents)
        .where(and(eq(sponsorDependents.sponsorUserId, userId), eq(sponsorDependents.dependentPatientId, dependentPatientId), eq(sponsorDependents.status, "approved")))
        .limit(1);
      if (!sponsorAccess) return res.status(403).json({ error: "You do not have approved access to this dependent's dashboard" });

      const [patient] = await db.select().from(patients).where(eq(patients.id, dependentPatientId)).limit(1);
      if (!patient) return res.status(404).json({ error: "Patient not found" });

      let riskData: any = null;
      if (patient.userId) {
        const [rs] = await db.select().from(riskScores).where(eq(riskScores.userId, patient.userId)).orderBy(desc(riskScores.generatedAt)).limit(1);
        riskData = rs;
      }

      const depPatientUserId = patient.userId!;
      const rawVitals = await db.select().from(healthReadings)
        .where(and(eq(healthReadings.userId, depPatientUserId as any), gte(healthReadings.recordedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))))
        .orderBy(desc(healthReadings.recordedAt));

      const transformVital = (v: any) => ({ id: v.id, patientId: v.userId, type: toDisplayType(v.type), value: v.value, timestamp: v.recordedAt });
      const recentVitals = rawVitals.map(transformVital);
      const vitalsByType: Record<string, any> = {};
      recentVitals.forEach((v) => { if (!vitalsByType[v.type]) vitalsByType[v.type] = v; });

      let clinicianInfo = null;
      if (patient.assignedClinicianId) {
        const [clinician] = await db.select({ id: users.id, email: users.email }).from(users).where(eq(users.id, patient.assignedClinicianId)).limit(1);
        if (clinician) {
          const [cp] = await db.select().from(clinicianProfiles).where(eq(clinicianProfiles.userId, clinician.id)).limit(1);
          clinicianInfo = { id: clinician.id, email: clinician.email, name: cp?.fullName || clinician.email.split("@")[0], specialty: cp?.specialty || "General Practice", phone: cp?.phone || null };
        }
      }

      let institutionInfo = null;
      if (patient.hospitalId) {
        const [institution] = await db.select().from(institutions).where(eq(institutions.id, patient.hospitalId)).limit(1);
        if (institution) institutionInfo = { id: institution.id, name: institution.name, address: institution.address, contactEmail: institution.contactEmail, contactPhone: institution.contactPhone };
      }

      const rawAlerts = await db.select().from(alerts)
        .where(eq(alerts.userId, depPatientUserId))
        .orderBy(desc(alerts.triggeredAt))
        .limit(5);

      const recentAlerts = rawAlerts.map((a) => ({ id: a.id, type: a.alertType, message: a.message, severity: a.severity, isRead: a.isResolved, timestamp: a.triggeredAt }));

      res.json({
        patient: {
          id: patient.id,
          name: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
          age: calcAge(patient.dateOfBirth), gender: patient.sex || "N/A", conditions: [],
          riskScore: riskData?.score || 0, riskLevel: riskData?.level || "low", lastSync: riskData?.generatedAt || patient.createdAt,
        },
        latestVitals: vitalsByType, recentVitals, clinician: clinicianInfo, institution: institutionInfo, recentAlerts,
      });
    } catch (error: any) {
      console.error("Error fetching dependent dashboard:", error);
      res.status(500).json({ error: "Failed to fetch dependent dashboard" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { Express } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { supabase } from "./supabase";
import { authenticateUser, requireRole, requireApproved } from "./middleware/auth";
import { sendEmail, generateConfirmationEmail, generatePasswordResetEmail } from "./email";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(windowMs: number, maxRequests: number) {
  return (req: any, res: any, next: any) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
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
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 60000);

export async function registerRoutes(app: Express): Promise<Server> {
  
  const authRateLimit = rateLimit(15 * 60 * 1000, 10);

  // Auth endpoints (no authentication required)
  app.post("/api/auth/login", authRateLimit, async (req, res) => {
    try {
      const { email, password } = req.body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Check if email is confirmed
      if (!data.user.email_confirmed_at) {
        // Sign out the user immediately
        if (data.session) {
          await supabase.auth.admin.signOut(data.session.access_token);
        }
        
        return res.status(403).json({ 
          error: "Please confirm your email before logging in. Check your inbox for the confirmation link.",
          requiresConfirmation: true,
          email: data.user.email,
        });
      }

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('user_id', data.user.id)
        .single();

      const { data: userData } = await supabase
        .from('users')
        .select('approval_status')
        .eq('id', data.user.id)
        .single();

      if (profileData?.role === 'patient') {
        if (data.session) {
          await supabase.auth.admin.signOut(data.session.access_token);
        }
        return res.status(403).json({
          error: "This portal is for clinicians and administrators only. Please use the VeriHealth app at app.verihealths.com to access your health dashboard.",
          isPatient: true,
        });
      }

      if (profileData?.role === 'clinician' && userData?.approval_status !== 'approved') {
        // Sign out the user
        if (data.session) {
          await supabase.auth.admin.signOut(data.session.access_token);
        }

        const statusMessage = userData?.approval_status === 'rejected' 
          ? "Your clinician registration was rejected. Please contact your institution administrator."
          : "Your clinician account is pending approval by your institution administrator.";

        return res.status(403).json({ 
          error: statusMessage,
          approvalStatus: userData?.approval_status,
        });
      }

      res.json({
        user: data.user,
        session: data.session,
      });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(401).json({ error: error.message || "Invalid credentials" });
    }
  });

  app.post("/api/auth/register", authRateLimit, async (req, res) => {
    try {
      const { email, password, fullName, age, gender, institutionCode, inviteToken } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      let role: string = 'patient';
      let targetInstitutionId: string | null = null;
      let inviteId: string | null = null;

      if (inviteToken) {
        const { data: invite, error: inviteError } = await supabase
          .from('user_invites')
          .select('*')
          .eq('token', inviteToken)
          .eq('status', 'pending')
          .single();

        if (inviteError || !invite) {
          return res.status(400).json({ error: "Invalid or already used invitation link." });
        }

        if (new Date(invite.expires_at) < new Date()) {
          await supabase.from('user_invites').update({ status: 'expired' }).eq('id', invite.id);
          return res.status(400).json({ error: "This invitation has expired. Please request a new one." });
        }

        if (invite.email.toLowerCase() !== email.toLowerCase()) {
          return res.status(400).json({ error: "This invitation was sent to a different email address." });
        }

        role = invite.role || 'patient';
        targetInstitutionId = invite.institution_id;
        inviteId = invite.id;
      } else {
        if (institutionCode) {
          const { data: inst } = await supabase
            .from('institutions')
            .select('id, name')
            .eq('id', institutionCode)
            .single();

          if (!inst) {
            return res.status(400).json({ error: "Invalid institution code. Please check and try again." });
          }
          targetInstitutionId = inst.id;
        } else {
          const { data: defaultInst } = await supabase
            .from('institutions')
            .select('id')
            .eq('is_default', true)
            .single();

          if (defaultInst) {
            targetInstitutionId = defaultInst.id;
          }
        }
      }

      const emailConfirmationEnabled = process.env.ENABLE_EMAIL_CONFIRMATION === 'true';

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      const approvalStatus = (role === 'institution_admin') ? 'approved' : (role === 'clinician' ? 'pending' : null);

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          approval_status: approvalStatus,
        });

      if (userError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      const { error: profileInsertError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          role: role,
          institution_id: targetInstitutionId,
        }, { onConflict: 'user_id' });

      if (profileInsertError) {
        await supabase.from('users').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileInsertError;
      }

      if (role === 'patient' && fullName && age !== undefined && age !== null && age !== '' && gender) {
        const parsedAge = parseInt(String(age), 10);
        if (!isNaN(parsedAge) && parsedAge >= 0) {
          const { error: patientError } = await supabase
            .from('patients')
            .insert({
              user_id: authData.user.id,
              name: fullName,
              age: parsedAge,
              gender,
              institution_id: targetInstitutionId,
              assigned_clinician_id: null,
              status: 'Active',
            });

          if (patientError) {
            await supabase.from('user_profiles').delete().eq('user_id', authData.user.id);
            await supabase.from('users').delete().eq('id', authData.user.id);
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw patientError;
          }
        }
      }

      if (inviteId) {
        await supabase.from('user_invites').update({ status: 'used' }).eq('id', inviteId);
      }

      if (emailConfirmationEnabled && !authData.session) {
        const redirectTo = `${process.env.VITE_DASHBOARD_URL || 'http://localhost:5000'}/confirm-email`;
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'signup',
          email,
          password,
          options: {
            redirectTo,
          },
        });

        if (linkError) {
          console.error("Error generating confirmation link:", linkError);
        } else {
          try {
            const confirmationEmail = generateConfirmationEmail(email, linkData.properties.action_link);
            await sendEmail(confirmationEmail);
          } catch (emailError: any) {
            console.error("Error sending confirmation email:", emailError);
          }
        }

        return res.json({
          message: "Registration successful. Please check your email to confirm your account.",
          requiresConfirmation: true,
        });
      }

      res.json({
        user: authData.user,
        session: authData.session,
        message: "Registration successful"
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(400).json({ error: error.message || "Registration failed" });
    }
  });

  app.get("/api/auth/verify-invite", authRateLimit, async (req, res) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Token is required" });
      }

      const { data: invite, error } = await supabase
        .from('user_invites')
        .select('email, role, status, expires_at')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !invite) {
        return res.status(404).json({ error: "Invalid or expired invitation" });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return res.status(400).json({ error: "This invitation has expired" });
      }

      res.json({ email: invite.email, role: invite.role });
    } catch (error) {
      console.error("Verify invite error:", error);
      res.status(500).json({ error: "Failed to verify invitation" });
    }
  });

  app.post("/api/patient/complete-profile", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      if (userRole !== 'patient') {
        return res.status(403).json({ error: "Only patients can complete this profile" });
      }

      const { fullName, age, gender, institutionCode } = req.body;

      if (!fullName || age === undefined || age === null || age === '' || !gender) {
        return res.status(400).json({ error: "Full name, age, and gender are required" });
      }

      const parsedAge = parseInt(String(age), 10);
      if (isNaN(parsedAge) || parsedAge < 0 || parsedAge > 150) {
        return res.status(400).json({ error: "Please provide a valid age" });
      }

      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (existingPatient) {
        return res.status(400).json({ error: "Patient profile already exists" });
      }

      let targetInstitutionId: string | null = null;

      if (institutionCode) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('id')
          .eq('id', institutionCode)
          .single();

        if (!inst) {
          return res.status(400).json({ error: "Invalid institution code" });
        }
        targetInstitutionId = inst.id;
      } else {
        const { data: defaultInst } = await supabase
          .from('institutions')
          .select('id')
          .eq('is_default', true)
          .single();

        if (defaultInst) {
          targetInstitutionId = defaultInst.id;
        }
      }

      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          user_id: userId,
          name: fullName,
          age: parsedAge,
          gender,
          institution_id: targetInstitutionId,
          assigned_clinician_id: null,
          status: 'Active',
        })
        .select()
        .single();

      if (patientError) throw patientError;

      if (targetInstitutionId) {
        await supabase
          .from('user_profiles')
          .update({ institution_id: targetInstitutionId })
          .eq('user_id', userId);
      }

      res.json({ patient, message: "Profile completed successfully" });
    } catch (error: any) {
      console.error("Complete profile error:", error);
      res.status(400).json({ error: error.message || "Failed to complete profile" });
    }
  });

  app.get("/api/patients/unassigned", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      let query = supabase
        .from('patients')
        .select('id, user_id, name, age, gender, status, institution_id, created_at')
        .is('assigned_clinician_id', null)
        .eq('status', 'Active')
        .order('created_at', { ascending: true });

      if (userRole === 'clinician' || userRole === 'institution_admin') {
        if (userInstitutionId) {
          query = query.eq('institution_id', userInstitutionId);
        } else {
          return res.json([]);
        }
      }

      const { data: patients, error } = await query;

      if (error) throw error;

      const patientsWithInstitution = await Promise.all(
        (patients || []).map(async (patient: any) => {
          let institutionName = null;
          if (patient.institution_id) {
            const { data: inst } = await supabase
              .from('institutions')
              .select('name')
              .eq('id', patient.institution_id)
              .single();
            institutionName = inst?.name || null;
          }
          return { ...patient, institutionName };
        })
      );

      res.json(patientsWithInstitution);
    } catch (error: any) {
      console.error("Error fetching unassigned patients:", error);
      res.status(500).json({ error: "Failed to fetch unassigned patients" });
    }
  });

  app.post("/api/patients/:id/claim", authenticateUser, requireRole('clinician'), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const clinicianId = req.user!.id;
      const clinicianInstitutionId = req.user!.institutionId;

      const { data: patient, error: fetchError } = await supabase
        .from('patients')
        .select('id, assigned_clinician_id, institution_id, name')
        .eq('id', id)
        .single();

      if (fetchError || !patient) {
        return res.status(404).json({ error: "Patient not found" });
      }

      if (patient.assigned_clinician_id) {
        return res.status(400).json({ error: "This patient is already assigned to a clinician" });
      }

      if (clinicianInstitutionId && patient.institution_id && patient.institution_id !== clinicianInstitutionId) {
        return res.status(403).json({ error: "You can only claim patients within your institution" });
      }

      const { data: updatedRows, error: updateError } = await supabase
        .from('patients')
        .update({ assigned_clinician_id: clinicianId })
        .eq('id', id)
        .is('assigned_clinician_id', null)
        .select('id');

      if (updateError) throw updateError;

      if (!updatedRows || updatedRows.length === 0) {
        return res.status(400).json({ error: "This patient was just claimed by another clinician" });
      }

      res.json({ message: `Patient ${patient.name} has been assigned to you`, patientId: id });
    } catch (error: any) {
      console.error("Error claiming patient:", error);
      res.status(500).json({ error: "Failed to claim patient" });
    }
  });

  // Clinician registration endpoint
  app.post("/api/auth/register-clinician", authRateLimit, async (req, res) => {
    try {
      const { email, password, fullName, licenseNumber, specialty, phone, institutionId } = req.body;

      // Validate inputs
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: "Email, password, and full name are required" });
      }

      // Get default institution if no institution selected
      let selectedInstitutionId = institutionId;
      if (!selectedInstitutionId) {
        const { data: defaultInstitution } = await supabase
          .from('institutions')
          .select('id')
          .eq('is_default', true)
          .single();

        if (!defaultInstitution) {
          return res.status(400).json({ error: "No institution available. Please contact support." });
        }
        selectedInstitutionId = defaultInstitution.id;
      }

      // Check if email confirmation is enabled in environment
      const emailConfirmationEnabled = process.env.ENABLE_EMAIL_CONFIRMATION === 'true';

      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        return res.status(500).json({ error: "Failed to create user" });
      }

      const { error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: authData.user.email!,
          approval_status: 'pending',
        });

      if (userError) {
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw userError;
      }

      const { error: upError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authData.user.id,
          role: 'clinician',
          institution_id: selectedInstitutionId,
        }, { onConflict: 'user_id' });

      if (upError) {
        await supabase.from('users').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw upError;
      }

      const { error: profileError } = await supabase
        .from('clinician_profiles')
        .insert({
          user_id: authData.user.id,
          full_name: fullName,
          license_number: licenseNumber || null,
          specialty: specialty || null,
          phone: phone || null,
        });

      if (profileError) {
        await supabase.from('user_profiles').delete().eq('user_id', authData.user.id);
        await supabase.from('users').delete().eq('id', authData.user.id);
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      // If email confirmation is enabled
      if (emailConfirmationEnabled && !authData.session) {
        const redirectTo = `${process.env.VITE_DASHBOARD_URL || 'http://localhost:5000'}/confirm-email`;
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'signup',
          email,
          password,
          options: {
            redirectTo,
          },
        });

        if (!linkError && linkData) {
          try {
            const confirmationEmail = generateConfirmationEmail(email, linkData.properties.action_link);
            await sendEmail(confirmationEmail);
          } catch (emailError: any) {
            console.error("Error sending confirmation email:", emailError);
          }
        }

        return res.json({
          message: "Registration successful. Your account is pending approval. Please check your email to confirm your account.",
          requiresConfirmation: true,
          requiresApproval: true,
        });
      }

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
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.substring(7);

      if (token) {
        await supabase.auth.admin.signOut(token);
      }

      res.json({ message: "Logged out successfully" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  app.post("/api/auth/resend-confirmation", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { data: userRecord } = await supabase.from('users').select('id').eq('email', email).single();
      if (!userRecord) {
        return res.json({ message: "If an account exists with this email, a confirmation link has been sent." });
      }
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userRecord.id);
      const user = authUser;

      if (!user) {
        return res.json({ message: "If an account exists with this email, a confirmation link has been sent." });
      }

      if (user.email_confirmed_at) {
        return res.status(400).json({ error: "Email is already confirmed. You can log in." });
      }

      // Generate new confirmation link (use magiclink instead of signup for resend)
      const redirectTo = `${process.env.VITE_DASHBOARD_URL || 'http://localhost:5000'}/confirm-email`;
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
        options: {
          redirectTo,
        },
      });

      if (linkError) throw linkError;

      // Send confirmation email via Resend
      const confirmationEmail = generateConfirmationEmail(email, linkData.properties.action_link);
      await sendEmail(confirmationEmail);

      res.json({ message: "Confirmation email sent. Please check your inbox." });
    } catch (error: any) {
      console.error("Resend confirmation error:", error);
      res.status(500).json({ error: "Failed to send confirmation email" });
    }
  });

  app.post("/api/auth/forgot-password", authRateLimit, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Generate password reset link using Supabase admin
      const redirectTo = `${process.env.VITE_DASHBOARD_URL || 'http://localhost:5000'}/reset-password`;
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'recovery',
        email,
        options: {
          redirectTo,
        },
      });

      if (linkError) {
        // Don't reveal if user exists for security
        console.error("Error generating reset link:", linkError);
        return res.json({ message: "If an account exists with this email, a password reset link has been sent." });
      }

      // Send password reset email via Resend
      try {
        const resetEmail = generatePasswordResetEmail(email, linkData.properties.action_link);
        await sendEmail(resetEmail);
      } catch (emailError: any) {
        console.error("Error sending password reset email:", emailError);
        throw emailError;
      }

      res.json({ message: "If an account exists with this email, a password reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ error: "Failed to send password reset email" });
    }
  });

  app.post("/api/auth/reset-password", authRateLimit, async (req, res) => {
    try {
      const { password, access_token } = req.body;

      // Validate required fields
      if (!password) {
        return res.status(400).json({ error: "Password is required" });
      }

      if (!access_token) {
        return res.status(400).json({ error: "Reset token is required" });
      }

      // Verify the token by getting the user from Supabase
      // This validates that the token is authentic and not forged
      const { data: { user }, error: verifyError } = await supabase.auth.getUser(access_token);

      if (verifyError || !user) {
        console.error("Token verification failed:", verifyError?.message);
        return res.status(401).json({ 
          error: "Invalid or expired reset token. Please request a new password reset link." 
        });
      }

      // Update the user's password using admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: password }
      );

      if (updateError) {
        console.error("Update password error:", updateError);
        throw updateError;
      }

      res.json({ 
        message: "Password reset successfully. Please log in with your new password."
      });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: error.message || "Failed to reset password" });
    }
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

  // Protected routes - require authentication
  
  // Get all patients (role-based access)
  // - Clinicians: see only patients assigned to them
  // - Institution admins: see only patients assigned to them
  // - Admins: see all patients
  app.get("/api/patients", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      let patientsQuery = supabase
        .from("patients")
        .select("*");

      if (userRole === 'clinician') {
        patientsQuery = patientsQuery.eq('assigned_clinician_id', userId);
      } else if (userRole === 'institution_admin' && userInstitutionId) {
        patientsQuery = patientsQuery.eq('institution_id', userInstitutionId);
      }
      // Admins see all patients (no filter)

      // Apply ordering and execute query
      const { data: patients, error: patientsError } = await patientsQuery.order("created_at", { ascending: false });

      if (patientsError) throw patientsError;

      if (!patients || patients.length === 0) {
        return res.json([]);
      }

      // Fetch risk scores for all patients
      const patientIds = patients.map(p => p.id);
      const { data: riskScores } = await supabase
        .from('risk_scores')
        .select('patient_id, score, risk_level, last_sync')
        .in('patient_id', patientIds)
        .order('updated_at', { ascending: false });

      // Get latest risk score for each patient
      const latestRiskByPatient = riskScores?.reduce((acc, rs) => {
        if (!acc[rs.patient_id]) {
          acc[rs.patient_id] = rs;
        }
        return acc;
      }, {} as Record<string, any>) || {};

      // Fetch conditions for each patient
      const { data: conditions } = await supabase
        .from('conditions')
        .select('patient_id, name')
        .in('patient_id', patientIds);

      // Group conditions by patient
      const conditionsByPatient = conditions?.reduce((acc, c) => {
        if (!acc[c.patient_id]) acc[c.patient_id] = [];
        acc[c.patient_id].push(c.name);
        return acc;
      }, {} as Record<string, string[]>) || {};

      // Transform data to match frontend format
      const transformedPatients = patients.map(patient => ({
        id: patient.id,
        name: patient.name || patient.full_name || 'Unknown',
        age: patient.age || 0,
        gender: patient.gender || 'N/A',
        conditions: conditionsByPatient[patient.id] || [],
        riskScore: latestRiskByPatient[patient.id]?.score || 0,
        riskLevel: latestRiskByPatient[patient.id]?.risk_level || "low",
        lastSync: latestRiskByPatient[patient.id]?.last_sync || patient.created_at,
        status: patient.status || 'Active',
      }));

      res.json(transformedPatients);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Get single patient with full details
  app.get("/api/patients/:id", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      // Check if user has permission to view this patient
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();

      if (patientError) throw patientError;

      if (userRole === 'clinician' && patient.assigned_clinician_id !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === 'institution_admin' && userInstitutionId && patient.institution_id !== userInstitutionId) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      // Fetch latest risk score
      const { data: riskScores } = await supabase
        .from("risk_scores")
        .select("score, risk_level, last_sync")
        .eq("patient_id", id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const riskScore = riskScores?.[0];

      // Fetch conditions
      const { data: conditions } = await supabase
        .from("conditions")
        .select("name")
        .eq("patient_id", id);

      const transformedPatient = {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        conditions: conditions?.map((c: any) => c.name) || [],
        riskScore: riskScore?.score || 0,
        riskLevel: riskScore?.risk_level || "low",
        lastSync: riskScore?.last_sync || patient.created_at,
        status: patient.status,
      };

      res.json(transformedPatient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  // Get vital readings for a patient
  app.get("/api/patients/:id/vitals", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const { type, days = 7 } = req.query;
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      // Verify patient ownership based on role
      const { data: patient } = await supabase
        .from("patients")
        .select("user_id, assigned_clinician_id, institution_id")
        .eq("id", id)
        .single();

      if (userRole === 'clinician' && patient?.assigned_clinician_id !== userId) {
        return res.status(403).json({ error: "Access denied - patient not assigned to you" });
      }
      if (userRole === 'institution_admin' && userInstitutionId && patient?.institution_id !== userInstitutionId) {
        return res.status(403).json({ error: "Access denied - patient not in your institution" });
      }

      let query = supabase
        .from("vital_readings")
        .select("*")
        .eq("patient_id", id)
        .gte("timestamp", new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString())
        .order("timestamp", { ascending: false });

      if (type) {
        query = query.eq("type", type);
      }

      const { data: vitals, error } = await query;

      if (error) throw error;

      res.json(vitals || []);
    } catch (error) {
      console.error("Error fetching vitals:", error);
      res.status(500).json({ error: "Failed to fetch vitals" });
    }
  });

  // Get all alerts (role-based access)
  // - Clinicians: see only alerts for patients assigned to them
  // - Institution admins: NO access (they manage clinicians, not patients)
  // - Admins: see all alerts
  app.get("/api/alerts", authenticateUser, requireRole('clinician', 'admin'), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // First get the patient IDs this user can access
      let patientIds: string[] = [];
      
      if (userRole === 'clinician') {
        // Clinicians only see alerts for their assigned patients
        const { data: patients } = await supabase
          .from("patients")
          .select("id")
          .eq("assigned_clinician_id", userId);
        patientIds = patients?.map(p => p.id) || [];
      }

      // Build the query
      let alertsQuery = supabase
        .from("alerts")
        .select(`
          *,
          patients (name)
        `)
        .order("timestamp", { ascending: false })
        .limit(50);

      // Filter by patient IDs for clinician role
      if (userRole === 'clinician' && patientIds.length > 0) {
        alertsQuery = alertsQuery.in("patient_id", patientIds);
      } else if (userRole === 'clinician' && patientIds.length === 0) {
        // No patients assigned, return empty
        return res.json([]);
      }
      // Admin sees all alerts (no filter)

      const { data: alerts, error } = await alertsQuery;

      if (error) throw error;

      const transformedAlerts = alerts?.map(a => ({
        id: a.id,
        patientId: a.patient_id,
        patientName: a.patients?.name || "Unknown",
        type: a.type,
        message: a.message,
        severity: a.severity,
        timestamp: a.timestamp,
        isRead: a.is_read,
      }));

      res.json(transformedAlerts || []);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  // Mark alert as read (with ownership verification)
  // Institution admins cannot access alerts - they manage clinicians, not patients
  app.patch("/api/alerts/:id", authenticateUser, requireRole('clinician', 'admin'), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const { isRead } = req.body;
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // First get the alert and verify access
      const { data: alert, error: alertError } = await supabase
        .from("alerts")
        .select("*, patient_id")
        .eq("id", id)
        .single();

      if (alertError || !alert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      // Verify access based on role (clinicians must own the patient)
      if (userRole === 'clinician') {
        const { data: patient } = await supabase
          .from("patients")
          .select("assigned_clinician_id")
          .eq("id", alert.patient_id)
          .single();

        if (patient?.assigned_clinician_id !== userId) {
          return res.status(403).json({ error: "Access denied - patient not assigned to you" });
        }
      }
      // Admin can update any alert

      const { data, error } = await supabase
        .from("alerts")
        .update({ is_read: isRead })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error("Error updating alert:", error);
      res.status(500).json({ error: "Failed to update alert" });
    }
  });

  // Get dashboard stats (role-based filtering)
  // - Clinicians: see patient stats for their assigned patients
  // - Institution admins: see clinician stats for their institution
  // - Admins: see global patient stats
  app.get("/api/dashboard/stats", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      if (userRole === 'institution_admin') {
        const { data: clinicianProfiles } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('role', 'clinician')
          .eq('institution_id', userInstitutionId);

        const clinicianUserIds = clinicianProfiles?.map(p => p.user_id) || [];

        let clinicians: any[] = [];
        if (clinicianUserIds.length > 0) {
          const { data } = await supabase
            .from('users')
            .select('id, approval_status')
            .in('id', clinicianUserIds);
          clinicians = data || [];
        }

        const totalClinicians = clinicians?.length || 0;
        const approvedClinicians = clinicians?.filter(c => c.approval_status === 'approved').length || 0;
        const pendingApprovals = clinicians?.filter(c => c.approval_status === 'pending').length || 0;

        // Get average performance score for approved clinicians
        const clinicianIds = clinicians?.filter(c => c.approval_status === 'approved').map(c => c.id) || [];
        
        let avgPerformanceScore = 0;
        if (clinicianIds.length > 0) {
          // Get alerts responded to by these clinicians
          const { data: respondedAlerts } = await supabase
            .from('alerts')
            .select('responded_by_id, timestamp, responded_at')
            .in('responded_by_id', clinicianIds)
            .not('responded_at', 'is', null);

          // Calculate average response time
          const responseTimes = respondedAlerts?.map(a => {
            return new Date(a.responded_at!).getTime() - new Date(a.timestamp).getTime();
          }).filter(t => t > 0) || [];

          if (responseTimes.length > 0) {
            const avgResponseMs = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
            // Score: faster = higher (max 100 for <5 min)
            avgPerformanceScore = Math.max(0, Math.round(100 - (avgResponseMs / 60000 / 5) * 20));
          }
        }

        return res.json({
          totalClinicians,
          approvedClinicians,
          pendingApprovals,
          avgPerformanceScore,
          isClinicianView: true, // Flag to tell frontend this is clinician-focused
        });
      }

      let patientsQuery = supabase.from("patients").select("id");
      
      if (userRole === 'clinician') {
        patientsQuery = patientsQuery.eq('assigned_clinician_id', userId);
      }

      const { data: patients } = await patientsQuery;
      const patientIds = patients?.map(p => p.id) || [];
      const totalPatients = patientIds.length;

      let unassignedQuery = supabase
        .from('patients')
        .select('id', { count: 'exact', head: true })
        .is('assigned_clinician_id', null)
        .eq('status', 'Active');

      if (userRole === 'clinician' && userInstitutionId) {
        unassignedQuery = unassignedQuery.eq('institution_id', userInstitutionId);
      }

      const { count: unassignedCount } = await unassignedQuery;

      if (totalPatients === 0) {
        return res.json({
          totalPatients: 0,
          highRiskCount: 0,
          activeAlerts: 0,
          avgRiskScore: 0,
          unassignedPatients: unassignedCount || 0,
          isClinicianView: false,
        });
      }

      // Get risk scores for accessible patients only
      const { data: allRiskScores } = await supabase
        .from("risk_scores")
        .select("patient_id, score, risk_level, updated_at")
        .in("patient_id", patientIds)
        .order("updated_at", { ascending: false });

      // Get latest risk score for each patient
      const latestRiskByPatient = allRiskScores?.reduce((acc, rs) => {
        if (!acc[rs.patient_id]) {
          acc[rs.patient_id] = rs;
        }
        return acc;
      }, {} as Record<string, any>) || {};

      const latestRiskScores = Object.values(latestRiskByPatient);

      // Count high risk patients
      const highRiskCount = latestRiskScores.filter(
        (rs: any) => rs.risk_level === "high"
      ).length;

      // Get unread alerts for accessible patients only
      const { count: activeAlerts } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .in("patient_id", patientIds)
        .eq("is_read", false);

      // Calculate average risk score
      const avgRiskScore = latestRiskScores.length
        ? Math.round(latestRiskScores.reduce((sum: number, r: any) => sum + r.score, 0) / latestRiskScores.length)
        : 0;

      res.json({
        totalPatients,
        highRiskCount,
        activeAlerts: activeAlerts || 0,
        avgRiskScore,
        unassignedPatients: unassignedCount || 0,
        isClinicianView: false,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Institution endpoints
  app.get("/api/institutions", async (req, res) => {
    try {
      const { data: institutions, error } = await supabase
        .from('institutions')
        .select('id, name, address')
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;

      res.json(institutions || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  // Institution admin endpoints
  app.get("/api/admin/pending-clinicians", authenticateUser, requireRole('institution_admin'), async (req, res) => {
    try {
      const institutionId = req.user!.institutionId;

      if (!institutionId) {
        return res.status(403).json({ error: "Institution admin must be assigned to an institution" });
      }

      const { data: clinicianProfiles } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('role', 'clinician')
        .eq('institution_id', institutionId);

      const clinicianIds = clinicianProfiles?.map(p => p.user_id) || [];

      if (clinicianIds.length === 0) {
        return res.json([]);
      }

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, approval_status, created_at')
        .in('id', clinicianIds)
        .in('approval_status', ['pending', 'rejected'])
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      if (!users || users.length === 0) {
        return res.json([]);
      }

      // Fetch clinician profiles
      const userIds = users.map(u => u.id);
      const { data: profiles } = await supabase
        .from('clinician_profiles')
        .select('user_id, full_name, license_number, specialty, phone')
        .in('user_id', userIds);

      const profilesByUserId = profiles?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      const pendingClinicians = users.map(user => ({
        id: user.id,
        email: user.email,
        approvalStatus: user.approval_status,
        createdAt: user.created_at,
        profile: profilesByUserId[user.id] || null,
      }));

      res.json(pendingClinicians);
    } catch (error) {
      console.error("Error fetching pending clinicians:", error);
      res.status(500).json({ error: "Failed to fetch pending clinicians" });
    }
  });

  app.post("/api/admin/approve-clinician", authenticateUser, requireRole('institution_admin'), async (req, res) => {
    try {
      const { clinicianId } = req.body;
      const institutionId = req.user!.institutionId;

      // Validate input
      if (!clinicianId || typeof clinicianId !== 'string') {
        return res.status(400).json({ error: "Valid clinician ID is required" });
      }

      if (!institutionId) {
        return res.status(403).json({ error: "Institution admin must be assigned to an institution" });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', clinicianId)
        .eq('role', 'clinician')
        .eq('institution_id', institutionId)
        .single();

      if (!profile) {
        console.warn(`Admin ${req.user!.id} attempted to approve non-existent or cross-institution clinician ${clinicianId}`);
        return res.status(404).json({ error: "Clinician not found or not in your institution" });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ approval_status: 'approved' })
        .eq('id', clinicianId);

      if (updateError) {
        console.error("Error approving clinician:", updateError);
        throw updateError;
      }

      res.json({ message: "Clinician approved successfully" });
    } catch (error) {
      console.error("Error approving clinician:", error);
      res.status(500).json({ error: "Failed to approve clinician" });
    }
  });

  app.post("/api/admin/reject-clinician", authenticateUser, requireRole('institution_admin'), async (req, res) => {
    try {
      const { clinicianId } = req.body;
      const institutionId = req.user!.institutionId;

      // Validate input
      if (!clinicianId || typeof clinicianId !== 'string') {
        return res.status(400).json({ error: "Valid clinician ID is required" });
      }

      if (!institutionId) {
        return res.status(403).json({ error: "Institution admin must be assigned to an institution" });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', clinicianId)
        .eq('role', 'clinician')
        .eq('institution_id', institutionId)
        .single();

      if (!profile) {
        console.warn(`Admin ${req.user!.id} attempted to reject non-existent or cross-institution clinician ${clinicianId}`);
        return res.status(404).json({ error: "Clinician not found or not in your institution" });
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ approval_status: 'rejected' })
        .eq('id', clinicianId);

      if (updateError) {
        console.error("Error rejecting clinician:", updateError);
        throw updateError;
      }

      res.json({ message: "Clinician rejected" });
    } catch (error) {
      console.error("Error rejecting clinician:", error);
      res.status(500).json({ error: "Failed to reject clinician" });
    }
  });

  // ============================================================
  // SUPER ADMIN ENDPOINTS (System admin only)
  // ============================================================

  // Get all users (admin only)
  app.get("/api/admin/users", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, approval_status, created_at')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;

      const { data: allProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, role, institution_id');

      const profileByUserId = allProfiles?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name');

      const institutionMap = institutions?.reduce((acc, inst) => {
        acc[inst.id] = inst.name;
        return acc;
      }, {} as Record<string, string>) || {};

      const { data: profiles } = await supabase
        .from('clinician_profiles')
        .select('user_id, full_name');

      const profileMap = profiles?.reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string>) || {};

      const transformedUsers = users?.map(user => {
        const up = profileByUserId[user.id];
        return {
          id: user.id,
          email: user.email,
          name: profileMap[user.id] || user.email.split('@')[0],
          role: up?.role || 'patient',
          institutionId: up?.institution_id || null,
          institutionName: up?.institution_id ? institutionMap[up.institution_id] : null,
          approvalStatus: user.approval_status,
          createdAt: user.created_at,
        };
      }) || [];

      res.json(transformedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { role, institutionId } = req.body;
      const adminId = req.user!.id;

      // Prevent admin from changing their own role
      if (id === adminId) {
        return res.status(400).json({ error: "Cannot change your own role" });
      }

      // Validate role
      const validRoles = ['patient', 'clinician', 'admin', 'institution_admin'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }

      const profileUpdate: any = { role };
      const userUpdate: any = {};

      if (role === 'institution_admin' || role === 'clinician') {
        if (!institutionId) {
          return res.status(400).json({ error: "Institution is required for this role" });
        }
        profileUpdate.institution_id = institutionId;

        if (role === 'institution_admin') {
          userUpdate.approval_status = 'approved';
        }
      }

      if (role === 'patient' || role === 'admin') {
        profileUpdate.institution_id = null;
        userUpdate.approval_status = null;
      }

      const { data: upData, error: upError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: id,
          ...profileUpdate,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (upError) throw upError;

      if (Object.keys(userUpdate).length > 0) {
        await supabase.from('users').update(userUpdate).eq('id', id);
      }

      if (!upData) {
        return res.status(404).json({ error: "User not found" });
      }

      if (role === 'institution_admin') {
        const { data: existingProfile } = await supabase
          .from('clinician_profiles')
          .select('user_id')
          .eq('user_id', id)
          .single();

        if (!existingProfile) {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', id)
            .single();

          const fullName = userData?.email?.split('@')[0] || 'Admin';

          await supabase
            .from('clinician_profiles')
            .insert({
              user_id: id,
              full_name: fullName,
            });
        }
      }

      res.json({ message: "User role updated successfully", user: upData });
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Get all institutions (admin only - for assignment dropdown)
  app.get("/api/admin/institutions", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { data: institutions, error } = await supabase
        .from('institutions')
        .select('id, name, address, contact_email, is_default')
        .order('name', { ascending: true });

      if (error) throw error;

      res.json(institutions || []);
    } catch (error) {
      console.error("Error fetching institutions:", error);
      res.status(500).json({ error: "Failed to fetch institutions" });
    }
  });

  // Create institution (admin only)
  app.post("/api/admin/institutions", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { name, address, contactEmail, contactPhone } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Institution name is required" });
      }

      const { data, error } = await supabase
        .from('institutions')
        .insert({
          name,
          address: address || null,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: 'create',
        target_type: 'institution',
        target_id: data.id,
        details: `Created institution: ${name}`,
        ip_address: req.ip,
      });

      res.json(data);
    } catch (error) {
      console.error("Error creating institution:", error);
      res.status(500).json({ error: "Failed to create institution" });
    }
  });

  // Update institution (admin only)
  app.patch("/api/admin/institutions/:id", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, address, contactEmail, contactPhone, isDefault } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (address !== undefined) updateData.address = address;
      if (contactEmail !== undefined) updateData.contact_email = contactEmail;
      if (contactPhone !== undefined) updateData.contact_phone = contactPhone;
      if (isDefault !== undefined) updateData.is_default = isDefault;

      // If setting as default, unset other defaults first
      if (isDefault === true) {
        await supabase
          .from('institutions')
          .update({ is_default: false })
          .neq('id', id);
      }

      const { data, error } = await supabase
        .from('institutions')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: 'update',
        target_type: 'institution',
        target_id: id,
        details: `Updated institution: ${data.name}`,
        ip_address: req.ip,
      });

      res.json(data);
    } catch (error) {
      console.error("Error updating institution:", error);
      res.status(500).json({ error: "Failed to update institution" });
    }
  });

  // Delete institution (admin only)
  app.delete("/api/admin/institutions/:id", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;

      const { data: profilesInInst } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('institution_id', id)
        .limit(1);

      if (profilesInInst && profilesInInst.length > 0) {
        return res.status(400).json({ error: "Cannot delete institution with assigned users" });
      }

      // Get institution name for logging
      const { data: inst } = await supabase
        .from('institutions')
        .select('name')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('institutions')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: 'delete',
        target_type: 'institution',
        target_id: id,
        details: `Deleted institution: ${inst?.name || id}`,
        ip_address: req.ip,
      });

      res.json({ message: "Institution deleted successfully" });
    } catch (error) {
      console.error("Error deleting institution:", error);
      res.status(500).json({ error: "Failed to delete institution" });
    }
  });

  // Disable/Enable user (admin only)
  app.patch("/api/admin/users/:id/status", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const adminId = req.user!.id;

      if (id === adminId) {
        return res.status(400).json({ error: "Cannot disable your own account" });
      }

      // Update user in Supabase Auth (ban/unban)
      const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
        id,
        { ban_duration: isActive ? 'none' : '876000h' } // Ban for 100 years if disabling
      );

      if (authError) throw authError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: isActive ? 'enable' : 'disable',
        target_type: 'user',
        target_id: id,
        details: `${isActive ? 'Enabled' : 'Disabled'} user account`,
        ip_address: req.ip,
      });

      res.json({ message: `User ${isActive ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
      console.error("Error updating user status:", error);
      res.status(500).json({ error: "Failed to update user status" });
    }
  });

  // Bulk update user roles (admin only)
  app.post("/api/admin/users/bulk-update", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { userIds, action, role, institutionId } = req.body;
      const adminId = req.user!.id;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: "User IDs are required" });
      }

      // Filter out admin's own ID
      const filteredIds = userIds.filter(id => id !== adminId);

      if (action === 'disable') {
        for (const userId of filteredIds) {
          await supabase.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        }
        await supabase.from('activity_logs').insert({
          user_id: adminId,
          action: 'bulk_disable',
          target_type: 'user',
          details: `Disabled ${filteredIds.length} users`,
          ip_address: req.ip,
        });
      } else if (action === 'enable') {
        for (const userId of filteredIds) {
          await supabase.auth.admin.updateUserById(userId, { ban_duration: 'none' });
        }
        await supabase.from('activity_logs').insert({
          user_id: adminId,
          action: 'bulk_enable',
          target_type: 'user',
          details: `Enabled ${filteredIds.length} users`,
          ip_address: req.ip,
        });
      } else if (action === 'change_role' && role) {
        const profileUpdate: any = { role };
        const userUpdate: any = {};
        if (role === 'institution_admin' || role === 'clinician') {
          if (!institutionId) {
            return res.status(400).json({ error: "Institution is required for this role" });
          }
          profileUpdate.institution_id = institutionId;
          if (role === 'institution_admin') {
            userUpdate.approval_status = 'approved';
          }
        } else {
          profileUpdate.institution_id = null;
          userUpdate.approval_status = null;
        }

        for (const uid of filteredIds) {
          await supabase
            .from('user_profiles')
            .upsert({
              user_id: uid,
              ...profileUpdate,
              updated_at: new Date().toISOString(),
            });
        }

        if (Object.keys(userUpdate).length > 0) {
          await supabase.from('users').update(userUpdate).in('id', filteredIds);
        }

        await supabase.from('activity_logs').insert({
          user_id: adminId,
          action: 'bulk_role_change',
          target_type: 'user',
          details: `Changed ${filteredIds.length} users to role: ${role}`,
          ip_address: req.ip,
        });
      }

      res.json({ message: "Bulk update completed successfully", count: filteredIds.length });
    } catch (error) {
      console.error("Error in bulk update:", error);
      res.status(500).json({ error: "Failed to perform bulk update" });
    }
  });

  // Get activity logs (admin only)
  app.get("/api/admin/activity-logs", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { page = '1', limit = '50', action, targetType } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('activity_logs')
        .select('*, users:user_id(email)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      if (action) query = query.eq('action', action);
      if (targetType) query = query.eq('target_type', targetType);

      const { data: logs, error, count } = await query;

      if (error) throw error;

      res.json({
        logs: logs || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Error fetching activity logs:", error);
      res.status(500).json({ error: "Failed to fetch activity logs" });
    }
  });

  app.get("/api/admin/users/:id", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, approval_status, created_at')
        .eq('id', id)
        .single();

      if (userError || !user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role, institution_id')
        .eq('user_id', id)
        .single();

      const role = userProfile?.role || 'patient';
      const institutionId = userProfile?.institution_id || null;

      const { data: profile } = await supabase
        .from('clinician_profiles')
        .select('*')
        .eq('user_id', id)
        .single();

      let institution = null;
      if (institutionId) {
        const { data: inst } = await supabase
          .from('institutions')
          .select('*')
          .eq('id', institutionId)
          .single();
        institution = inst;
      }

      let patientCount = 0;
      if (role === 'clinician') {
        const { count } = await supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_clinician_id', id);
        patientCount = count || 0;
      }

      // Get auth user info for last sign in
      const { data: authData } = await supabase.auth.admin.getUserById(id);

      const authUser = authData?.user as any;
      res.json({
        ...user,
        role,
        institution_id: institutionId,
        profile,
        institution,
        patientCount,
        lastSignIn: authUser?.last_sign_in_at,
        isBanned: authUser?.banned_until ? new Date(authUser.banned_until) > new Date() : false,
      });
    } catch (error) {
      console.error("Error fetching user details:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  // Send email to user (admin only)
  app.post("/api/admin/users/:id/email", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;
      const { subject, message } = req.body;

      if (!subject || !message) {
        return res.status(400).json({ error: "Subject and message are required" });
      }

      // Get user email
      const { data: user } = await supabase
        .from('users')
        .select('email')
        .eq('id', id)
        .single();

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const sanitizedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/\n/g, '<br>');

      await sendEmail({
        to: user.email,
        subject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Message from VeriHealth Admin</h2>
            <div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">
              ${sanitizedMessage}
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              This message was sent from the VeriHealth administration team.
            </p>
          </div>
        `,
      });

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: 'email_sent',
        target_type: 'user',
        target_id: id,
        details: `Sent email: ${subject}`,
        ip_address: req.ip,
      });

      res.json({ message: "Email sent successfully" });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Create user invite (admin only)
  app.post("/api/admin/invites", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { email, role, institutionId } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return res.status(400).json({ error: "User with this email already exists" });
      }

      // Generate token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

      const { data, error } = await supabase
        .from('user_invites')
        .insert({
          email,
          role: role || 'patient',
          institution_id: institutionId || null,
          invited_by_id: req.user!.id,
          token,
          status: 'pending',
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Send invite email
      const inviteUrl = `${process.env.VITE_DASHBOARD_URL || 'http://localhost:5000'}/register?invite=${token}`;
      await sendEmail({
        to: email,
        subject: 'You\'ve been invited to VeriHealth',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">You're Invited to VeriHealth</h2>
            <p>You've been invited to join VeriHealth as a <strong>${role || 'patient'}</strong>.</p>
            <p>Click the button below to create your account:</p>
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
              Accept Invitation
            </a>
            <p style="color: #666; font-size: 12px;">
              This invitation expires in 7 days.
            </p>
          </div>
        `,
      });

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: req.user!.id,
        action: 'invite_sent',
        target_type: 'invite',
        target_id: data.id,
        details: `Sent invite to ${email} as ${role || 'patient'}`,
        ip_address: req.ip,
      });

      res.json(data);
    } catch (error) {
      console.error("Error creating invite:", error);
      res.status(500).json({ error: "Failed to create invite" });
    }
  });

  // Get all invites (admin only)
  app.get("/api/admin/invites", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { data: invites, error } = await supabase
        .from('user_invites')
        .select('*, inviter:invited_by_id(email), institution:institution_id(name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json(invites || []);
    } catch (error) {
      console.error("Error fetching invites:", error);
      res.status(500).json({ error: "Failed to fetch invites" });
    }
  });

  // Delete/cancel invite (admin only)
  app.delete("/api/admin/invites/:id", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('user_invites')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.json({ message: "Invite cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invite:", error);
      res.status(500).json({ error: "Failed to cancel invite" });
    }
  });

  // Get admin analytics (admin only)
  app.get("/api/admin/analytics", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id, created_at');

      const { data: allUserProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, role, institution_id');

      const profileByUserId = allUserProfiles?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      const roleCounts: Record<string, number> = {};
      const usersByMonth: Record<string, number> = {};
      
      users?.forEach(u => {
        const userRole = profileByUserId[u.id]?.role || 'patient';
        roleCounts[userRole] = (roleCounts[userRole] || 0) + 1;
        const month = new Date(u.created_at).toISOString().slice(0, 7);
        usersByMonth[month] = (usersByMonth[month] || 0) + 1;
      });

      const { data: institutions, count: institutionCount } = await supabase
        .from('institutions')
        .select('id, name', { count: 'exact' });

      const usersPerInstitution: Record<string, number> = {};
      allUserProfiles?.forEach(p => {
        if (p.institution_id) {
          usersPerInstitution[p.institution_id] = (usersPerInstitution[p.institution_id] || 0) + 1;
        }
      });

      // Get recent activity
      const { data: recentActivity } = await supabase
        .from('activity_logs')
        .select('action, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      const activityByDay: Record<string, number> = {};
      recentActivity?.forEach(a => {
        const day = new Date(a.created_at).toISOString().slice(0, 10);
        activityByDay[day] = (activityByDay[day] || 0) + 1;
      });

      res.json({
        totalUsers: users?.length || 0,
        roleCounts,
        usersByMonth: Object.entries(usersByMonth)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([month, count]) => ({ month, count })),
        institutionCount: institutionCount || 0,
        activityByDay: Object.entries(activityByDay)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, count]) => ({ date, count })),
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Export users to CSV (admin only)
  app.get("/api/admin/users/export", authenticateUser, requireRole('admin'), async (req, res) => {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, approval_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: exportProfiles } = await supabase
        .from('user_profiles')
        .select('user_id, role, institution_id');

      const exportProfileMap = exportProfiles?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      const { data: institutions } = await supabase
        .from('institutions')
        .select('id, name');

      const institutionMap = institutions?.reduce((acc, inst) => {
        acc[inst.id] = inst.name;
        return acc;
      }, {} as Record<string, string>) || {};

      const { data: profiles } = await supabase
        .from('clinician_profiles')
        .select('user_id, full_name');

      const profileMap = profiles?.reduce((acc, p) => {
        acc[p.user_id] = p.full_name;
        return acc;
      }, {} as Record<string, string>) || {};

      const csvRows = [
        ['ID', 'Email', 'Name', 'Role', 'Institution', 'Status', 'Created At'].join(','),
        ...(users || []).map(u => {
          const up = exportProfileMap[u.id];
          return [
            u.id,
            u.email,
            profileMap[u.id] || u.email.split('@')[0],
            up?.role || 'patient',
            up?.institution_id ? institutionMap[up.institution_id] : '',
            u.approval_status || '',
            u.created_at,
          ].map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',');
        }),
      ];

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=users-export.csv');
      res.send(csvRows.join('\n'));
    } catch (error) {
      console.error("Error exporting users:", error);
      res.status(500).json({ error: "Failed to export users" });
    }
  });

  // Get top performing clinicians (for dashboard widget)
  // Shows top performers within the user's institution only
  app.get("/api/clinicians/top-performers", authenticateUser, requireRole('clinician', 'admin', 'institution_admin'), requireApproved, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;
      const userInstitutionId = req.user!.institutionId;

      let tpProfileQuery = supabase
        .from('user_profiles')
        .select('user_id, institution_id')
        .eq('role', 'clinician');

      if (userRole !== 'admin' && userInstitutionId) {
        tpProfileQuery = tpProfileQuery.eq('institution_id', userInstitutionId);
      }

      const { data: tpProfiles, error: tpError } = await tpProfileQuery;

      if (tpError) throw tpError;

      const tpUserIds = tpProfiles?.map(p => p.user_id) || [];

      if (tpUserIds.length === 0) {
        return res.json([]);
      }

      const { data: approvedClinicianUsers } = await supabase
        .from('users')
        .select('id, email, created_at')
        .in('id', tpUserIds)
        .eq('approval_status', 'approved');

      const clinicians = approvedClinicianUsers || [];

      if (clinicians.length === 0) {
        return res.json([]);
      }

      const clinicianIds = clinicians.map(c => c.id);

      // Get clinician profiles
      const { data: profiles } = await supabase
        .from('clinician_profiles')
        .select('user_id, full_name, specialty')
        .in('user_id', clinicianIds);

      const profilesByUserId = profiles?.reduce((acc, p) => {
        acc[p.user_id] = p;
        return acc;
      }, {} as Record<string, any>) || {};

      // Get alerts with response times (where clinician responded)
      const { data: respondedAlerts } = await supabase
        .from('alerts')
        .select('id, responded_by_id, timestamp, responded_at')
        .not('responded_by_id', 'is', null)
        .not('responded_at', 'is', null)
        .limit(1000);

      // Calculate average response time per clinician
      const responseTimesByClinicianId: Record<string, number[]> = {};
      respondedAlerts?.forEach(alert => {
        if (alert.responded_by_id && alert.responded_at && alert.timestamp) {
          const responseTimeMs = new Date(alert.responded_at).getTime() - new Date(alert.timestamp).getTime();
          if (responseTimeMs > 0) {
            if (!responseTimesByClinicianId[alert.responded_by_id]) {
              responseTimesByClinicianId[alert.responded_by_id] = [];
            }
            responseTimesByClinicianId[alert.responded_by_id].push(responseTimeMs);
          }
        }
      });

      // Calculate average response time per clinician
      const avgResponseTimeByClinicianId: Record<string, number> = {};
      Object.entries(responseTimesByClinicianId).forEach(([clinicianId, times]) => {
        avgResponseTimeByClinicianId[clinicianId] = times.reduce((a, b) => a + b, 0) / times.length;
      });

      // Get patients with their assigned clinician to calculate per-clinician outcomes
      const { data: patients } = await supabase
        .from('patients')
        .select('id, assigned_clinician_id')
        .in('assigned_clinician_id', clinicianIds);

      // Map patient IDs to their assigned clinician
      const clinicianByPatientId: Record<string, string> = {};
      patients?.forEach(p => {
        if (p.assigned_clinician_id) {
          clinicianByPatientId[p.id] = p.assigned_clinician_id;
        }
      });

      // Get risk score improvements (patient outcomes)
      const patientIds = patients?.map(p => p.id) || [];
      const { data: riskScores } = await supabase
        .from('risk_scores')
        .select('patient_id, score, created_at')
        .in('patient_id', patientIds)
        .order('created_at', { ascending: true });

      // Group risk scores by patient and calculate improvement
      const riskScoresByPatient: Record<string, { score: number; createdAt: string }[]> = {};
      riskScores?.forEach(rs => {
        if (!riskScoresByPatient[rs.patient_id]) {
          riskScoresByPatient[rs.patient_id] = [];
        }
        riskScoresByPatient[rs.patient_id].push({ score: rs.score, createdAt: rs.created_at });
      });

      // Sort each patient's risk scores by timestamp to ensure correct order
      Object.values(riskScoresByPatient).forEach(scores => {
        scores.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });

      // Calculate per-clinician patient outcomes
      const outcomesByClinicianId: Record<string, { total: number; improved: number }> = {};
      Object.entries(riskScoresByPatient).forEach(([patientId, scores]) => {
        const clinicianId = clinicianByPatientId[patientId];
        if (!clinicianId) return;
        
        if (!outcomesByClinicianId[clinicianId]) {
          outcomesByClinicianId[clinicianId] = { total: 0, improved: 0 };
        }
        
        if (scores.length >= 2) {
          outcomesByClinicianId[clinicianId].total++;
          const firstScore = scores[0].score;
          const lastScore = scores[scores.length - 1].score;
          if (lastScore < firstScore) {
            outcomesByClinicianId[clinicianId].improved++;
          }
        }
      });

      // Build the top performers list
      const topPerformers = clinicians.map(clinician => {
        const profile = profilesByUserId[clinician.id];
        const avgResponseMs = avgResponseTimeByClinicianId[clinician.id];
        const alertsRespondedTo = responseTimesByClinicianId[clinician.id]?.length || 0;
        const outcomes = outcomesByClinicianId[clinician.id];
        
        // Calculate per-clinician improvement rate
        const improvementRate = outcomes && outcomes.total > 0
          ? Math.round((outcomes.improved / outcomes.total) * 100)
          : 0;

        // Convert response time to human-readable format
        let avgResponseTime = 'N/A';
        if (avgResponseMs) {
          const minutes = Math.floor(avgResponseMs / 60000);
          const hours = Math.floor(minutes / 60);
          if (hours > 0) {
            avgResponseTime = `${hours}h ${minutes % 60}m`;
          } else {
            avgResponseTime = `${minutes}m`;
          }
        }

        // Calculate a performance score (lower response time + higher improvement = better)
        let performanceScore = 0;
        if (avgResponseMs) {
          // Response time score: faster = higher (max 50 points for <5 min response)
          const responseScore = Math.max(0, 50 - (avgResponseMs / 60000 / 5) * 10);
          performanceScore += responseScore;
        }
        // Per-clinician improvement rate contributes to score (max 50 points)
        performanceScore += (improvementRate / 100) * 50;

        return {
          id: clinician.id,
          name: profile?.full_name || clinician.email.split('@')[0],
          specialty: profile?.specialty || 'General',
          avgResponseTime,
          avgResponseTimeMs: avgResponseMs || null,
          alertsRespondedTo,
          patientOutcomeRate: improvementRate,
          performanceScore: Math.round(performanceScore),
        };
      });

      // Sort by performance score (highest first)
      topPerformers.sort((a, b) => b.performanceScore - a.performanceScore);

      // Return top 5
      res.json(topPerformers.slice(0, 5));
    } catch (error) {
      console.error("Error fetching top performers:", error);
      res.status(500).json({ error: "Failed to fetch top performers" });
    }
  });

  // Update alert with response (when clinician marks alert as read)
  // Clinicians can only respond to alerts for their assigned patients
  app.patch("/api/alerts/:id/respond", authenticateUser, requireRole('clinician', 'admin'), requireApproved, async (req, res) => {
    try {
      const { id } = req.params;
      const clinicianId = req.user!.id;
      const userRole = req.user!.role;

      // First verify the alert exists and check ownership
      const { data: existingAlert, error: fetchError } = await supabase
        .from("alerts")
        .select("id, responded_by_id, patient_id")
        .eq("id", id)
        .single();

      if (fetchError || !existingAlert) {
        return res.status(404).json({ error: "Alert not found" });
      }

      // Verify clinician owns this patient (admins can respond to any)
      if (userRole === 'clinician') {
        const { data: patient } = await supabase
          .from("patients")
          .select("assigned_clinician_id")
          .eq("id", existingAlert.patient_id)
          .single();
        
        if (patient?.assigned_clinician_id !== clinicianId) {
          return res.status(403).json({ error: "Access denied - patient not assigned to you" });
        }
      }

      // If already responded to, don't overwrite the original responder
      if (existingAlert.responded_by_id) {
        return res.status(400).json({ error: "Alert already responded to" });
      }

      const { data, error } = await supabase
        .from("alerts")
        .update({ 
          is_read: true,
          responded_by_id: clinicianId,
          responded_at: new Date().toISOString()
        })
        .eq("id", id)
        .is("responded_by_id", null) // Only update if not already responded
        .select()
        .single();

      if (error) throw error;

      res.json(data);
    } catch (error) {
      console.error("Error responding to alert:", error);
      res.status(500).json({ error: "Failed to respond to alert" });
    }
  });

  // Get patient's own dashboard data (for patient role)
  // Returns: their profile, vitals summary, risk score, conditions, assigned clinician, institution
  app.get("/api/patient/my-dashboard", authenticateUser, async (req, res) => {
    try {
      const userId = req.user!.id;
      const userRole = req.user!.role;

      // Only patients can access this endpoint
      if (userRole !== 'patient') {
        return res.status(403).json({ error: "This endpoint is for patients only" });
      }

      // Get the patient record for this user
      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (patientError || !patient) {
        return res.status(404).json({ error: "Patient profile not found" });
      }

      // Get conditions
      const { data: conditions } = await supabase
        .from("conditions")
        .select("name")
        .eq("patient_id", patient.id);

      // Get latest risk score
      const { data: riskScores } = await supabase
        .from("risk_scores")
        .select("score, risk_level, last_sync")
        .eq("patient_id", patient.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      const riskScore = riskScores?.[0];

      // Get recent vitals (last 7 days)
      const { data: rawVitals } = await supabase
        .from("vital_readings")
        .select("*")
        .eq("patient_id", patient.id)
        .gte("timestamp", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("timestamp", { ascending: false });

      // Transform vitals to camelCase for frontend
      const transformVital = (v: any) => ({
        id: v.id,
        patientId: v.patient_id,
        type: v.type,
        value: v.value,
        unit: v.unit,
        timestamp: v.timestamp,
        status: v.status,
      });

      const recentVitals = rawVitals?.map(transformVital) || [];

      // Get vital summaries (latest of each type)
      const vitalsByType: Record<string, any> = {};
      recentVitals.forEach(v => {
        if (!vitalsByType[v.type]) {
          vitalsByType[v.type] = v;
        }
      });

      // Get assigned clinician info
      let clinicianInfo = null;
      if (patient.assigned_clinician_id) {
        const { data: clinician } = await supabase
          .from("users")
          .select("id, email")
          .eq("id", patient.assigned_clinician_id)
          .single();

        if (clinician) {
          // Get clinician profile
          const { data: profile } = await supabase
            .from("clinician_profiles")
            .select("full_name, specialty, phone")
            .eq("user_id", clinician.id)
            .single();

          clinicianInfo = {
            id: clinician.id,
            email: clinician.email,
            name: profile?.full_name || clinician.email.split('@')[0],
            specialty: profile?.specialty || 'General Practice',
            phone: profile?.phone || null,
          };
        }
      }

      // Get institution info
      let institutionInfo = null;
      if (patient.institution_id) {
        const { data: institution } = await supabase
          .from("institutions")
          .select("id, name, address, contact_email, contact_phone")
          .eq("id", patient.institution_id)
          .single();

        if (institution) {
          institutionInfo = {
            id: institution.id,
            name: institution.name,
            address: institution.address,
            contactEmail: institution.contact_email,
            contactPhone: institution.contact_phone,
          };
        }
      }

      // Get recent alerts for this patient
      const { data: rawAlerts } = await supabase
        .from("alerts")
        .select("id, type, message, severity, is_read, timestamp")
        .eq("patient_id", patient.id)
        .order("timestamp", { ascending: false })
        .limit(5);

      // Transform alerts to camelCase
      const recentAlerts = rawAlerts?.map(a => ({
        id: a.id,
        type: a.type,
        message: a.message,
        severity: a.severity,
        isRead: a.is_read,
        timestamp: a.timestamp,
      })) || [];

      res.json({
        patient: {
          id: patient.id,
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          status: patient.status,
          conditions: conditions?.map(c => c.name) || [],
          riskScore: riskScore?.score || 0,
          riskLevel: riskScore?.risk_level || "low",
          lastSync: riskScore?.last_sync || patient.created_at,
        },
        latestVitals: vitalsByType,
        recentVitals: recentVitals,
        clinician: clinicianInfo,
        institution: institutionInfo,
        recentAlerts: recentAlerts,
      });
    } catch (error) {
      console.error("Error fetching patient dashboard:", error);
      res.status(500).json({ error: "Failed to fetch patient dashboard" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

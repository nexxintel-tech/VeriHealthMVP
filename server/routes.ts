import type { Express } from "express";
import { createServer, type Server } from "http";
import { supabase } from "./supabase";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all patients with their conditions and risk scores
  app.get("/api/patients", async (req, res) => {
    try {
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select(`
          *,
          conditions (name),
          risk_scores (score, risk_level, last_sync)
        `)
        .order("created_at", { ascending: false });

      if (patientsError) throw patientsError;

      // Transform data to match frontend format
      const transformedPatients = patients?.map(p => ({
        id: p.id,
        name: p.name,
        age: p.age,
        gender: p.gender,
        conditions: p.conditions?.map((c: any) => c.name) || [],
        riskScore: p.risk_scores?.[0]?.score || 0,
        riskLevel: p.risk_scores?.[0]?.risk_level || "low",
        lastSync: p.risk_scores?.[0]?.last_sync || p.created_at,
        status: p.status,
      }));

      res.json(transformedPatients || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  // Get single patient with full details
  app.get("/api/patients/:id", async (req, res) => {
    try {
      const { id } = req.params;

      const { data: patient, error: patientError } = await supabase
        .from("patients")
        .select(`
          *,
          conditions (name),
          risk_scores (score, risk_level, last_sync)
        `)
        .eq("id", id)
        .single();

      if (patientError) throw patientError;

      const transformedPatient = {
        id: patient.id,
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        conditions: patient.conditions?.map((c: any) => c.name) || [],
        riskScore: patient.risk_scores?.[0]?.score || 0,
        riskLevel: patient.risk_scores?.[0]?.risk_level || "low",
        lastSync: patient.risk_scores?.[0]?.last_sync || patient.created_at,
        status: patient.status,
      };

      res.json(transformedPatient);
    } catch (error) {
      console.error("Error fetching patient:", error);
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  // Get vital readings for a patient
  app.get("/api/patients/:id/vitals", async (req, res) => {
    try {
      const { id } = req.params;
      const { type, days = 7 } = req.query;

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

  // Get all alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const { data: alerts, error } = await supabase
        .from("alerts")
        .select(`
          *,
          patients (name)
        `)
        .order("timestamp", { ascending: false })
        .limit(50);

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

  // Mark alert as read
  app.patch("/api/alerts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { isRead } = req.body;

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

  // Get dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      // Get total patients
      const { count: totalPatients } = await supabase
        .from("patients")
        .select("*", { count: "exact", head: true });

      // Get high risk patients
      const { count: highRiskCount } = await supabase
        .from("risk_scores")
        .select("*", { count: "exact", head: true })
        .eq("risk_level", "high");

      // Get unread alerts
      const { count: activeAlerts } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);

      // Get average risk score
      const { data: riskScores } = await supabase
        .from("risk_scores")
        .select("score");

      const avgRiskScore = riskScores?.length
        ? Math.round(riskScores.reduce((sum, r) => sum + r.score, 0) / riskScores.length)
        : 0;

      res.json({
        totalPatients: totalPatients || 0,
        highRiskCount: highRiskCount || 0,
        activeAlerts: activeAlerts || 0,
        avgRiskScore,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

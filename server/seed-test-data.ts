import { supabase } from './supabase';
import crypto from 'crypto';

async function seedTestData() {
  console.log("=== Seeding test data ===\n");

  const institutionUuid = "c0d25015-e0e1-4624-9d57-74ca61252178";

  const { data: existingInst } = await supabase
    .from("institutions")
    .select("id")
    .eq("id_uuid", institutionUuid)
    .single();

  let hospitalId = existingInst?.id;

  if (!existingInst) {
    console.log("1. Creating institution...");
    const { data: institution, error: instError } = await supabase
      .from("institutions")
      .insert({
        id_uuid: institutionUuid,
        name: "VeriHealth General Hospital",
        address: "12 Marina Road, Victoria Island, Lagos, Nigeria",
        contact_email: "info@verihealthgeneral.ng",
        contact_phone: "+234-801-234-5678",
        is_default: true,
      })
      .select()
      .single();

    if (instError) {
      console.error("Institution error:", instError);
      return;
    }
    hospitalId = institution.id;
    console.log("Institution created, id:", hospitalId);
  } else {
    console.log("1. Institution already exists, id:", hospitalId);
  }

  const davidUserId = "2844c691-1e4c-4062-a95c-34f24a820f5d";
  const clinicianUserId = "45f48b4f-47d1-4796-af88-88e4b08de9d2";

  const { data: existingPatient } = await supabase
    .from("patients")
    .select("id")
    .eq("user_id", davidUserId)
    .single();

  if (!existingPatient) {
    console.log("\n2. Creating patient record for David Briels...");
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .insert({
        id: crypto.randomUUID(),
        user_id: davidUserId,
        first_name: "David",
        last_name: "Briels",
        sex: "male",
        date_of_birth: "1988-03-15",
        blood_type: "O+",
        height_cm: 178,
        weight_kg: 82,
        phone: "+234-802-345-6789",
        address: "45 Admiralty Way, Lekki Phase 1, Lagos",
        emergency_contact_name: "Sarah Briels",
        emergency_contact_phone: "+234-803-456-7890",
        assigned_clinician_id: clinicianUserId,
        hospital_id: hospitalId,
      })
      .select()
      .single();

    if (patientError) {
      console.error("Patient error:", patientError);
    } else {
      console.log("Patient created:", patient?.id);
    }
  } else {
    console.log("\n2. Patient already exists:", existingPatient.id);
  }

  const { data: existingClinician } = await supabase
    .from("clinician_profiles")
    .select("id")
    .eq("user_id", clinicianUserId)
    .single();

  if (!existingClinician) {
    console.log("\n3. Creating clinician profile...");
    const { data: clinProfile, error: clinError } = await supabase
      .from("clinician_profiles")
      .insert({
        user_id: clinicianUserId,
        full_name: "Dr. Nexus Intel",
        specialty: "Internal Medicine",
        phone: "+234-805-678-9012",
        license_number: "MDCN/2015/04521",
      })
      .select()
      .single();

    if (clinError) {
      console.error("Clinician profile error:", clinError);
    } else {
      console.log("Clinician profile created:", clinProfile?.id);
    }
  } else {
    console.log("\n3. Clinician profile already exists");
  }

  console.log("\n4. Creating sample vital readings...");
  const now = new Date();
  const vitals: any[] = [];

  for (let i = 0; i < 14; i++) {
    const date = new Date(now.getTime() - i * 12 * 60 * 60 * 1000);
    const dateStr = date.toISOString();

    vitals.push(
      { user_id: davidUserId, type: "Heart Rate", value: 65 + Math.floor(Math.random() * 25), recorded_at: dateStr, source: "Apple Watch" },
      { user_id: davidUserId, type: "Blood Pressure Systolic", value: 115 + Math.floor(Math.random() * 20), recorded_at: dateStr, source: "Omron BP Monitor" },
      { user_id: davidUserId, type: "Blood Pressure Diastolic", value: 70 + Math.floor(Math.random() * 15), recorded_at: dateStr, source: "Omron BP Monitor" },
      { user_id: davidUserId, type: "SpO2", value: 95 + Math.floor(Math.random() * 5), recorded_at: dateStr, source: "Apple Watch" },
      { user_id: davidUserId, type: "Temperature", value: parseFloat((36.2 + Math.random() * 1.2).toFixed(1)), recorded_at: dateStr, source: "Digital Thermometer" },
      { user_id: davidUserId, type: "Steps", value: 3000 + Math.floor(Math.random() * 8000), recorded_at: dateStr, source: "Apple Watch" },
    );

    if (i % 2 === 0) {
      vitals.push(
        { user_id: davidUserId, type: "HRV", value: 30 + Math.floor(Math.random() * 40), recorded_at: dateStr, source: "Apple Watch" },
        { user_id: davidUserId, type: "Sleep", value: parseFloat((5 + Math.random() * 3).toFixed(1)), recorded_at: dateStr, source: "Apple Watch" },
        { user_id: davidUserId, type: "Weight", value: parseFloat((80 + Math.random() * 4).toFixed(1)), recorded_at: dateStr, source: "Smart Scale" },
      );
    }
  }

  const { error: vitalsError } = await supabase
    .from("vital_readings")
    .insert(vitals);

  if (vitalsError) {
    console.error("Vitals error:", vitalsError);
  } else {
    console.log(`Created ${vitals.length} vital readings`);
  }

  console.log("\n5. Creating risk score...");
  const { error: riskError } = await supabase
    .from("risk_scores")
    .insert({
      user_id: davidUserId,
      score: 35,
      level: "medium",
      explanation: "Elevated blood pressure trend, below average sleep quality, moderate activity level",
      generated_at: now.toISOString(),
    });

  if (riskError) {
    console.error("Risk score error:", riskError);
  } else {
    console.log("Risk score created");
  }

  const { data: existingAlerts } = await supabase
    .from("alerts")
    .select("id")
    .eq("user_id", davidUserId)
    .limit(1);

  if (!existingAlerts || existingAlerts.length === 0) {
    console.log("\n6. Creating sample alerts...");
    const alerts = [
      {
        user_id: davidUserId,
        alert_type: "vital_anomaly",
        message: "Blood pressure reading 145/95 exceeds normal range",
        severity: "high",
        is_resolved: false,
        triggered_at: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: davidUserId,
        alert_type: "vital_anomaly",
        message: "Heart rate dropped to 52 bpm during sleep - below threshold",
        severity: "medium",
        is_resolved: false,
        triggered_at: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: davidUserId,
        alert_type: "missed_reading",
        message: "No SpO2 reading recorded in the last 24 hours",
        severity: "low",
        is_resolved: true,
        triggered_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        user_id: davidUserId,
        alert_type: "risk_score_change",
        message: "Risk score increased from 22 to 35 - moved from low to medium risk",
        severity: "medium",
        is_resolved: false,
        triggered_at: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
      },
    ];

    const { error: alertsError } = await supabase
      .from("alerts")
      .insert(alerts);

    if (alertsError) {
      console.error("Alerts error:", alertsError);
    } else {
      console.log(`Created ${alerts.length} alerts`);
    }
  } else {
    console.log("\n6. Alerts already exist, skipping");
  }

  console.log("\n7. Updating approval status...");
  const { error: approvalError } = await supabase
    .from("users")
    .update({ approval_status: "approved" })
    .eq("id", davidUserId);

  if (approvalError) {
    console.error("Approval update error:", approvalError);
  } else {
    console.log("David's approval status set to 'approved'");
  }

  console.log("\n=== Seed complete ===");
  console.log("\nTest accounts:");
  console.log("  Patient: davidbriels@yahoo.com (David Briels)");
  console.log("  Clinician: nexxintel@gmail.com (Dr. Nexus Intel)");
  console.log("  Institution Admin: helenchinex@gmail.com");
  console.log("\nAll assigned to: VeriHealth General Hospital");
}

seedTestData().catch(console.error);

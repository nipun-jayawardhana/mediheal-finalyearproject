const mongoose = require('mongoose');

const BASE_URL = 'http://localhost:5000/api';

async function req(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase5Tests() {
  console.log('====================================================');
  console.log('STARTING PHASE 5: PATIENT MEDICAL HISTORY TIMELINE TESTS');
  console.log('====================================================\n');

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------
    // 1. SETUP: REGISTER PATIENT A & DOCTOR
    // ----------------------------------------------------
    console.log('--- 1. Setting up Patient A and Doctor ---');
    const pARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Alpha ${timestamp}`,
      email: `patient_alpha_${timestamp}@example.com`,
      phoneNumber: '0771112222',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    assert(pARes.status === 201, 'Patient Alpha registered successfully');
    const patientAToken = pARes.data.data.token;
    const patientAId = pARes.data.data.user._id || pARes.data.data.user.id;

    // Create profile for Patient A
    const profRes = await req(
      `${BASE_URL}/patients/profile`,
      'POST',
      {
        dateOfBirth: '1960-05-15',
        gender: 'female',
        bloodGroup: 'B+',
        address: '123 Galle Road, Colombo',
        emergencyContactName: 'Kamal Silva',
        emergencyContactPhone: '0779998877',
      },
      patientAToken
    );
    assert(profRes.status === 201, 'Patient Alpha profile created');

    // Admin login to create Doctor
    const adminLoginRes = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'admin@mediheal.com',
      password: 'AdminPass123!',
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeded');
    const adminToken = adminLoginRes.data.data.token;

    // Create Doctor via Admin
    const docRes = await req(
      `${BASE_URL}/admin/doctors`,
      'POST',
      {
        fullName: `Dr. Rasil Lakshika ${timestamp}`,
        email: `dr_rasil_${timestamp}@mediheal.com`,
        phoneNumber: '0773334444',
        password: 'DoctorPass123!',
        slmcNumber: `SLMC-${timestamp}`,
        specialization: 'General Physician',
        hospital: 'National Hospital of Sri Lanka',
        consultationFee: 2500,
        yearsOfExperience: 12,
        availableDays: ['Monday', 'Tuesday', 'Wednesday'],
        availableTimeSlots: ['09:00', '10:00', '11:00'],
      },
      adminToken
    );
    assert(docRes.status === 201, 'Doctor created successfully');
    const doctorId =
      docRes.data.data.doctor.userId._id ||
      docRes.data.data.doctor.userId ||
      docRes.data.data.doctor._id;

    // Login as Doctor
    const docLoginRes = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: `dr_rasil_${timestamp}@mediheal.com`,
      password: 'DoctorPass123!',
    });
    assert(docLoginRes.status === 200, 'Doctor logged in');
    const doctorToken = docLoginRes.data.data.token;

    // ----------------------------------------------------
    // 2. EMPTY STATE TEST (Before any consultations)
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Empty State ---');
    const emptyTimelineRes = await req(
      `${BASE_URL}/patient/medical-history`,
      'GET',
      null,
      patientAToken
    );
    assert(emptyTimelineRes.status === 200, 'GET /api/patient/medical-history returns 200');
    assert(emptyTimelineRes.data.count === 0, 'Empty timeline returns count = 0');
    assert(Array.isArray(emptyTimelineRes.data.data) && emptyTimelineRes.data.data.length === 0, 'Empty timeline returns empty data array');

    // Also test plural route convention
    const pluralEmptyRes = await req(
      `${BASE_URL}/patients/medical-history`,
      'GET',
      null,
      patientAToken
    );
    assert(pluralEmptyRes.status === 200, 'GET /api/patients/medical-history also returns 200');

    // ----------------------------------------------------
    // 3. CREATE FIRST CONSULTATION WITH PRESCRIPTION
    // ----------------------------------------------------
    console.log('\n--- 3. Creating Consultation 1 (Viral Respiratory Infection) ---');
    // Book Appointment 1
    const appt1Res = await req(
      `${BASE_URL}/appointments`,
      'POST',
      {
        doctorId,
        appointmentDate: '2026-09-24',
        timeSlot: '09:00',
        reason: 'Fever, cough, and body aches',
      },
      patientAToken
    );
    assert(appt1Res.status === 201, 'Appointment 1 booked');
    const appt1Id = appt1Res.data.data._id || appt1Res.data.data.id;

    // Doctor confirms Appointment 1
    const confirm1Res = await req(
      `${BASE_URL}/doctor/appointments/${appt1Id}/status`,
      'PATCH',
      { status: 'confirmed' },
      doctorToken
    );
    assert(confirm1Res.status === 200, 'Appointment 1 confirmed by doctor');

    // Doctor records Consultation 1 with prescribed medicines
    const cons1Res = await req(
      `${BASE_URL}/consultations`,
      'POST',
      {
        appointmentId: appt1Id,
        diagnosis: 'Viral respiratory infection',
        clinicalNotes: 'Mild chest congestion and mild fever. Vital signs stable.',
        recommendations: ['Drink warm fluids', 'Complete bed rest for 3 days'],
        followUpDate: '2026-09-17',
        prescriptions: [
          {
            medicineName: 'Paracetamol 500mg',
            dosage: '500mg',
            frequency: '3 times daily',
            duration: '5 days',
            instructions: 'Take after meals',
          },
        ],
      },
      doctorToken
    );
    assert(cons1Res.status === 201, 'Consultation 1 recorded with prescription');

    // ----------------------------------------------------
    // 4. SIMULATE ADHERENCE: 12 TAKEN, 3 MISSED
    // ----------------------------------------------------
    console.log('\n--- 4. Setting Adherence Records (12 TAKEN, 3 MISSED) ---');
    // We update the MedicationSchedule adherence records directly in DB
    const MedicationSchedule = require('../src/models/MedicationSchedule');
    const schedules1 = await MedicationSchedule.find({ patientId: patientAId });
    assert(schedules1.length > 0, 'MedicationSchedule auto-generated for Consultation 1');

    const schedule1 = schedules1[0];
    assert(schedule1.adherenceRecords.length >= 15, 'Schedule contains at least 15 scheduled doses');

    // Mark 12 as TAKEN and 3 as MISSED
    for (let i = 0; i < 12; i++) {
      schedule1.adherenceRecords[i].status = 'TAKEN';
      schedule1.adherenceRecords[i].takenAt = new Date();
    }
    for (let i = 12; i < 15; i++) {
      schedule1.adherenceRecords[i].status = 'MISSED';
    }
    await schedule1.save();
    console.log('✅ Schedule updated with 12 TAKEN and 3 MISSED records');

    // ----------------------------------------------------
    // 5. TEST TIMELINE API WITH 1 CONSULTATION & ADHERENCE
    // ----------------------------------------------------
    console.log('\n--- 5. Verifying Timeline API for Consultation 1 ---');
    const timeline1Res = await req(
      `${BASE_URL}/patient/medical-history`,
      'GET',
      null,
      patientAToken
    );
    assert(timeline1Res.status === 200, 'Timeline fetched successfully');
    assert(timeline1Res.data.count === 1, 'Timeline contains 1 event');

    const event1 = timeline1Res.data.data[0];
    assert(event1.type === 'CONSULTATION', 'Event type is CONSULTATION');
    assert(event1.diagnosis === 'Viral respiratory infection', 'Diagnosis matches');
    assert(event1.clinicalNotes.includes('Mild chest congestion'), 'Clinical notes match');
    assert(event1.recommendations.includes('Drink warm fluids'), 'Recommendations match');
    assert(event1.doctor.name.includes('Dr. Rasil Lakshika'), 'Doctor name matches');
    assert(event1.doctor.specialization === 'General Physician', 'Doctor specialization matches');
    assert(event1.doctor.hospital === 'National Hospital of Sri Lanka', 'Doctor hospital matches');

    // Prescription verification
    assert(event1.prescription !== null, 'Prescription is linked to consultation');
    assert(event1.prescription.medications.length === 1, 'Medication list has 1 item');
    assert(event1.prescription.medications[0].medicineName === 'Paracetamol 500mg', 'Medicine name preserved in original text');
    assert(event1.prescription.medications[0].instructions === 'Take after meals', 'Medicine instructions preserved');

    // Adherence calculation verification: 12 / (12 + 3) * 100 = 80%
    assert(event1.adherence !== null, 'Adherence data is present');
    assert(event1.adherence.totalTaken === 12, 'Adherence totalTaken is 12');
    assert(event1.adherence.totalMissed === 3, 'Adherence totalMissed is 3');
    assert(event1.adherence.adherencePercentage === 80, 'Adherence percentage is 80%');
    assert(event1.adherence.hasEnoughData === true, 'hasEnoughData is true');
    assert(event1.adherence.summaryText === '80%', 'summaryText is "80%"');

    // ----------------------------------------------------
    // 6. CREATE SECOND CONSULTATION (CHRONOLOGICAL ORDER TEST)
    // ----------------------------------------------------
    console.log('\n--- 6. Creating Consultation 2 (Later Date) ---');
    const appt2Res = await req(
      `${BASE_URL}/appointments`,
      'POST',
      {
        doctorId,
        appointmentDate: '2026-09-25',
        timeSlot: '10:00',
        reason: 'Follow-up consultation',
      },
      patientAToken
    );
    assert(appt2Res.status === 201, 'Appointment 2 booked');
    const appt2Id = appt2Res.data.data._id || appt2Res.data.data.id;

    const confirm2Res = await req(
      `${BASE_URL}/doctor/appointments/${appt2Id}/status`,
      'PATCH',
      { status: 'confirmed' },
      doctorToken
    );
    assert(confirm2Res.status === 200, 'Appointment 2 confirmed by doctor');

    // Consultation 2 recorded with new medicines
    const cons2Res = await req(
      `${BASE_URL}/consultations`,
      'POST',
      {
        appointmentId: appt2Id,
        diagnosis: 'Seasonal allergic rhinitis',
        clinicalNotes: 'Previous viral infection resolved. Mild seasonal sneezing.',
        recommendations: ['Avoid dust', 'Use air purifier'],
        followUpDate: null,
        prescriptions: [
          {
            medicineName: 'Cetirizine 10mg',
            dosage: '10mg',
            frequency: 'Once daily',
            duration: '7 days',
            instructions: 'Take at night before bed',
          },
        ],
      },
      doctorToken
    );
    assert(cons2Res.status === 201, 'Consultation 2 recorded');

    // ----------------------------------------------------
    // 7. VERIFY MULTIPLE CONSULTATIONS & CHRONOLOGICAL SORTING
    // ----------------------------------------------------
    console.log('\n--- 7. Verifying Chronological Order (Newest First) ---');
    const timeline2Res = await req(
      `${BASE_URL}/patient/medical-history`,
      'GET',
      null,
      patientAToken
    );
    assert(timeline2Res.data.count === 2, 'Timeline now contains 2 events');

    const firstEvent = timeline2Res.data.data[0];
    const secondEvent = timeline2Res.data.data[1];

    // Verify newest event is first
    assert(
      new Date(firstEvent.date).getTime() >= new Date(secondEvent.date).getTime(),
      'Newest event appears first in timeline'
    );
    assert(firstEvent.diagnosis === 'Seasonal allergic rhinitis', 'First event is newest consultation (Allergic rhinitis)');
    assert(secondEvent.diagnosis === 'Viral respiratory infection', 'Second event is older consultation (Viral infection)');

    // Verify no cross-linking between prescriptions
    assert(firstEvent.prescription.medications[0].medicineName === 'Cetirizine 10mg', 'Event 1 has Cetirizine');
    assert(secondEvent.prescription.medications[0].medicineName === 'Paracetamol 500mg', 'Event 2 has Paracetamol');

    // ----------------------------------------------------
    // 8. ADHERENCE EDGE CASE: NO EVALUATED DOSES ("Not enough adherence data")
    // ----------------------------------------------------
    console.log('\n--- 8. Verifying "Not enough adherence data" for Consultation 2 ---');
    // Cetirizine has not had any doses marked taken or missed yet (all PENDING)
    assert(firstEvent.adherence.hasEnoughData === false, 'Consultation 2 hasEnoughData is false');
    assert(firstEvent.adherence.adherencePercentage === null, 'adherencePercentage is null (no fake 100%)');
    assert(firstEvent.adherence.summaryText === 'Not enough adherence data', 'summaryText is "Not enough adherence data"');

    // ----------------------------------------------------
    // 9. SECURITY & DATA ISOLATION TEST (PATIENT A vs PATIENT B)
    // ----------------------------------------------------
    console.log('\n--- 9. Security Test: Patient A vs Patient B Isolation ---');
    const pBRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Beta ${timestamp}`,
      email: `patient_beta_${timestamp}@example.com`,
      phoneNumber: '0779990000',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'Sinhala',
    });
    assert(pBRes.status === 201, 'Patient Beta registered');
    const patientBToken = pBRes.data.data.token;

    // Fetch Patient B's history
    const patientBTimelineRes = await req(
      `${BASE_URL}/patient/medical-history`,
      'GET',
      null,
      patientBToken
    );
    assert(patientBTimelineRes.status === 200, 'Patient Beta fetches timeline');
    assert(patientBTimelineRes.data.count === 0, 'Patient Beta sees 0 events (CANNOT see Patient Alpha events)');

    // Ensure non-patient role cannot access patient timeline
    const docForbiddenRes = await req(
      `${BASE_URL}/patient/medical-history`,
      'GET',
      null,
      doctorToken
    );
    assert(docForbiddenRes.status === 403, 'Doctor role cannot access /api/patient/medical-history (403 Forbidden)');

    // ----------------------------------------------------
    // 10. DOCTOR REGRESSION CHECK
    // ----------------------------------------------------
    console.log('\n--- 10. Regression Check: Existing Doctor History Screen API ---');
    const docHistRes = await req(
      `${BASE_URL}/doctor/patients/${patientAId}/history`,
      'GET',
      null,
      doctorToken
    );
    assert(docHistRes.status === 200, 'Doctor patient history API returns 200');
    assert(docHistRes.data.count === 2, 'Doctor sees both consultations for Patient Alpha');
    assert(docHistRes.data.data[0].patientId.fullName.includes('Patient Alpha'), 'Patient details intact in doctor history');

    console.log('\n====================================================');
    console.log('🎉 ALL PHASE 5 BACKEND VERIFICATION TESTS PASSED!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Unhandled test failure:', err);
    process.exit(1);
  }
}

// Connect mongoose if needed or run directly
const mongooseConnect = async () => {
  const dotenv = require('dotenv');
  dotenv.config({ path: 'd:\\MediHeal\\mediheal-backend\\.env' });
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
  await runPhase5Tests();
};

mongooseConnect().catch((err) => {
  console.error(err);
  process.exit(1);
});

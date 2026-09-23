const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const CaregiverLink = require('../src/models/CaregiverLink');
const Prescription = require('../src/models/Prescription');
const MedicationSchedule = require('../src/models/MedicationSchedule');
const Appointment = require('../src/models/Appointment');
const Consultation = require('../src/models/Consultation');
const { formatDateKey } = require('../src/services/medicationReminderService');

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

async function runPhase6AnalyticsTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 6: MEDICATION ADHERENCE ANALYTICS TESTS');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediheal';
  await mongoose.connect(mongoUri);

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------
    // 1. SETUP USERS: PATIENT A, PATIENT B, CAREGIVER A, DOCTOR A, DOCTOR B
    // ----------------------------------------------------
    console.log('--- 1. Setting up Users ---');

    // Register Patient A
    const pARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Alpha ${timestamp}`,
      email: `patient_a_${timestamp}@example.com`,
      phoneNumber: '0771000001',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    assert(pARes.status === 201, 'Patient Alpha registered');
    const patientAToken = pARes.data.data.token;
    const patientAId = pARes.data.data.user._id;

    // Register Patient B (for zero data test)
    const pBRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Beta ${timestamp}`,
      email: `patient_b_${timestamp}@example.com`,
      phoneNumber: '0771000002',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    assert(pBRes.status === 201, 'Patient Beta registered');
    const patientBToken = pBRes.data.data.token;
    const patientBId = pBRes.data.data.user._id;

    // Register Caregiver A
    const cARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver Alpha ${timestamp}`,
      email: `caregiver_a_${timestamp}@example.com`,
      phoneNumber: '0771000003',
      password: 'Password123!',
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    assert(cARes.status === 201, 'Caregiver Alpha registered');
    const caregiverAToken = cARes.data.data.token;
    const caregiverAId = cARes.data.data.user._id;

    // Link Caregiver A -> Patient A (Active)
    await CaregiverLink.create({
      caregiverId: caregiverAId,
      patientId: patientAId,
      status: 'active',
      relationship: 'Child',
    });
    console.log('✅ Caregiver Alpha linked to Patient Alpha');

    // Admin login to create Doctors
    const adminLoginRes = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'admin@mediheal.com',
      password: 'AdminPass123!',
    });
    assert(adminLoginRes.status === 200, 'Admin login succeeded');
    const adminToken = adminLoginRes.data.data.token;

    // Create Doctor A (Authorized to Patient A)
    const dARes = await req(
      `${BASE_URL}/admin/doctors`,
      'POST',
      {
        fullName: `Dr. Alice ${timestamp}`,
        email: `doctor_a_${timestamp}@mediheal.com`,
        phoneNumber: '0771000004',
        password: 'Password123!',
        specialization: 'General Physician',
        slmcNumber: `SLMC-A-${timestamp.toString().slice(-5)}`,
        hospital: 'National Hospital',
        consultationFee: 2500,
        yearsOfExperience: 10,
        availableDays: ['Monday', 'Tuesday'],
        availableTimeSlots: ['09:00', '10:00'],
      },
      adminToken
    );
    assert(dARes.status === 201, 'Doctor Alice created');
    const doctorAId =
      dARes.data.data.doctor.userId._id ||
      dARes.data.data.doctor.userId ||
      dARes.data.data.doctor._id;

    const docALogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: `doctor_a_${timestamp}@mediheal.com`,
      password: 'Password123!',
    });
    assert(docALogin.status === 200, 'Doctor Alice logged in');
    const doctorAToken = docALogin.data.data.token;

    // Create Doctor B (Unauthorized to Patient A)
    const dBRes = await req(
      `${BASE_URL}/admin/doctors`,
      'POST',
      {
        fullName: `Dr. Bob ${timestamp}`,
        email: `doctor_b_${timestamp}@mediheal.com`,
        phoneNumber: '0771000005',
        password: 'Password123!',
        specialization: 'Cardiologist',
        slmcNumber: `SLMC-B-${(timestamp + 1).toString().slice(-5)}`,
        hospital: 'National Hospital',
        consultationFee: 3000,
        yearsOfExperience: 8,
        availableDays: ['Wednesday'],
        availableTimeSlots: ['14:00'],
      },
      adminToken
    );
    assert(dBRes.status === 201, 'Doctor Bob created');
    const doctorBId =
      dBRes.data.data.doctor.userId._id ||
      dBRes.data.data.doctor.userId ||
      dBRes.data.data.doctor._id;

    const docBLogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: `doctor_b_${timestamp}@mediheal.com`,
      password: 'Password123!',
    });
    assert(docBLogin.status === 200, 'Doctor Bob logged in');
    const doctorBToken = docBLogin.data.data.token;

    // ----------------------------------------------------
    // 2. CREATE PRESCRIPTION & SCHEDULE FOR PATIENT A
    // Section 21 Test Setup: Taken = 12, Missed = 3, Future Pending = 5
    // ----------------------------------------------------
    console.log('\n--- 2. Creating Patient A Schedule (12 Taken, 3 Missed, 5 Future Pending) ---');

    const prescA = await Prescription.create({
      patientId: patientAId,
      doctorId: doctorAId,
      medications: [
        {
          medicineName: 'Paracetamol',
          dosage: '500mg',
          frequency: 'Twice daily',
          scheduledTimes: ['08:00', '20:00'],
          duration: '10 days',
          startDate: new Date(Date.now() - 10 * 86400000),
          endDate: new Date(Date.now() + 5 * 86400000),
          instructions: 'Take after meals',
        },
      ],
      diagnosis: 'Viral Fever',
      clinicalNotes: 'Rest and hydrate',
      status: 'active',
      validUntil: new Date(Date.now() + 30 * 86400000),
    });

    const now = new Date();
    const adherenceRecordsA = [];

    // Create 12 TAKEN records (past days)
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = formatDateKey(d);

      adherenceRecordsA.push({
        scheduledDate: d,
        scheduledDateStr: dateStr,
        dayNumber: 7 - i,
        scheduledTime: '08:00',
        status: 'TAKEN',
        takenAt: new Date(d.getTime() + 10 * 60000),
      });

      adherenceRecordsA.push({
        scheduledDate: d,
        scheduledDateStr: dateStr,
        dayNumber: 7 - i,
        scheduledTime: '20:00',
        status: 'TAKEN',
        takenAt: new Date(d.getTime() + 15 * 60000),
      });
    }
    // Total TAKEN = 12

    // Create 3 MISSED records (scheduled at 08:00 and 14:00)
    const missedDate1 = new Date(now);
    missedDate1.setDate(missedDate1.getDate() - 7);
    const missedDateStr1 = formatDateKey(missedDate1);

    adherenceRecordsA.push({
      scheduledDate: missedDate1,
      scheduledDateStr: missedDateStr1,
      dayNumber: 1,
      scheduledTime: '08:00',
      status: 'MISSED',
      takenAt: null,
    });
    adherenceRecordsA.push({
      scheduledDate: missedDate1,
      scheduledDateStr: missedDateStr1,
      dayNumber: 1,
      scheduledTime: '14:00',
      status: 'MISSED',
      takenAt: null,
    });
    adherenceRecordsA.push({
      scheduledDate: missedDate1,
      scheduledDateStr: missedDateStr1,
      dayNumber: 1,
      scheduledTime: '20:00',
      status: 'MISSED',
      takenAt: null,
    });
    // Total MISSED = 3

    // Create 5 Future PENDING records (tomorrow onwards)
    for (let i = 1; i <= 5; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const dateStr = formatDateKey(d);

      adherenceRecordsA.push({
        scheduledDate: d,
        scheduledDateStr: dateStr,
        dayNumber: 7 + i,
        scheduledTime: '08:00',
        status: 'PENDING',
        takenAt: null,
      });
    }
    // Total PENDING = 5

    await MedicationSchedule.create({
      prescriptionId: prescA._id,
      patientId: patientAId,
      doctorId: doctorAId,
      medicineName: 'Paracetamol',
      dosage: '500mg',
      frequency: 'Twice daily',
      scheduledTimes: ['08:00', '20:00'],
      duration: '10 days',
      startDate: new Date(Date.now() - 10 * 86400000),
      endDate: new Date(Date.now() + 5 * 86400000),
      instructions: 'Take after meals',
      adherenceRecords: adherenceRecordsA,
    });

    console.log('✅ Patient A Schedule created in MongoDB');

    // ----------------------------------------------------
    // 3. CREATE ZERO-DATA SCHEDULE FOR PATIENT B
    // Section 22 Test Setup: Taken = 0, Missed = 0, Future Pending = 5
    // ----------------------------------------------------
    console.log('\n--- 3. Creating Patient B Zero-Data Schedule ---');

    const prescB = await Prescription.create({
      patientId: patientBId,
      doctorId: doctorAId,
      medications: [
        {
          medicineName: 'Amoxicillin',
          dosage: '250mg',
          frequency: 'Once daily',
          scheduledTimes: ['09:00'],
          duration: '5 days',
          startDate: new Date(Date.now() + 86400000),
          endDate: new Date(Date.now() + 6 * 86400000),
          instructions: 'Take with water',
        },
      ],
      diagnosis: 'Bacterial Infection',
      status: 'active',
      validUntil: new Date(Date.now() + 30 * 86400000),
    });

    const adherenceRecordsB = [];
    for (let i = 1; i <= 5; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      adherenceRecordsB.push({
        scheduledDate: d,
        scheduledDateStr: formatDateKey(d),
        dayNumber: i,
        scheduledTime: '09:00',
        status: 'PENDING',
        takenAt: null,
      });
    }

    await MedicationSchedule.create({
      prescriptionId: prescB._id,
      patientId: patientBId,
      doctorId: doctorAId,
      medicineName: 'Amoxicillin',
      dosage: '250mg',
      frequency: 'Once daily',
      scheduledTimes: ['09:00'],
      duration: '5 days',
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 6 * 86400000),
      instructions: 'Take with water',
      adherenceRecords: adherenceRecordsB,
    });
    console.log('✅ Patient B Zero-Data Schedule created in MongoDB');

    // ----------------------------------------------------
    // 4. TEST: PATIENT CORE METRICS & FORMULA (SECTION 21)
    // ----------------------------------------------------
    console.log('\n--- 4. TEST: Patient Core Metrics & Formula ---');
    const analyticsResA = await req(
      `${BASE_URL}/medication-analytics/my?range=30d`,
      'GET',
      null,
      patientAToken
    );
    assert(analyticsResA.status === 200, 'GET /medication-analytics/my returned 200');
    assert(analyticsResA.data.success === true, 'Response success is true');

    const summaryA = analyticsResA.data.summary;
    console.log('Patient A Summary:', summaryA);

    assert(summaryA.totalTaken === 12, 'totalTaken is 12');
    assert(summaryA.totalMissed === 3, 'totalMissed is 3');
    assert(summaryA.totalPending === 5, 'totalPending is 5');
    assert(summaryA.totalScheduledEvaluated === 15, 'totalScheduledEvaluated is 15 (12 Taken + 3 Missed)');
    assert(summaryA.adherencePercentage === 80, 'adherencePercentage is 80% (12 / 15 * 100)');
    assert(summaryA.hasEnoughData === true, 'hasEnoughData is true');

    // ----------------------------------------------------
    // 5. TEST: ZERO DATA RULE (SECTION 22)
    // ----------------------------------------------------
    console.log('\n--- 5. TEST: Zero Data Rule ---');
    const analyticsResB = await req(
      `${BASE_URL}/medication-analytics/my?range=30d`,
      'GET',
      null,
      patientBToken
    );
    assert(analyticsResB.status === 200, 'GET /medication-analytics/my (Patient B) returned 200');
    const summaryB = analyticsResB.data.summary;
    console.log('Patient B Summary:', summaryB);

    assert(summaryB.totalTaken === 0, 'totalTaken is 0');
    assert(summaryB.totalMissed === 0, 'totalMissed is 0');
    assert(summaryB.totalPending === 5, 'totalPending is 5');
    assert(summaryB.totalScheduledEvaluated === 0, 'totalScheduledEvaluated is 0');
    assert(summaryB.adherencePercentage === null, 'adherencePercentage is null (Zero Data Rule)');
    assert(summaryB.hasEnoughData === false, 'hasEnoughData is false');

    // ----------------------------------------------------
    // 6. TEST: DATE RANGE FILTERS (SECTION 23)
    // Create records older than 7, 30, 90 days for Patient C
    // ----------------------------------------------------
    console.log('\n--- 6. TEST: Date Range Filtering (7d, 30d, 90d, all) ---');
    const pCRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Gamma ${timestamp}`,
      email: `patient_c_${timestamp}@example.com`,
      phoneNumber: '0771000006',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    const patientCToken = pCRes.data.data.token;
    const patientCId = pCRes.data.data.user._id;

    const prescC = await Prescription.create({
      patientId: patientCId,
      doctorId: doctorAId,
      medications: [
        {
          medicineName: 'Vitamin C',
          dosage: '500mg',
          frequency: 'Daily',
          scheduledTimes: ['08:00'],
          duration: '150 days',
          startDate: new Date(Date.now() - 150 * 86400000),
          endDate: new Date(),
        },
      ],
      diagnosis: 'Immune Support',
      status: 'active',
      validUntil: new Date(Date.now() + 30 * 86400000),
    });

    const d4 = new Date(now); d4.setDate(d4.getDate() - 4); // Within 7d, 30d, 90d, all
    const d15 = new Date(now); d15.setDate(d15.getDate() - 15); // Within 30d, 90d, all (outside 7d)
    const d60 = new Date(now); d60.setDate(d60.getDate() - 60); // Within 90d, all (outside 7d, 30d)
    const d120 = new Date(now); d120.setDate(d120.getDate() - 120); // Within all (outside 7d, 30d, 90d)

    await MedicationSchedule.create({
      prescriptionId: prescC._id,
      patientId: patientCId,
      doctorId: doctorAId,
      medicineName: 'Vitamin C',
      dosage: '500mg',
      frequency: 'Daily',
      scheduledTimes: ['08:00'],
      duration: '150 days',
      startDate: new Date(Date.now() - 150 * 86400000),
      endDate: new Date(),
      adherenceRecords: [
        { scheduledDate: d4, scheduledDateStr: formatDateKey(d4), dayNumber: 1, scheduledTime: '08:00', status: 'TAKEN', takenAt: d4 },
        { scheduledDate: d15, scheduledDateStr: formatDateKey(d15), dayNumber: 2, scheduledTime: '08:00', status: 'TAKEN', takenAt: d15 },
        { scheduledDate: d60, scheduledDateStr: formatDateKey(d60), dayNumber: 3, scheduledTime: '08:00', status: 'TAKEN', takenAt: d60 },
        { scheduledDate: d120, scheduledDateStr: formatDateKey(d120), dayNumber: 4, scheduledTime: '08:00', status: 'MISSED', takenAt: null },
      ],
    });

    // 7 Days query
    const res7d = await req(`${BASE_URL}/medication-analytics/my?range=7d`, 'GET', null, patientCToken);
    assert(res7d.status === 200, 'Query ?range=7d returned 200');
    assert(res7d.data.summary.totalScheduledEvaluated === 1, '7d includes only 4-day-old record (Evaluated = 1)');
    assert(res7d.data.summary.totalTaken === 1, '7d totalTaken is 1');

    // 30 Days query
    const res30d = await req(`${BASE_URL}/medication-analytics/my?range=30d`, 'GET', null, patientCToken);
    assert(res30d.status === 200, 'Query ?range=30d returned 200');
    assert(res30d.data.summary.totalScheduledEvaluated === 2, '30d includes 4-day & 15-day records (Evaluated = 2)');
    assert(res30d.data.summary.totalTaken === 2, '30d totalTaken is 2');

    // 90 Days query
    const res90d = await req(`${BASE_URL}/medication-analytics/my?range=90d`, 'GET', null, patientCToken);
    assert(res90d.status === 200, 'Query ?range=90d returned 200');
    assert(res90d.data.summary.totalScheduledEvaluated === 3, '90d includes 4, 15, and 60-day records (Evaluated = 3)');
    assert(res90d.data.summary.totalTaken === 3, '90d totalTaken is 3');

    // All Time query
    const resAll = await req(`${BASE_URL}/medication-analytics/my?range=all`, 'GET', null, patientCToken);
    assert(resAll.status === 200, 'Query ?range=all returned 200');
    assert(resAll.data.summary.totalScheduledEvaluated === 4, 'all includes all 4 records (Evaluated = 4)');
    assert(resAll.data.summary.totalTaken === 3 && resAll.data.summary.totalMissed === 1, 'all has 3 Taken and 1 Missed (75%)');
    assert(resAll.data.summary.adherencePercentage === 75, 'all adherencePercentage is 75%');

    // ----------------------------------------------------
    // 7. TEST: DAILY TREND & MISSED DOSE TIMES ANALYSIS
    // ----------------------------------------------------
    console.log('\n--- 7. TEST: Daily Trend & Missed Dose Times ---');
    assert(Array.isArray(analyticsResA.data.dailyTrend), 'dailyTrend is an array');
    assert(analyticsResA.data.dailyTrend.length > 0, 'dailyTrend contains daily entries');
    console.log('Daily Trend sample:', analyticsResA.data.dailyTrend.slice(0, 3));

    assert(Array.isArray(analyticsResA.data.missedByTime), 'missedByTime is an array');
    console.log('Missed by Time:', analyticsResA.data.missedByTime);
    assert(
      analyticsResA.data.missedByTime.some((m) => m.time === '08:00'),
      'missedByTime contains 08:00'
    );
    assert(
      analyticsResA.data.missedByTime.some((m) => m.time === '14:00'),
      'missedByTime contains 14:00'
    );
    assert(
      analyticsResA.data.missedByTime.some((m) => m.time === '20:00'),
      'missedByTime contains 20:00'
    );

    // ----------------------------------------------------
    // 8. TEST: MEDICATION BREAKDOWN (Distinct Prescriptions)
    // ----------------------------------------------------
    console.log('\n--- 8. TEST: Medication Breakdown ---');
    // Add a second distinct prescription with the same medicine name 'Paracetamol'
    const prescA2 = await Prescription.create({
      patientId: patientAId,
      doctorId: doctorAId,
      medications: [
        {
          medicineName: 'Paracetamol',
          dosage: '650mg',
          frequency: 'Once daily',
          scheduledTimes: ['12:00'],
          duration: '3 days',
          startDate: new Date(),
          endDate: new Date(Date.now() + 3 * 86400000),
        },
      ],
      diagnosis: 'Headache',
      status: 'active',
      validUntil: new Date(Date.now() + 30 * 86400000),
    });

    await MedicationSchedule.create({
      prescriptionId: prescA2._id,
      patientId: patientAId,
      doctorId: doctorAId,
      medicineName: 'Paracetamol',
      dosage: '650mg',
      frequency: 'Once daily',
      scheduledTimes: ['12:00'],
      duration: '3 days',
      startDate: new Date(),
      endDate: new Date(Date.now() + 3 * 86400000),
      adherenceRecords: [
        { scheduledDate: new Date(), scheduledDateStr: formatDateKey(new Date()), dayNumber: 1, scheduledTime: '12:00', status: 'TAKEN', takenAt: new Date() },
      ],
    });

    const analyticsBreakdownRes = await req(`${BASE_URL}/medication-analytics/my?range=30d`, 'GET', null, patientAToken);
    assert(analyticsBreakdownRes.data.medications.length >= 2, 'Medication breakdown has 2 distinct schedule records');
    const distinctPrescIds = new Set(analyticsBreakdownRes.data.medications.map((m) => m.prescriptionId.toString()));
    assert(distinctPrescIds.size >= 2, 'Unrelated prescriptions with same medicine name are NOT merged');

    // ----------------------------------------------------
    // 9. TEST: PATIENT SECURITY (SECTION 25)
    // ----------------------------------------------------
    console.log('\n--- 9. TEST: Patient Security (Isolation) ---');
    // Patient A accesses own analytics
    assert(analyticsBreakdownRes.data.summary.totalTaken === 13, 'Patient A receives own data (now 13 taken after 2nd schedule)');
    // Patient B accesses own analytics
    assert(analyticsResB.data.summary.totalTaken === 0, 'Patient B receives own data (0 taken)');

    // ----------------------------------------------------
    // 10. TEST: CAREGIVER SECURITY (SECTION 24)
    // ----------------------------------------------------
    console.log('\n--- 10. TEST: Caregiver Security ---');
    // Caregiver A requests linked Patient A analytics -> 200 OK
    const cgResA = await req(
      `${BASE_URL}/caregiver/medication-analytics/patient/${patientAId}?range=30d`,
      'GET',
      null,
      caregiverAToken
    );
    assert(cgResA.status === 200, 'Caregiver A requests linked Patient A -> 200 OK');
    assert(cgResA.data.patient._id === patientAId.toString(), 'Response includes patient metadata');
    assert(cgResA.data.summary.totalTaken === 13, 'Caregiver receives accurate patient adherence metrics');

    // Caregiver A requests unlinked Patient B analytics -> 403 Forbidden
    const cgResB = await req(
      `${BASE_URL}/caregiver/medication-analytics/patient/${patientBId}?range=30d`,
      'GET',
      null,
      caregiverAToken
    );
    assert(cgResB.status === 403, 'Caregiver A requests unlinked Patient B -> 403 Forbidden');
    console.log('✅ Caregiver unauthorized access safely denied with 403');

    // ----------------------------------------------------
    // 11. TEST: DOCTOR SECURITY (SECTION 26)
    // ----------------------------------------------------
    console.log('\n--- 11. TEST: Doctor Security ---');
    // Doctor A (has prescription with Patient A) -> 200 OK
    const docResA = await req(
      `${BASE_URL}/doctor/patients/${patientAId}/medication-analytics?range=30d`,
      'GET',
      null,
      doctorAToken
    );
    assert(docResA.status === 200, 'Doctor Alice (prescribing doctor) requests Patient A -> 200 OK');
    assert(docResA.data.summary.totalTaken === 13, 'Doctor receives accurate adherence metrics');

    // Doctor B (no appointment, consultation, or prescription with Patient A) -> 403 Forbidden
    const docResB = await req(
      `${BASE_URL}/doctor/patients/${patientAId}/medication-analytics?range=30d`,
      'GET',
      null,
      doctorBToken
    );
    assert(docResB.status === 403, 'Doctor Bob (unauthorized doctor) requests Patient A -> 403 Forbidden');
    console.log('✅ Unauthorized doctor access safely denied with 403');

    // ----------------------------------------------------
    // 12. TEST: REGRESSION OF PHASES 1 - 5 (SECTION 27)
    // ----------------------------------------------------
    console.log('\n--- 12. TEST: Regression Testing (Phases 1-5) ---');
    // Phase 1: Prescriptions
    const regPresc = await req(`${BASE_URL}/prescriptions/my`, 'GET', null, patientAToken);
    assert(regPresc.status === 200, 'Phase 1: GET /prescriptions/my returned 200');

    // Phase 2: Medication Schedules
    const regSched = await req(`${BASE_URL}/medication-schedules/my`, 'GET', null, patientAToken);
    assert(regSched.status === 200, 'Phase 2: GET /medication-schedules/my returned 200');

    // Phase 3: Missed Medications
    const regMissed = await req(`${BASE_URL}/medication-schedules/missed`, 'GET', null, patientAToken);
    assert(regMissed.status === 200, 'Phase 3: GET /medication-schedules/missed returned 200');

    // Phase 4: Notification Count
    const regNotif = await req(`${BASE_URL}/notifications/unread-count`, 'GET', null, patientAToken);
    assert(regNotif.status === 200, 'Phase 4: GET /notifications/unread-count returned 200');

    // Phase 5: Patient Medical History Timeline
    const regHistory = await req(`${BASE_URL}/patient/medical-history`, 'GET', null, patientAToken);
    assert(regHistory.status === 200, 'Phase 5: GET /patient/medical-history returned 200');

    console.log('\n====================================================');
    console.log('ALL PHASE 6 ANALYTICS TESTS COMPLETED SUCCESSFULLY! 🎉');
    console.log('====================================================');
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase6AnalyticsTests();

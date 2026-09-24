const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const EmergencyHealthProfile = require('../src/models/EmergencyHealthProfile');
const EmergencyAlert = require('../src/models/EmergencyAlert');
const CaregiverLink = require('../src/models/CaregiverLink');
const Prescription = require('../src/models/Prescription');
const MedicationSchedule = require('../src/models/MedicationSchedule');
const { getCaregiverEmergencyAlertHealthSummary } = require('../src/controllers/emergencyController');

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

async function runPhase71Tests() {
  console.log('====================================================');
  console.log('STARTING PHASE 7.1: SOS EMERGENCY SUMMARY FOR CAREGIVER');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediheal';
  await mongoose.connect(mongoUri);

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------
    // 1. SETUP USERS: PATIENT A, CAREGIVER A, PATIENT B, CAREGIVER B, NEW PATIENT C, CAREGIVER C
    // ----------------------------------------------------
    console.log('--- 1. Setting up Test Users & Links ---');

    // Register Patient A
    const pARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Kasun Perera ${timestamp}`,
      email: `kasun_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pARes.status === 201, `Patient A registered successfully`);
    const pAToken = pARes.data.data.token;
    const pAId = pARes.data.data.user._id;

    // Create Patient A profile to generate caregiverLinkCode
    const createPAProfile = await req(`${BASE_URL}/patients/profile`, 'POST', {
      dateOfBirth: '1990-01-01',
      gender: 'male',
      bloodGroup: 'O+',
      address: '123 Main Street, Colombo',
      emergencyContactName: 'Nimal Perera',
      emergencyContactPhone: '0771234567',
    }, pAToken);
    assert(createPAProfile.status === 201 || createPAProfile.status === 200, `Patient A profile created (status: ${createPAProfile.status}, msg: ${JSON.stringify(createPAProfile.data)})`);
    const pALinkCode = createPAProfile.data.data.profile.caregiverLinkCode;
    assert(Boolean(pALinkCode), 'Patient A has caregiverLinkCode');

    // Register Caregiver A
    const cgARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver Alpha ${timestamp}`,
      email: `caregiverA_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9471${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'caregiver',
    });
    assert(cgARes.status === 201, `Caregiver A registered successfully`);
    const cgAToken = cgARes.data.data.token;
    const cgAId = cgARes.data.data.user._id;

    // Link Caregiver A to Patient A
    const linkARes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode: pALinkCode,
      relationship: 'Family',
    }, cgAToken);
    assert(linkARes.status === 201 || linkARes.status === 200, `Caregiver A linked to Patient A (status: ${linkARes.status})`);

    // Register Patient B
    const pBRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Beta ${timestamp}`,
      email: `patientB_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9476${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pBRes.status === 201, `Patient B registered successfully`);
    const pBToken = pBRes.data.data.token;
    const pBId = pBRes.data.data.user._id;

    // Register Caregiver B (NOT linked to Patient A)
    const cgBRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver Beta ${timestamp}`,
      email: `caregiverB_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9472${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'caregiver',
    });
    assert(cgBRes.status === 201, `Caregiver B registered successfully`);
    const cgBToken = cgBRes.data.data.token;
    const cgBId = cgBRes.data.data.user._id;

    // Create Doctor User
    const docUser = await User.create({
      fullName: `Dr. Silva ${timestamp}`,
      email: `doctor_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9478${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'doctor',
    });
    assert(Boolean(docUser && docUser._id), `Doctor created successfully`);
    const docId = docUser._id;

    // ----------------------------------------------------
    // 2. SETUP PATIENT A EMERGENCY HEALTH PROFILE & ACTIVE MEDICATION
    // ----------------------------------------------------
    console.log('\n--- 2. Setting up Patient A Profile & Prescription ---');

    // Create prescription for Patient A with Metformin
    const prescription = await Prescription.create({
      patientId: pAId,
      doctorId: docId,
      diagnosis: 'Type 2 Diabetes',
      medications: [
        {
          medicineName: 'Metformin',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '30 days',
          instructions: 'Take after meals',
        },
      ],
      status: 'active',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Create active medication schedule
    await MedicationSchedule.create({
      patientId: pAId,
      doctorId: docId,
      prescriptionId: prescription._id,
      medicineName: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      duration: '30 days',
      timeOfDay: ['morning', 'night'],
      scheduledTimes: ['08:00', '20:00'],
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    // Setup Complete Emergency Health Profile for Patient A
    const profileRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', {
      bloodGroup: 'O+',
      allergies: ['Penicillin'],
      hasNoKnownAllergies: false,
      chronicConditions: ['Asthma'],
      emergencyContact: {
        name: 'Nimal Perera',
        relationship: 'Father',
        phone: '0771234567',
      },
      emergencyNotes: 'Carries inhaler in bag.',
    }, pAToken);
    assert(profileRes.status === 200 && profileRes.data.success, 'Patient A Emergency Health Profile created');

    // ----------------------------------------------------
    // 3. TRIGGER SOS FOR PATIENT A (Flow & Immediate SOS Verification)
    // ----------------------------------------------------
    console.log('\n--- 3. Patient A Triggers Active SOS ---');

    const sosARes = await req(`${BASE_URL}/emergency`, 'POST', {
      message: 'Need help immediately!',
    }, pAToken);
    assert(sosARes.status === 201 && sosARes.data.success, 'Patient A SOS triggered immediately (201 Created)');
    const alertA = sosARes.data.data;
    assert(alertA.status === 'active', 'Emergency alert is ACTIVE');
    assert(alertA.caregiverIds.some((id) => id.toString() === cgAId.toString()), 'Caregiver A is in alert caregiverIds');

    // Caregiver A fetches alerts
    const cgAlertsRes = await req(`${BASE_URL}/caregiver/emergency-alerts`, 'GET', null, cgAToken);
    assert(cgAlertsRes.status === 200 && cgAlertsRes.data.data.length > 0, 'Caregiver A received SOS alert');

    // ----------------------------------------------------
    // 4. TEST A & TEST 18: COMPLETE PROFILE EMERGENCY SUMMARY FOR LINKED CAREGIVER
    // ----------------------------------------------------
    console.log('\n--- 4. TEST A & 18: Caregiver A Accesses Patient A SOS Emergency Summary ---');

    const summaryRes = await req(
      `${BASE_URL}/caregiver/emergency-alerts/${alertA._id}/health-summary`,
      'GET',
      null,
      cgAToken
    );

    assert(summaryRes.status === 200, `TEST A Passed: Caregiver A gets 200 OK (got: ${summaryRes.status})`);
    assert(summaryRes.data.success === true, 'Response success is true');
    assert(summaryRes.data.alert.alertId === alertA._id, 'Alert ID matches');
    assert(summaryRes.data.alert.status === 'active', 'Alert status is active');
    assert(summaryRes.data.patient.name.startsWith('Kasun Perera'), 'Patient name is Kasun Perera');
    assert(Boolean(summaryRes.data.patient.phone), 'Patient phone is present');

    const summary = summaryRes.data.emergencySummary;
    assert(summary.profileCompleted === true, 'Profile completed is true');
    assert(summary.bloodGroup === 'O+', `Blood Group is O+ (got: ${summary.bloodGroup})`);
    assert(summary.allergies.includes('Penicillin'), 'Allergies includes Penicillin');
    assert(summary.chronicConditions.includes('Asthma'), 'Chronic Conditions includes Asthma');
    assert(summary.emergencyContact.name === 'Nimal Perera', 'Emergency Contact is Nimal Perera');
    assert(summary.emergencyContact.relationship === 'Father', 'Relationship is Father');
    assert(summary.emergencyContact.phone === '0771234567', 'Contact phone is 0771234567');
    assert(summary.emergencyNotes === 'Carries inhaler in bag.', 'Emergency notes match');
    assert(summary.currentMedications.length === 1, `Current medications count is 1 (got: ${summary.currentMedications.length})`);
    assert(summary.currentMedications[0].medicineName === 'Metformin', 'Medication is Metformin');
    assert(summary.currentMedications[0].dosage === '500mg', 'Dosage is 500mg');
    assert(summary.currentMedications[0].frequency === 'Twice daily', 'Frequency is Twice daily');
    console.log('✅ TEST 18 Passed: Complete profile data accurately delivered to linked caregiver');

    // ----------------------------------------------------
    // 5. TEST B & TEST D: UNLINKED CAREGIVER ACCESS DENIED
    // ----------------------------------------------------
    console.log('\n--- 5. TEST B & D: Unlinked Caregiver B Attempts Access ---');

    const unlinkedRes = await req(
      `${BASE_URL}/caregiver/emergency-alerts/${alertA._id}/health-summary`,
      'GET',
      null,
      cgBToken
    );
    assert(unlinkedRes.status === 403, `TEST B & D Passed: Unlinked Caregiver B received 403 Forbidden (got: ${unlinkedRes.status})`);
    assert(unlinkedRes.data.success === false, 'Unlinked response success is false');

    // ----------------------------------------------------
    // 6. TEST C: RESOLVED / NO ACTIVE SOS ACCESS CONTROL
    // ----------------------------------------------------
    console.log('\n--- 6. TEST C: Attempt Access After SOS Resolved ---');

    // Caregiver A resolves alert
    const resolveRes = await req(`${BASE_URL}/emergency/${alertA._id}/resolve`, 'PATCH', {}, cgAToken);
    assert(resolveRes.status === 200 && resolveRes.data.data.status === 'resolved', 'Emergency alert resolved successfully');

    // Caregiver A attempts to access health summary now that alert is resolved
    const resolvedSummaryRes = await req(
      `${BASE_URL}/caregiver/emergency-alerts/${alertA._id}/health-summary`,
      'GET',
      null,
      cgAToken
    );
    assert(resolvedSummaryRes.status === 403, `TEST C Passed: Resolved alert access denied with 403 (got: ${resolvedSummaryRes.status})`);
    assert(resolvedSummaryRes.data.success === false, 'Resolved alert response success is false');

    // ----------------------------------------------------
    // 7. PRIVACY TEST (SECTION 14): CAREGIVER CANNOT CALL /api/emergency-profile/my
    // ----------------------------------------------------
    console.log('\n--- 7. Privacy Test: Direct Caregiver Access to Emergency Profile Endpoint ---');

    const directProfileRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, cgAToken);
    assert(directProfileRes.status === 403, `Caregiver direct access to /api/emergency-profile/my denied with 403 (got: ${directProfileRes.status})`);

    // ----------------------------------------------------
    // 8. TEST 17 & SECTION 6: NEW PATIENT / EMPTY PROFILE TEST
    // ----------------------------------------------------
    console.log('\n--- 8. TEST 17: New Patient Empty Profile SOS Test ---');

    // Register New Patient C (No consultations, no prescriptions, no medications, no emergency profile)
    const pCRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `New Patient C ${timestamp}`,
      email: `patientC_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9470${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pCRes.status === 201, 'New Patient C registered');
    const pCToken = pCRes.data.data.token;
    const pCId = pCRes.data.data.user._id;

    const createPCProfile = await req(`${BASE_URL}/patients/profile`, 'POST', {
      dateOfBirth: '1995-05-05',
      gender: 'female',
      bloodGroup: 'B+',
      address: '456 Sea View, Galle',
      emergencyContactName: 'Kamal Contact',
      emergencyContactPhone: '0779998888',
    }, pCToken);
    assert(createPCProfile.status === 201 || createPCProfile.status === 200, `Patient C profile created (status: ${createPCProfile.status}, msg: ${JSON.stringify(createPCProfile.data)})`);
    const pCLinkCode = createPCProfile.data.data.profile.caregiverLinkCode;

    // Register Caregiver C
    const cgCRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver C ${timestamp}`,
      email: `caregiverC_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9475${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'caregiver',
    });
    assert(cgCRes.status === 201, 'Caregiver C registered');
    const cgCToken = cgCRes.data.data.token;
    const cgCId = cgCRes.data.data.user._id;

    // Link Caregiver C to Patient C
    const linkCRes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode: pCLinkCode,
      relationship: 'Daughter',
    }, cgCToken);
    assert(linkCRes.status === 201 || linkCRes.status === 200, 'Caregiver C linked to Patient C');

    // Patient C triggers SOS
    const sosCRes = await req(`${BASE_URL}/emergency`, 'POST', {
      message: 'New patient needs assistance!',
    }, pCToken);
    assert(sosCRes.status === 201 && sosCRes.data.success, 'New Patient C SOS succeeded immediately');
    const alertC = sosCRes.data.data;

    // Caregiver C accesses emergency summary for New Patient C
    const summaryCRes = await req(
      `${BASE_URL}/caregiver/emergency-alerts/${alertC._id}/health-summary`,
      'GET',
      null,
      cgCToken
    );
    assert(summaryCRes.status === 200 && summaryCRes.data.success, 'Caregiver C retrieved summary for new patient (200 OK)');
    const summaryC = summaryCRes.data.emergencySummary;
    assert(summaryC.profileCompleted === false, 'Profile completed is FALSE for new patient');
    assert(summaryC.bloodGroup === 'Not provided', `Blood group is "Not provided" (got: ${summaryC.bloodGroup})`);
    assert(Array.isArray(summaryC.allergies) && summaryC.allergies.length === 0, 'Allergies is empty');
    assert(Array.isArray(summaryC.chronicConditions) && summaryC.chronicConditions.length === 0, 'Chronic conditions is empty');
    assert(Array.isArray(summaryC.currentMedications) && summaryC.currentMedications.length === 0, 'Current medications is empty');
    console.log('✅ TEST 17 Passed: New patient safe empty emergency summary displayed properly');

    // ----------------------------------------------------
    // 9. TEST 16: SOS FAILURE-SAFETY TEST (MANDATORY)
    // ----------------------------------------------------
    console.log('\n--- 9. TEST 16: SOS Failure-Safety Test (MANDATORY) ---');

    // Simulate emergency profile retrieval failure in getCaregiverEmergencyAlertHealthSummary
    // Patient C triggers SOS again (after resolving previous)
    await req(`${BASE_URL}/emergency/${alertC._id}/resolve`, 'PATCH', {}, cgCToken);

    const sosCFailover = await req(`${BASE_URL}/emergency`, 'POST', {
      message: 'Failover SOS test',
    }, pCToken);
    assert(sosCFailover.status === 201 && sosCFailover.data.success, 'Emergency alert STILL created during simulated conditions');
    const alertFailover = sosCFailover.data.data;
    assert(alertFailover.status === 'active', 'Emergency alert is ACTIVE');

    // Caregiver C receives SOS
    const alertsFailoverRes = await req(`${BASE_URL}/caregiver/emergency-alerts`, 'GET', null, cgCToken);
    assert(alertsFailoverRes.status === 200, 'Caregiver C STILL receives SOS alert');

    // Temporarily monkey-patch EmergencyHealthProfile.findOne to throw an error
    const originalFindOne = EmergencyHealthProfile.findOne;
    EmergencyHealthProfile.findOne = function () {
      throw new Error('Simulated Database Failure for Emergency Health Profile');
    };

    let controllerStatus = null;
    let controllerJson = null;

    const mockReq = {
      user: { _id: cgCId, role: 'caregiver' },
      params: { alertId: alertFailover._id.toString() },
    };
    const mockRes = {
      status: (code) => {
        controllerStatus = code;
        return {
          json: (data) => {
            controllerJson = data;
          },
        };
      },
    };

    await getCaregiverEmergencyAlertHealthSummary(mockReq, mockRes, (err) => {
      throw err;
    });

    // Restore original method
    EmergencyHealthProfile.findOne = originalFindOne;

    assert(controllerStatus === 200, `Failover summary returns 200 without crashing (got: ${controllerStatus})`);
    assert(controllerJson.success === true, 'Failover summary success is true');
    assert(controllerJson.emergencySummary.unavailable === true, 'emergencySummary.unavailable is true');
    assert(controllerJson.emergencySummary.message === 'Emergency information unavailable', 'Safe message displayed');
    console.log('✅ TEST 16 Passed: Emergency profile failure does NOT block SOS or crash caregiver view');

    console.log('\n====================================================');
    console.log('ALL PHASE 7.1 TESTS PASSED SUCCESSFULLY! 🎉');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('Test execution failed:', error);
    process.exit(1);
  }
}

runPhase71Tests();

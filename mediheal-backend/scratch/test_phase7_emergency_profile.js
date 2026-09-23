const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const PatientProfile = require('../src/models/PatientProfile');
const EmergencyHealthProfile = require('../src/models/EmergencyHealthProfile');
const Prescription = require('../src/models/Prescription');
const MedicationSchedule = require('../src/models/MedicationSchedule');

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

async function runPhase7EmergencyProfileTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 7: EMERGENCY HEALTH PROFILE TESTS');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediheal';
  await mongoose.connect(mongoUri);

  try {
    const timestamp = Date.now();

    // ----------------------------------------------------
    // SETUP USERS: PATIENT A, PATIENT B, DOCTOR A, NEW PATIENT C
    // ----------------------------------------------------
    console.log('--- 1. Setting up Test Users ---');

    // Register Patient A
    const pARes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Alpha ${timestamp}`,
      email: `patientA_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pARes.status === 201, `Patient A registered successfully (status: ${pARes.status})`);
    const pAToken = pARes.data.data.token;
    const pAId = pARes.data.data.user._id;

    // Register Patient B
    const pBRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Beta ${timestamp}`,
      email: `patientB_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pBRes.status === 201, 'Patient B registered successfully');
    const pBToken = pBRes.data.data.token;
    const pBId = pBRes.data.data.user._id;

    // Register Caregiver
    const cgRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver Saman ${timestamp}`,
      email: `caregiver_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'caregiver',
    });
    assert(cgRes.status === 201, 'Caregiver registered successfully');
    const cgToken = cgRes.data.data.token;
    const cgId = cgRes.data.data.user._id;

    // Admin login to create Doctor A
    const adminLogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'admin@mediheal.com',
      password: 'AdminPass123!',
    });
    assert(adminLogin.status === 200, 'Admin login succeeded');
    const adminToken = adminLogin.data.data.token;

    const docCreateRes = await req(
      `${BASE_URL}/admin/doctors`,
      'POST',
      {
        fullName: `Dr. Gamage ${timestamp}`,
        email: `doctorA_${timestamp}@mediheal.test`,
        password: 'Password123!',
        phoneNumber: `077${Math.floor(1000000 + Math.random() * 9000000)}`,
        specialization: 'General Physician',
        slmcNumber: `SLMC-E-${timestamp.toString().slice(-5)}`,
        hospital: 'National Hospital',
        consultationFee: 2500,
        yearsOfExperience: 10,
        availableDays: ['Monday', 'Tuesday'],
        availableTimeSlots: ['09:00', '10:00'],
      },
      adminToken
    );
    assert(docCreateRes.status === 201, 'Doctor A created by admin');
    const docId = docCreateRes.data.data.doctor.userId._id || docCreateRes.data.data.doctor.userId;

    const docLogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: `doctorA_${timestamp}@mediheal.test`,
      password: 'Password123!',
    });
    assert(docLogin.status === 200, 'Doctor A logged in');
    const docToken = docLogin.data.data.token;

    // Register Brand New Patient C (Never completed profile)
    const pCRes = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Charlie ${timestamp}`,
      email: `patientC_${timestamp}@mediheal.test`,
      password: 'Password123!',
      phoneNumber: `+9477${Math.floor(1000000 + Math.random() * 9000000)}`,
      role: 'patient',
    });
    assert(pCRes.status === 201, 'Patient C registered successfully');
    const pCToken = pCRes.data.data.token;

    // ----------------------------------------------------
    // TEST 26: EMPTY PROFILE TEST
    // ----------------------------------------------------
    console.log('\n--- 2. TEST 26: Empty Profile Test ---');
    const emptyCheck = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pCToken);
    assert(emptyCheck.status === 200, `GET empty profile returned 200 (status: ${emptyCheck.status})`);
    assert(emptyCheck.data.data === null, 'Profile data is null for uncompleted patient');
    assert(
      emptyCheck.data.message === 'Emergency profile not completed',
      `Correct message returned: "${emptyCheck.data.message}"`
    );
    console.log('PASS: Empty profile test passed with no fake health information.');

    // ----------------------------------------------------
    // TEST 22: CREATE PROFILE
    // ----------------------------------------------------
    console.log('\n--- 3. TEST 22: Create Profile Test ---');
    const createPayload = {
      bloodGroup: 'O+',
      allergies: ['Penicillin'],
      chronicConditions: ['Diabetes'],
      emergencyContact: {
        name: 'Nimal Perera',
        relationship: 'Father',
        phone: '0771234567',
      },
      emergencyNotes: 'Carries emergency glucose tablet in pocket',
    };

    const createRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', createPayload, pAToken);
    assert(createRes.status === 200, `Profile created/saved successfully (status: ${createRes.status})`);
    assert(createRes.data.success === true, 'Response indicates success: true');
    assert(createRes.data.data.bloodGroup === 'O+', 'Blood group saved as O+');
    assert(createRes.data.data.allergies.includes('Penicillin'), 'Allergies contains Penicillin');
    assert(createRes.data.data.chronicConditions.includes('Diabetes'), 'Chronic conditions contains Diabetes');
    assert(createRes.data.data.emergencyContact.name === 'Nimal Perera', 'Contact name matches');
    assert(createRes.data.data.emergencyContact.relationship === 'Father', 'Contact relationship matches');
    assert(createRes.data.data.emergencyContact.phone === '0771234567', 'Contact phone matches');
    assert(
      createRes.data.data.emergencyNotes === 'Carries emergency glucose tablet in pocket',
      'Emergency notes match'
    );
    assert(createRes.data.data.isCompleted === true, 'Profile is marked as completed');
    console.log('PASS: Profile creation test passed.');

    // Verify GET retrieves the newly created profile
    const getCreated = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pAToken);
    assert(getCreated.status === 200, 'GET retrieved created profile');
    assert(getCreated.data.data.bloodGroup === 'O+', 'GET confirms bloodGroup is O+');
    assert(getCreated.data.data.patient.fullName.includes('Patient Alpha'), 'Patient name correctly populated');

    // ----------------------------------------------------
    // TEST 23: UPDATE PROFILE (NO DUPLICATES)
    // ----------------------------------------------------
    console.log('\n--- 4. TEST 23: Update Profile Test ---');
    const updatePayload = {
      bloodGroup: 'AB-',
      allergies: ['Penicillin', 'Latex'],
      chronicConditions: ['Diabetes', 'Hypertension'],
      emergencyContact: {
        name: 'Sunil Perera',
        relationship: 'Brother',
        phone: '0719876543',
      },
      emergencyNotes: 'Updated emergency instructions',
    };

    const updateRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', updatePayload, pAToken);
    assert(updateRes.status === 200, 'Profile updated successfully');
    assert(updateRes.data.data.bloodGroup === 'AB-', 'Blood group updated to AB-');
    assert(updateRes.data.data.allergies.length === 2, 'Allergies now has 2 items');
    assert(updateRes.data.data.allergies.includes('Latex'), 'Allergies includes Latex');
    assert(updateRes.data.data.emergencyContact.name === 'Sunil Perera', 'Emergency contact name updated');
    assert(updateRes.data.data.emergencyContact.relationship === 'Brother', 'Relationship updated');

    // Ensure database has exactly ONE document for this patientId (no duplicate profiles)
    const profileDocs = await EmergencyHealthProfile.find({ patientId: pAId });
    assert(profileDocs.length === 1, `Exactly 1 emergency profile exists in DB for Patient A (count: ${profileDocs.length})`);
    console.log('PASS: Profile update test passed with zero duplicate records.');

    // ----------------------------------------------------
    // TEST 24: CURRENT MEDICATION AUTO-SYNC
    // ----------------------------------------------------
    console.log('\n--- 5. TEST 24: Current Medication Auto-Sync Test ---');
    // Initially Patient A should have 0 active medications
    assert(
      updateRes.data.data.currentMedications.length === 0,
      'Initially 0 active medications derived'
    );

    // Create active prescription for Patient A
    const prescription = await Prescription.create({
      patientId: pAId,
      doctorId: docId,
      diagnosis: 'Type 2 Diabetes Mellitus',
      medications: [
        {
          medicineName: 'Metformin',
          dosage: '500mg',
          frequency: 'Twice daily',
          duration: '14 days',
          instructions: 'Take with meals',
        },
      ],
      status: 'active',
    });

    // Create MedicationSchedule for next 7 days
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

    const schedule = await MedicationSchedule.create({
      prescriptionId: prescription._id,
      patientId: pAId,
      doctorId: docId,
      medicineName: 'Metformin',
      dosage: '500mg',
      frequency: 'Twice daily',
      scheduledTimes: ['08:00', '20:00'],
      duration: '14 days',
      startDate,
      endDate,
      instructions: 'Take with meals',
      adherenceRecords: [
        {
          scheduledDate: startDate,
          scheduledDateStr: startDate.toISOString().split('T')[0],
          dayNumber: 1,
          scheduledTime: '08:00',
          status: 'PENDING',
        },
      ],
    });

    // Call GET /api/emergency-profile/my -> Metformin should now automatically appear!
    const medSyncRes1 = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pAToken);
    assert(medSyncRes1.status === 200, 'GET emergency profile with active medication');
    const activeMeds = medSyncRes1.data.data.currentMedications;
    assert(activeMeds.length === 1, `Exactly 1 active medication derived (found: ${activeMeds.length})`);
    assert(activeMeds[0].medicineName === 'Metformin', `Derived medicine is Metformin (found: ${activeMeds[0].medicineName})`);
    assert(activeMeds[0].dosage === '500mg', `Derived dosage is 500mg (found: ${activeMeds[0].dosage})`);
    assert(activeMeds[0].frequency === 'Twice daily', `Derived frequency is Twice daily (found: ${activeMeds[0].frequency})`);
    console.log('PASS: Metformin 500mg automatically reflected in Emergency Health Profile.');

    // Now expire / deactivate the medication (simulate prescription ending or discontinued)
    // 1. Set prescription status to 'completed'
    prescription.status = 'completed';
    await prescription.save();

    const medSyncRes2 = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pAToken);
    assert(
      medSyncRes2.data.data.currentMedications.length === 0,
      'When prescription is completed, medication automatically disappears from active list'
    );

    // Also test by setting endDate in the past
    prescription.status = 'active';
    await prescription.save();
    schedule.endDate = new Date(startDate.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    await schedule.save();

    const medSyncRes3 = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pAToken);
    assert(
      medSyncRes3.data.data.currentMedications.length === 0,
      'When schedule endDate is in the past, medication automatically disappears from active list'
    );
    console.log('PASS: Current medication expiration/deactivation auto-sync test passed.');

    // ----------------------------------------------------
    // TEST 25: SECURITY & ACCESS CONTROL
    // ----------------------------------------------------
    console.log('\n--- 6. TEST 25: Security & Access Control Test ---');

    // 1. Unauthenticated request -> must return 401
    const unauthRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET');
    assert(unauthRes.status === 401, `Unauthenticated request blocked with 401 (status: ${unauthRes.status})`);

    // 2. Doctor attempting to access patient emergency profile endpoint -> must return 403 (patient only)
    const doctorAccessRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, docToken);
    assert(doctorAccessRes.status === 403, `Doctor role blocked with 403 (status: ${doctorAccessRes.status})`);

    // Caregiver attempting to access /my -> must return 403 (patient only)
    const caregiverAccessRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, cgToken);
    assert(caregiverAccessRes.status === 403, `Caregiver role blocked with 403 (status: ${caregiverAccessRes.status})`);

    // 3. Patient B creates their own profile
    const pBProfilePayload = {
      bloodGroup: 'B+',
      allergies: ['Peanuts'],
      chronicConditions: ['Asthma'],
      emergencyContact: {
        name: 'Kamal Perera',
        relationship: 'Uncle',
        phone: '0779998888',
      },
    };
    const pBCreateRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', pBProfilePayload, pBToken);
    assert(pBCreateRes.status === 200, 'Patient B profile saved');

    // Patient A calls /my -> gets Patient A data, NOT Patient B data
    const pAGetRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pAToken);
    assert(pAGetRes.data.data.patient.id === pAId, 'Patient A receives only Patient A data');
    assert(pAGetRes.data.data.bloodGroup === 'AB-', 'Patient A receives their own blood group (AB-)');

    // Patient B calls /my -> gets Patient B data, NOT Patient A data
    const pBGetRes = await req(`${BASE_URL}/emergency-profile/my`, 'GET', null, pBToken);
    assert(pBGetRes.data.data.patient.id === pBId, 'Patient B receives only Patient B data');
    assert(pBGetRes.data.data.bloodGroup === 'B+', 'Patient B receives their own blood group (B+)');
    assert(pBGetRes.data.data.allergies.includes('Peanuts'), 'Patient B allergies isolated');
    console.log('PASS: Security & patient data isolation passed.');

    // ----------------------------------------------------
    // TEST: BLOOD GROUP VALIDATION
    // ----------------------------------------------------
    console.log('\n--- 7. Blood Group Validation Test ---');
    const invalidBgRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', { bloodGroup: 'Z+' }, pAToken);
    assert(invalidBgRes.status === 400, `Invalid blood group 'Z+' rejected with 400 (status: ${invalidBgRes.status})`);
    console.log('PASS: Invalid blood group correctly rejected.');

    // ----------------------------------------------------
    // TEST: "NO KNOWN ALLERGIES" DISTINCTION
    // ----------------------------------------------------
    console.log('\n--- 8. "No Known Allergies" Distinction Test ---');
    const noKnownAllergiesPayload = {
      hasNoKnownAllergies: true,
      allergies: ['No known allergies'],
    };
    const nkaRes = await req(`${BASE_URL}/emergency-profile/my`, 'PUT', noKnownAllergiesPayload, pAToken);
    assert(nkaRes.status === 200, 'No known allergies saved');
    assert(nkaRes.data.data.hasNoKnownAllergies === true, 'hasNoKnownAllergies is true');

    console.log('\n====================================================');
    console.log('ALL PHASE 7 EMERGENCY HEALTH PROFILE TESTS PASSED!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase7EmergencyProfileTests();

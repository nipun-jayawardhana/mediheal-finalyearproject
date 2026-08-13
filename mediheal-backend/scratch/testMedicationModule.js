const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(payload && { 'Content-Length': Buffer.byteLength(payload) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runMedicationTests() {
  console.log('=== STARTING MEDICATION MODULE AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Register & Login Patient 1
  const pat1Email = `pat_med1_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Saman Jayawardena',
    email: pat1Email,
    phoneNumber: '+94771122990',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const pat1Login = await makeRequest('/api/auth/login', 'POST', {
    email: pat1Email,
    password: 'PatientPass123!',
  });
  const tokenPat1 = pat1Login.data?.data?.token;
  const pat1Id = pat1Login.data?.data?.user?._id;

  // 2. Register & Login Caregiver
  const cgEmail = `cg_med_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Caregiver Nimal',
    email: cgEmail,
    phoneNumber: '+94775554433',
    password: 'CaregiverPass123!',
    role: 'caregiver',
  });
  const cgLogin = await makeRequest('/api/auth/login', 'POST', {
    email: cgEmail,
    password: 'CaregiverPass123!',
  });
  const tokenCg = cgLogin.data?.data?.token;

  // 3. Register & Login Patient 2 (Empty state test)
  const pat2Email = `pat_med2_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Empty Patient',
    email: pat2Email,
    phoneNumber: '+94778887766',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const pat2Login = await makeRequest('/api/auth/login', 'POST', {
    email: pat2Email,
    password: 'PatientPass123!',
  });
  const tokenPat2 = pat2Login.data?.data?.token;

  // TEST 1: Empty State (Patient 2 has no medications)
  console.log('--- TEST 1: Patient Empty State ---');
  const emptyMedsRes = await makeRequest('/api/medications/my', 'GET', null, tokenPat2);
  console.log(`Status: ${emptyMedsRes.status}, Count: ${emptyMedsRes.data?.count}`);
  console.log(`PASS: ${emptyMedsRes.status === 200 && emptyMedsRes.data?.count === 0}\n`);

  // Create Patient 1 Profile to generate caregiverLinkCode
  const patProfileRes = await makeRequest('/api/patients/profile', 'POST', {
    dateOfBirth: '1955-08-10',
    gender: 'male',
    bloodGroup: 'B+',
    address: '45 Temple Road, Kandy',
    emergencyContactName: 'Kamal Jayasinghe',
    emergencyContactPhone: '0771122334',
    medicalConditions: ['Hypertension'],
    allergies: ['Penicillin'],
  }, tokenPat1);
  const linkCode = patProfileRes.data?.data?.profile?.caregiverLinkCode || patProfileRes.data?.data?.caregiverLinkCode;

  await makeRequest('/api/caregivers/link', 'POST', {
    caregiverLinkCode: linkCode,
    relationship: 'Son',
  }, tokenCg);

  // Caregiver adds medication for Patient 1
  const addMedRes = await makeRequest('/api/medications', 'POST', {
    patientId: pat1Id,
    medicineName: 'Amlodipine 5mg',
    dosage: '5mg - 1 Tablet',
    frequency: 'Daily',
    timeSlots: ['08:00', '20:00'],
    startDate: '2026-08-01',
    endDate: '2026-12-31',
    instructions: 'Blood Pressure - Take after breakfast',
  }, tokenCg);

  const medicationId = addMedRes.data?.data?._id;
  console.log(`Created Medication ID: ${medicationId}`);

  // TEST 2: Patient Medication List (GET /api/medications/my)
  console.log('--- TEST 2: Patient Medication List (GET /api/medications/my) ---');
  const myMedsRes = await makeRequest('/api/medications/my', 'GET', null, tokenPat1);
  console.log(`Status: ${myMedsRes.status}, Count: ${myMedsRes.data?.count}`);
  console.log(`Medicine: ${myMedsRes.data?.data?.[0]?.medicineName}`);
  console.log(`PASS: ${myMedsRes.status === 200 && myMedsRes.data?.count === 1}\n`);

  // TEST 3: Mark Dose Taken (POST /api/medications/:id/taken)
  console.log('--- TEST 3: Mark Dose as Taken ---');
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayIso = `${year}-${month}-${day}`;
  const slotToMark = '08:00';

  const markTakenRes = await makeRequest(`/api/medications/${medicationId}/taken`, 'POST', {
    scheduledDate: todayIso,
    scheduledTime: slotToMark,
  }, tokenPat1);

  console.log(`Status: ${markTakenRes.status}, Message: ${markTakenRes.data?.message}`);
  console.log(`Log status: ${markTakenRes.data?.data?.status}`);
  console.log(`PASS: ${markTakenRes.status === 200 && markTakenRes.data?.data?.status === 'taken'}\n`);

  // TEST 4: Duplicate Taken Prevention
  console.log('--- TEST 4: Duplicate Taken Prevention ---');
  const dupTakenRes = await makeRequest(`/api/medications/${medicationId}/taken`, 'POST', {
    scheduledDate: todayIso,
    scheduledTime: slotToMark,
  }, tokenPat1);
  console.log(`Status: ${dupTakenRes.status}, Message: ${dupTakenRes.data?.message}`);
  console.log(`PASS: ${dupTakenRes.status === 400 && dupTakenRes.data?.message?.includes('already')}\n`);

  // TEST 5: Date Range Validation (Outside startDate to endDate)
  console.log('--- TEST 5: Date Range Validation ---');
  const outRangeRes = await makeRequest(`/api/medications/${medicationId}/taken`, 'POST', {
    scheduledDate: '2020-01-01',
    scheduledTime: slotToMark,
  }, tokenPat1);
  console.log(`Status: ${outRangeRes.status}, Message: ${outRangeRes.data?.message}`);
  console.log(`PASS: ${outRangeRes.status === 400 && outRangeRes.data?.message?.includes('outside')}\n`);

  // TEST 6: Get Medication Logs (GET /api/medications/my/logs)
  console.log('--- TEST 6: Patient Medication Logs (GET /api/medications/my/logs) ---');
  const logsRes = await makeRequest('/api/medications/my/logs', 'GET', null, tokenPat1);
  console.log(`Status: ${logsRes.status}, Count: ${logsRes.data?.count}`);
  console.log(`Logged status: ${logsRes.data?.data?.[0]?.status}`);
  console.log(`PASS: ${logsRes.status === 200 && logsRes.data?.count === 1}\n`);

  // TEST 7: Role Protection (Unauthenticated)
  console.log('--- TEST 7: Role Protection (Unauthenticated) ---');
  const unauthRes = await makeRequest('/api/medications/my', 'GET', null, null);
  console.log(`Status: ${unauthRes.status}`);
  console.log(`PASS: ${unauthRes.status === 401}\n`);

  console.log('=== MEDICATION MODULE AUDIT COMPLETE ===');
}

runMedicationTests().catch(console.error);

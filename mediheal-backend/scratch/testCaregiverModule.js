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

async function runCaregiverTests() {
  console.log('=== STARTING CAREGIVER FRONTEND & BACKEND AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Register & Login Patient
  const patientEmail = `patient_cg_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Kamala Wijesinghe',
    email: patientEmail,
    phoneNumber: '+94771234567',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: patientEmail,
    password: 'PatientPass123!',
  });
  const tokenPatient = patLoginRes.data?.data?.token;

  // Create Patient Profile to get caregiverLinkCode
  const profileRes = await makeRequest('/api/patients/profile', 'POST', {
    dateOfBirth: '1948-05-12',
    gender: 'female',
    bloodGroup: 'O+',
    address: 'No 45, Galle Road, Colombo 03',
    emergencyContactName: 'Sunil Wijesinghe',
    emergencyContactPhone: '+94779988776',
    medicalConditions: ['Hypertension', 'Type 2 Diabetes'],
    allergies: ['Penicillin'],
  }, tokenPatient);
  const linkCode = profileRes.data?.data?.profile?.caregiverLinkCode;
  const patientId = patLoginRes.data?.data?.user?._id;
  console.log(`Patient Created ID: ${patientId}, Link Code: ${linkCode}`);

  // 2. Register & Login Caregiver
  const caregiverEmail = `caregiver_cg_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Sunil Wijesinghe',
    email: caregiverEmail,
    phoneNumber: '+94779988776',
    password: 'CaregiverPass123!',
    role: 'caregiver',
  });
  const cgLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: caregiverEmail,
    password: 'CaregiverPass123!',
  });
  const tokenCaregiver = cgLoginRes.data?.data?.token;
  console.log(`Caregiver Created & Logged In. Token present: ${!!tokenCaregiver}\n`);

  // TEST 1: Get Linked Patients (Initial empty list)
  console.log('--- TEST 1: Initial Linked Patients (GET /api/caregivers/patients) ---');
  const initPatientsRes = await makeRequest('/api/caregivers/patients', 'GET', null, tokenCaregiver);
  console.log(`Status: ${initPatientsRes.status}, Count: ${initPatientsRes.data?.count}`);
  console.log(`PASS: ${initPatientsRes.status === 200 && initPatientsRes.data?.count === 0}\n`);

  // TEST 2: Invalid Link Code Error Handling
  console.log('--- TEST 2: Invalid Link Code (POST /api/caregivers/link) ---');
  const invalidLinkRes = await makeRequest('/api/caregivers/link', 'POST', {
    caregiverLinkCode: 'INVALID999',
    relationship: 'Son',
  }, tokenCaregiver);
  console.log(`Status: ${invalidLinkRes.status}, Message: ${invalidLinkRes.data?.message}`);
  console.log(`PASS: ${invalidLinkRes.status === 404}\n`);

  // TEST 3: Link Patient Success
  console.log('--- TEST 3: Link Patient (POST /api/caregivers/link) ---');
  const linkRes = await makeRequest('/api/caregivers/link', 'POST', {
    caregiverLinkCode: linkCode,
    relationship: 'Son',
  }, tokenCaregiver);
  console.log(`Status: ${linkRes.status}, Message: ${linkRes.data?.message}`);
  console.log(`Linked Patient Name: ${linkRes.data?.data?.patient?.fullName}`);
  console.log(`PASS: ${linkRes.status === 201 && linkRes.data?.data?.relationship === 'Son'}\n`);

  // TEST 4: Duplicate Link Error Handling
  console.log('--- TEST 4: Duplicate Link Attempt (POST /api/caregivers/link) ---');
  const dupLinkRes = await makeRequest('/api/caregivers/link', 'POST', {
    caregiverLinkCode: linkCode,
    relationship: 'Son',
  }, tokenCaregiver);
  console.log(`Status: ${dupLinkRes.status}, Message: ${dupLinkRes.data?.message}`);
  console.log(`PASS: ${dupLinkRes.status === 400}\n`);

  // TEST 5: Detailed Patient Overview for Caregiver
  console.log('--- TEST 5: Patient Overview (GET /api/caregivers/patients/:patientId) ---');
  const overviewRes = await makeRequest(`/api/caregivers/patients/${patientId}`, 'GET', null, tokenCaregiver);
  console.log(`Status: ${overviewRes.status}`);
  console.log(`Patient Name: ${overviewRes.data?.data?.patient?.fullName}`);
  console.log(`Blood Group: ${overviewRes.data?.data?.patientProfile?.bloodGroup}`);
  console.log(`PASS: ${overviewRes.status === 200 && overviewRes.data?.data?.patient?._id === patientId}\n`);

  // TEST 6: Add Medication for Patient
  console.log('--- TEST 6: Add Medication (POST /api/medications) ---');
  const addMedRes = await makeRequest('/api/medications', 'POST', {
    patientId,
    medicineName: 'Amlodipine 5mg',
    dosage: '5mg - 1 Tablet',
    frequency: 'Daily',
    timeSlots: ['08:00', '20:00'],
    startDate: '2026-08-15',
    endDate: '2026-11-15',
    instructions: 'Take after breakfast with water',
  }, tokenCaregiver);
  const medId = addMedRes.data?.data?._id;
  console.log(`Status: ${addMedRes.status}, Med ID: ${medId}`);
  console.log(`PASS: ${addMedRes.status === 201 && !!medId}\n`);

  // TEST 7: Edit Medication
  console.log('--- TEST 7: Edit Medication (PUT /api/medications/:id) ---');
  const editMedRes = await makeRequest(`/api/medications/${medId}`, 'PUT', {
    dosage: '10mg - 1 Tablet',
    frequency: 'Morning Only',
  }, tokenCaregiver);
  console.log(`Status: ${editMedRes.status}, New Dosage: ${editMedRes.data?.data?.dosage}`);
  console.log(`PASS: ${editMedRes.status === 200 && editMedRes.data?.data?.dosage === '10mg - 1 Tablet'}\n`);

  // TEST 8: Deactivate Medication
  console.log('--- TEST 8: Deactivate Medication (DELETE /api/medications/:id) ---');
  const deactMedRes = await makeRequest(`/api/medications/${medId}`, 'DELETE', null, tokenCaregiver);
  console.log(`Status: ${deactMedRes.status}, isActive: ${deactMedRes.data?.data?.isActive}`);
  console.log(`PASS: ${deactMedRes.status === 200 && deactMedRes.data?.data?.isActive === false}\n`);

  // TEST 9: Emergency Alert Creation (Patient) & Caregiver Retrieval
  console.log('--- TEST 9: Emergency SOS Alert (GET /api/caregivers/emergency-alerts) ---');
  const sosTriggerRes = await makeRequest('/api/emergency', 'POST', {
    latitude: 6.9271,
    longitude: 79.8612,
    message: 'SOS triggered by elder Kamala Wijesinghe',
  }, tokenPatient);
  const alertId = sosTriggerRes.data?.data?._id;
  console.log(`Patient Triggered SOS Alert ID: ${alertId}`);

  const cgAlertsRes = await makeRequest('/api/caregivers/emergency-alerts', 'GET', null, tokenCaregiver);
  console.log(`Caregiver Alerts Count: ${cgAlertsRes.data?.count}`);
  console.log(`First Alert Status: ${cgAlertsRes.data?.data?.[0]?.status}`);
  console.log(`PASS: ${cgAlertsRes.status === 200 && cgAlertsRes.data?.count >= 1}\n`);

  // TEST 10: Resolve Emergency Alert (Caregiver)
  console.log('--- TEST 10: Resolve Emergency Alert (PATCH /api/emergency/:id/resolve) ---');
  const resolveRes = await makeRequest(`/api/emergency/${alertId}/resolve`, 'PATCH', null, tokenCaregiver);
  console.log(`Status: ${resolveRes.status}, Message: ${resolveRes.data?.message}`);
  console.log(`Resolved Alert Status: ${resolveRes.data?.data?.status}`);
  console.log(`PASS: ${resolveRes.status === 200 && resolveRes.data?.data?.status === 'resolved'}\n`);

  // TEST 11: Remove Patient Link
  console.log('--- TEST 11: Remove Patient Link (DELETE /api/caregivers/patients/:id/link) ---');
  const removeLinkRes = await makeRequest(`/api/caregivers/patients/${patientId}/link`, 'DELETE', null, tokenCaregiver);
  console.log(`Status: ${removeLinkRes.status}, Message: ${removeLinkRes.data?.message}`);
  console.log(`PASS: ${removeLinkRes.status === 200}\n`);

  // TEST 12: Access Denial after Unlinking
  console.log('--- TEST 12: Access Denial after Unlink (GET /api/caregivers/patients/:id) ---');
  const deniedRes = await makeRequest(`/api/caregivers/patients/${patientId}`, 'GET', null, tokenCaregiver);
  console.log(`Status: ${deniedRes.status}, Message: ${deniedRes.data?.message}`);
  console.log(`PASS: ${deniedRes.status === 403}\n`);

  console.log('=== CAREGIVER FRONTEND & BACKEND AUDIT COMPLETE ===');
}

runCaregiverTests().catch(console.error);

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

async function runEmergencyTests() {
  console.log('=== STARTING EMERGENCY SOS MODULE AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Register & Login Patient
  const patEmail = `pat_sos_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Kamal Perera',
    email: patEmail,
    phoneNumber: '+94771199887',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patLogin = await makeRequest('/api/auth/login', 'POST', {
    email: patEmail,
    password: 'PatientPass123!',
  });
  const tokenPat = patLogin.data?.data?.token;

  // Create Patient Profile
  const patProfileRes = await makeRequest('/api/patients/profile', 'POST', {
    dateOfBirth: '1958-04-12',
    gender: 'male',
    bloodGroup: 'O+',
    address: '12 Beach Road, Galle',
    emergencyContactName: 'Nimali Perera',
    emergencyContactPhone: '0773344556',
    medicalConditions: ['Asthma'],
  }, tokenPat);
  const linkCode = patProfileRes.data?.data?.caregiverLinkCode || patProfileRes.data?.data?.profile?.caregiverLinkCode;

  // 2. Register & Login Caregiver
  const cgEmail = `cg_sos_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Nimali Perera',
    email: cgEmail,
    phoneNumber: '+94773344556',
    password: 'CaregiverPass123!',
    role: 'caregiver',
  });
  const cgLogin = await makeRequest('/api/auth/login', 'POST', {
    email: cgEmail,
    password: 'CaregiverPass123!',
  });
  const tokenCg = cgLogin.data?.data?.token;

  // Link Caregiver to Patient
  await makeRequest('/api/caregivers/link', 'POST', {
    caregiverLinkCode: linkCode,
    relationship: 'Daughter',
  }, tokenCg);

  // TEST 1: Create Emergency Alert (Patient)
  console.log('--- TEST 1: Create Emergency Alert (POST /api/emergency) ---');
  const createRes = await makeRequest('/api/emergency', 'POST', {
    message: 'Emergency SOS triggered by patient from mobile app',
  }, tokenPat);

  console.log(`Status: ${createRes.status}, Message: ${createRes.data?.message}`);
  const alertId = createRes.data?.data?._id;
  console.log(`Alert ID: ${alertId}`);
  console.log(`Emergency Contact Name: ${createRes.data?.data?.emergencyContactName}`);
  console.log(`PASS: ${createRes.status === 201 && !!alertId}\n`);

  // TEST 2: Patient Get Own Emergency Alerts (GET /api/emergency/my)
  console.log('--- TEST 2: Patient Emergency List (GET /api/emergency/my) ---');
  const myAlertsRes = await makeRequest('/api/emergency/my', 'GET', null, tokenPat);
  console.log(`Status: ${myAlertsRes.status}, Count: ${myAlertsRes.data?.count}`);
  const activeAlert = myAlertsRes.data?.data?.find(a => a.status === 'active');
  console.log(`Active Alert Found: ${!!activeAlert}`);
  console.log(`PASS: ${myAlertsRes.status === 200 && activeAlert?._id === alertId}\n`);

  // TEST 3: Caregiver Visibility (GET /api/caregivers/emergency-alerts)
  console.log('--- TEST 3: Caregiver Alert Retrieval (GET /api/caregivers/emergency-alerts) ---');
  const cgAlertsRes = await makeRequest('/api/caregivers/emergency-alerts', 'GET', null, tokenCg);
  console.log(`Status: ${cgAlertsRes.status}, Count: ${cgAlertsRes.data?.count}`);
  console.log(`Patient Name in Alert: ${cgAlertsRes.data?.data?.[0]?.patientId?.fullName}`);
  console.log(`PASS: ${cgAlertsRes.status === 200 && cgAlertsRes.data?.count === 1}\n`);

  // TEST 4: Get Emergency Alert by ID (GET /api/emergency/:id)
  console.log('--- TEST 4: Get Emergency Alert by ID ---');
  const getByIdRes = await makeRequest(`/api/emergency/${alertId}`, 'GET', null, tokenPat);
  console.log(`Status: ${getByIdRes.status}, Message: ${getByIdRes.data?.data?.message}`);
  console.log(`PASS: ${getByIdRes.status === 200 && getByIdRes.data?.data?._id === alertId}\n`);

  // TEST 5: Caregiver Resolves Alert (PATCH /api/emergency/:id/resolve)
  console.log('--- TEST 5: Caregiver Resolves Emergency Alert ---');
  const resolveRes = await makeRequest(`/api/emergency/${alertId}/resolve`, 'PATCH', null, tokenCg);
  console.log(`Status: ${resolveRes.status}, Message: ${resolveRes.data?.message}`);
  console.log(`New Status: ${resolveRes.data?.data?.status}`);
  console.log(`PASS: ${resolveRes.status === 200 && resolveRes.data?.data?.status === 'resolved'}\n`);

  // TEST 6: Patient Cancel Alert (Create a new alert and patient cancels it)
  console.log('--- TEST 6: Patient Cancels Emergency Alert ---');
  const create2Res = await makeRequest('/api/emergency', 'POST', {
    message: 'Test cancellation alert',
  }, tokenPat);
  const alert2Id = create2Res.data?.data?._id;

  const cancelRes = await makeRequest(`/api/emergency/${alert2Id}/cancel`, 'PATCH', {
    reason: 'False alarm by patient',
  }, tokenPat);
  console.log(`Status: ${cancelRes.status}, Message: ${cancelRes.data?.message}`);
  console.log(`Cancelled Status: ${cancelRes.data?.data?.status}`);
  console.log(`PASS: ${cancelRes.status === 200 && cancelRes.data?.data?.status === 'cancelled'}\n`);

  // TEST 7: Role Protection (Unauthenticated access blocked)
  console.log('--- TEST 7: Role Protection (Unauthenticated) ---');
  const unauthRes = await makeRequest('/api/emergency/my', 'GET', null, null);
  console.log(`Status: ${unauthRes.status}`);
  console.log(`PASS: ${unauthRes.status === 401}\n`);

  console.log('=== EMERGENCY SOS MODULE AUDIT COMPLETE ===');
}

runEmergencyTests().catch(console.error);

const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(path, method = 'GET', data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = data ? JSON.stringify(data) : null;

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
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

async function runEmergencyTests() {
  console.log('--- STARTING EMERGENCY SOS MODULE SECURITY & FUNCTIONAL TESTS ---\n');

  // Setup Users
  const timestamp = Date.now();
  
  // 1. Patient 1 (with profile)
  const patient1Res = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Patient One Emergency',
    email: `p1_emerg_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'patient',
    phoneNumber: '+94771111111',
  });
  const tokenP1 = patient1Res.data?.data?.token;

  // Create Patient Profile for P1
  const p1ProfileRes = await makeRequest(
    '/api/patients/profile',
    'POST',
    {
      dateOfBirth: '1990-05-15',
      gender: 'male',
      bloodGroup: 'O+',
      address: '123 Main Street, Colombo',
      emergencyContactName: 'Nimali Perera',
      emergencyContactPhone: '0712345678',
    },
    tokenP1
  );
  const linkCodeP1 = p1ProfileRes.data?.data?.profile?.caregiverLinkCode;

  // 2. Patient 2 (without linked caregiver)
  const patient2Res = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Patient Two Emergency',
    email: `p2_emerg_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'patient',
    phoneNumber: '+94772222222',
  });
  const tokenP2 = patient2Res.data?.data?.token;

  // 3. Caregiver 1 (Linked to Patient 1)
  const caregiver1Res = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Caregiver Linked',
    email: `c1_linked_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'caregiver',
    phoneNumber: '+94773333333',
  });
  const tokenC1 = caregiver1Res.data?.data?.token;

  // Link Caregiver 1 to Patient 1
  await makeRequest(
    '/api/caregivers/link',
    'POST',
    { caregiverLinkCode: linkCodeP1, relationship: 'Daughter' },
    tokenC1
  );

  // 4. Caregiver 2 (Unlinked)
  const caregiver2Res = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Caregiver Unlinked',
    email: `c2_unlinked_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'caregiver',
    phoneNumber: '+94774444444',
  });
  const tokenC2 = caregiver2Res.data?.data?.token;

  // 5. Admin Login
  const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLoginRes.data?.data?.token;

  // 6. Doctor creation via Admin
  const docCreateRes = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Emergency Tester',
      email: `doc_emerg_${timestamp}@mediheal.com`,
      phoneNumber: '+94775555555',
      slmcNumber: `SLMC_${timestamp}`,
      specialization: 'General Physician',
      hospital: 'Colombo National Hospital',
      password: 'DoctorPass123!',
    },
    tokenAdmin
  );

  // Login Doctor
  const docLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: `doc_emerg_${timestamp}@mediheal.com`,
    password: 'DoctorPass123!',
  });
  const tokenDoc = docLoginRes.data?.data?.token;

  console.log('Setup users, doctor, admin & caregiver link: COMPLETED\n');

  // TEST 1: Patient can create an alert with GPS
  const create1 = await makeRequest(
    '/api/emergency',
    'POST',
    {
      latitude: 6.9271,
      longitude: 79.8612,
      message: 'I am feeling very unwell and need assistance.',
    },
    tokenP1
  );
  console.log('TEST 1. Patient create alert with GPS:', create1.status === 201 ? 'PASSED' : 'FAILED');
  const alert1 = create1.data?.data;

  // TEST 2: Alert automatically stores emergency contact info from PatientProfile
  const test2Pass = alert1?.emergencyContactName === 'Nimali Perera' && alert1?.emergencyContactPhone === '0712345678';
  console.log('TEST 2. Auto-store emergency contact info:', test2Pass ? 'PASSED' : 'FAILED', `Name: ${alert1?.emergencyContactName}`);

  // TEST 3: Linked caregiver IDs are associated with alert
  const test3Pass = Array.isArray(alert1?.caregiverIds) && alert1.caregiverIds.length > 0;
  console.log('TEST 3. Associated linked caregiver IDs:', test3Pass ? 'PASSED' : 'FAILED', `Count: ${alert1?.caregiverIds?.length}`);

  // TEST 4: Create alert without GPS (optional location)
  const create2 = await makeRequest(
    '/api/emergency',
    'POST',
    { message: 'I need urgent assistance.' },
    tokenP1
  );
  console.log('TEST 4. Create alert without GPS:', create2.status === 201 ? 'PASSED' : 'FAILED', `Lat: ${create2.data?.data?.latitude}`);
  const alert2 = create2.data?.data;

  // TEST 5: Patient can view own alerts
  const viewMy = await makeRequest('/api/emergency/my', 'GET', null, tokenP1);
  console.log('TEST 5. Patient view own alerts:', viewMy.status === 200 && viewMy.data?.count >= 2 ? 'PASSED' : 'FAILED');

  // TEST 6: Patient 2 cannot view Patient 1 alert
  const viewP2 = await makeRequest(`/api/emergency/${alert1._id}`, 'GET', null, tokenP2);
  console.log('TEST 6. Patient 2 cannot view Patient 1 alert:', viewP2.status === 403 ? 'PASSED' : 'FAILED', viewP2.data?.message);

  // TEST 7: Linked Caregiver 1 can view Patient 1 alert
  const viewC1 = await makeRequest(`/api/emergency/${alert1._id}`, 'GET', null, tokenC1);
  console.log('TEST 7. Linked Caregiver 1 view alert:', viewC1.status === 200 ? 'PASSED' : 'FAILED');

  // TEST 8: Unlinked Caregiver 2 cannot view Patient 1 alert
  const viewC2 = await makeRequest(`/api/emergency/${alert1._id}`, 'GET', null, tokenC2);
  console.log('TEST 8. Unlinked Caregiver 2 cannot view alert:', viewC2.status === 403 ? 'PASSED' : 'FAILED', viewC2.data?.message);

  // TEST 9: Caregiver 1 can list emergency alerts for linked patients
  const listC1Alerts = await makeRequest('/api/caregivers/emergency-alerts?status=active', 'GET', null, tokenC1);
  console.log('TEST 9. Caregiver emergency alerts query:', listC1Alerts.status === 200 && listC1Alerts.data?.count >= 2 ? 'PASSED' : 'FAILED');

  // TEST 10: Unlinked Caregiver 2 cannot resolve Patient 1 alert
  const resolveC2 = await makeRequest(`/api/emergency/${alert1._id}/resolve`, 'PATCH', null, tokenC2);
  console.log('TEST 10. Unlinked Caregiver cannot resolve alert:', resolveC2.status === 403 ? 'PASSED' : 'FAILED', resolveC2.data?.message);

  // TEST 11: Linked Caregiver 1 can resolve active alert (alert1)
  const resolveC1 = await makeRequest(`/api/emergency/${alert1._id}/resolve`, 'PATCH', null, tokenC1);
  console.log('TEST 11. Linked Caregiver resolve alert:', resolveC1.status === 200 && resolveC1.data?.data?.status === 'resolved' ? 'PASSED' : 'FAILED');

  // TEST 12: Patient 2 cannot cancel Patient 1 alert (alert2)
  const cancelP2 = await makeRequest(`/api/emergency/${alert2._id}/cancel`, 'PATCH', { reason: 'malicious' }, tokenP2);
  console.log('TEST 12. Patient 2 cannot cancel Patient 1 alert:', cancelP2.status === 403 ? 'PASSED' : 'FAILED');

  // TEST 13: Resolved alert cannot be cancelled
  const cancelResolved = await makeRequest(`/api/emergency/${alert1._id}/cancel`, 'PATCH', { reason: 'try cancel' }, tokenP1);
  console.log('TEST 13. Resolved alert cannot be cancelled:', cancelResolved.status === 400 ? 'PASSED' : 'FAILED', cancelResolved.data?.message);

  // TEST 14: Patient 1 can cancel own active alert (alert2)
  const cancelP1 = await makeRequest(`/api/emergency/${alert2._id}/cancel`, 'PATCH', { reason: 'Activated accidentally.' }, tokenP1);
  console.log('TEST 14. Patient 1 cancel own active alert:', cancelP1.status === 200 && cancelP1.data?.data?.status === 'cancelled' ? 'PASSED' : 'FAILED');

  // TEST 15: Cancelled alert cannot be resolved
  const resolveCancelled = await makeRequest(`/api/emergency/${alert2._id}/resolve`, 'PATCH', null, tokenC1);
  console.log('TEST 15. Cancelled alert cannot be resolved:', resolveCancelled.status === 400 ? 'PASSED' : 'FAILED', resolveCancelled.data?.message);

  // TEST 16: Invalid latitude rejected (150)
  const badLat = await makeRequest('/api/emergency', 'POST', { latitude: 150, longitude: 79.8612, message: 'Emergency' }, tokenP1);
  console.log('TEST 16. Invalid latitude rejected:', badLat.status === 400 ? 'PASSED' : 'FAILED', badLat.data?.message);

  // TEST 17: Invalid longitude rejected (-200)
  const badLng = await makeRequest('/api/emergency', 'POST', { latitude: 6.9, longitude: -200, message: 'Emergency' }, tokenP1);
  console.log('TEST 17. Invalid longitude rejected:', badLng.status === 400 ? 'PASSED' : 'FAILED', badLng.data?.message);

  // TEST 18: Missing message rejected
  const missingMsg = await makeRequest('/api/emergency', 'POST', { latitude: 6.9 }, tokenP1);
  console.log('TEST 18. Missing message rejected:', missingMsg.status === 400 ? 'PASSED' : 'FAILED', missingMsg.data?.message);

  // TEST 19: Invalid ObjectId rejected
  const badId = await makeRequest('/api/emergency/invalid_id_123', 'GET', null, tokenP1);
  console.log('TEST 19. Invalid MongoDB ID rejected:', badId.status === 400 ? 'PASSED' : 'FAILED', badId.data?.message);

  // TEST 20: Missing token rejected
  const noToken = await makeRequest('/api/emergency/my', 'GET', null, null);
  console.log('TEST 20. Missing token rejected:', noToken.status === 401 ? 'PASSED' : 'FAILED', noToken.data?.message);

  // TEST 21: Doctor role cannot create emergency alert
  const docCreate = await makeRequest('/api/emergency', 'POST', { message: 'Doc test' }, tokenDoc);
  console.log('TEST 21. Doctor role cannot create emergency alert:', docCreate.status === 403 ? 'PASSED' : 'FAILED', docCreate.data?.message);

  // TEST 22: Admin role cannot create emergency alert
  const adminCreate = await makeRequest('/api/emergency', 'POST', { message: 'Admin test' }, tokenAdmin);
  console.log('TEST 22. Admin role cannot create emergency alert:', adminCreate.status === 403 ? 'PASSED' : 'FAILED', adminCreate.data?.message);

  // TEST 23: Patient Dashboard activeEmergencyAlert integration
  const activeAlertNew = await makeRequest('/api/emergency', 'POST', { message: 'Active alert for dashboard' }, tokenP1);
  const dashboardRes = await makeRequest('/api/patients/dashboard', 'GET', null, tokenP1);
  const dashPass = dashboardRes.status === 200 && dashboardRes.data?.data?.activeEmergencyAlert?._id === activeAlertNew.data?.data?._id;
  console.log('TEST 23. Patient Dashboard activeEmergencyAlert integration:', dashPass ? 'PASSED' : 'FAILED');

  // TEST 24: Caregiver Patient Overview recentEmergencyAlerts integration
  const p1UserId = patient1Res.data?.data?.user?._id;
  const overviewRes = await makeRequest(`/api/caregivers/patients/${p1UserId}`, 'GET', null, tokenC1);
  const overviewPass = overviewRes.status === 200 && Array.isArray(overviewRes.data?.data?.recentEmergencyAlerts) && overviewRes.data?.data?.recentEmergencyAlerts.length > 0;
  console.log('TEST 24. Caregiver Patient Overview recentEmergencyAlerts integration:', overviewPass ? 'PASSED' : 'FAILED', `Alerts count: ${overviewRes.data?.data?.recentEmergencyAlerts?.length}`);

  console.log('\n--- ALL SECURITY & FUNCTIONAL TESTS COMPLETED ---');
}

runEmergencyTests().catch((err) => {
  console.error('Test execution error:', err);
});

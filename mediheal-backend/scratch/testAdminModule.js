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

async function runAdminTests() {
  console.log('=== STARTING ADMIN FRONTEND & BACKEND AUDIT ===\n');
  const timestamp = Date.now();

  // TEST 1: Admin Login
  console.log('--- TEST 1: Admin Login (POST /api/auth/login) ---');
  const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLoginRes.data?.data?.token;
  console.log(`Status: ${adminLoginRes.status}, Admin Token Present: ${!!tokenAdmin}`);
  console.log(`PASS: ${adminLoginRes.status === 200 && !!tokenAdmin}\n`);

  // TEST 2: GET Admin Doctors List
  console.log('--- TEST 2: GET Admin Doctors List (GET /api/admin/doctors) ---');
  const doctorsRes = await makeRequest('/api/admin/doctors', 'GET', null, tokenAdmin);
  console.log(`Status: ${doctorsRes.status}, Doctors Count: ${doctorsRes.data?.count}`);
  console.log(`PASS: ${doctorsRes.status === 200 && Array.isArray(doctorsRes.data?.data)}\n`);

  // TEST 3: Create Doctor Account & Profile
  console.log('--- TEST 3: Create Doctor Account (POST /api/admin/doctors) ---');
  const newDocEmail = `admin_test_doc_${timestamp}@mediheal.com`;
  const newSlmc = `SLMC-ADM-${timestamp}`;
  const createRes = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Ruwan Wickramasinghe',
    email: newDocEmail,
    phoneNumber: '+94778899000',
    slmcNumber: newSlmc,
    specialization: 'Dermatologist',
    hospital: 'Nawaloka Hospital Colombo',
    yearsOfExperience: 8,
    consultationFee: 3200,
    languages: ['English', 'Sinhala', 'Tamil'],
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    availableTimeSlots: ['09:00 AM - 01:00 PM'],
    biography: 'Experienced dermatologist specializing in skin disorders.',
  }, tokenAdmin);
  const createdDoctor = createRes.data?.data?.doctor;
  const tempPassword = createRes.data?.data?.temporaryPassword;
  const doctorProfileId = createdDoctor?._id;
  const doctorUserId = createdDoctor?.userId?._id;
  console.log(`Status: ${createRes.status}, Doctor Profile ID: ${doctorProfileId}`);
  console.log(`Temporary Password Returned: ${tempPassword}`);
  console.log(`PASS: ${createRes.status === 201 && !!doctorProfileId && !!tempPassword}\n`);

  // TEST 4: Doctor Login After Creation (Admin -> Doctor Integration)
  console.log('--- TEST 4: Created Doctor Login (POST /api/auth/login) ---');
  const docLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: newDocEmail,
    password: tempPassword,
  });
  const tokenNewDoc = docLoginRes.data?.data?.token;
  console.log(`Status: ${docLoginRes.status}, Doctor Token Present: ${!!tokenNewDoc}`);
  console.log(`PASS: ${docLoginRes.status === 200 && !!tokenNewDoc}\n`);

  // TEST 5: Duplicate Email Error Handling
  console.log('--- TEST 5: Duplicate Email Error Handling (POST /api/admin/doctors) ---');
  const dupEmailRes = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Duplicate Email',
    email: newDocEmail,
    phoneNumber: '+94778899001',
    slmcNumber: `SLMC-UNIQUE-${timestamp}`,
    specialization: 'General Physician',
    hospital: 'Asiri Hospital',
  }, tokenAdmin);
  console.log(`Status: ${dupEmailRes.status}, Message: ${dupEmailRes.data?.message}`);
  console.log(`PASS: ${dupEmailRes.status === 400}\n`);

  // TEST 6: Duplicate SLMC Number Error Handling
  console.log('--- TEST 6: Duplicate SLMC Number Error Handling (POST /api/admin/doctors) ---');
  const dupSlmcRes = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Duplicate SLMC',
    email: `unique_${timestamp}@mediheal.com`,
    phoneNumber: '+94778899002',
    slmcNumber: newSlmc,
    specialization: 'General Physician',
    hospital: 'Asiri Hospital',
  }, tokenAdmin);
  console.log(`Status: ${dupSlmcRes.status}, Message: ${dupSlmcRes.data?.message}`);
  console.log(`PASS: ${dupSlmcRes.status === 400}\n`);

  // TEST 7: Edit Doctor Details
  console.log('--- TEST 7: Edit Doctor Details (PUT /api/admin/doctors/:doctorId) ---');
  const editRes = await makeRequest(`/api/admin/doctors/${doctorProfileId}`, 'PUT', {
    specialization: 'Pediatric Dermatologist',
    consultationFee: 3500,
    hospital: 'Durdans Hospital Colombo',
  }, tokenAdmin);
  console.log(`Status: ${editRes.status}, Updated Spec: ${editRes.data?.data?.specialization}`);
  console.log(`PASS: ${editRes.status === 200 && editRes.data?.data?.specialization === 'Pediatric Dermatologist'}\n`);

  // TEST 8: Deactivate Doctor Account
  console.log('--- TEST 8: Deactivate Doctor Account (PATCH /api/admin/doctors/:doctorId/status) ---');
  const deactRes = await makeRequest(`/api/admin/doctors/${doctorProfileId}/status`, 'PATCH', {
    isActive: false,
  }, tokenAdmin);
  console.log(`Status: ${deactRes.status}, User isActive: ${deactRes.data?.data?.userId?.isActive}`);
  console.log(`PASS: ${deactRes.status === 200 && deactRes.data?.data?.userId?.isActive === false}\n`);

  // Register a patient to check patient directory exclusion
  const patEmail = `pat_test_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Test Patient',
    email: patEmail,
    phoneNumber: '+94770001122',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patLogin = await makeRequest('/api/auth/login', 'POST', {
    email: patEmail,
    password: 'PatientPass123!',
  });
  const tokenPatient = patLogin.data?.data?.token;

  // TEST 9: Patient Directory Integration with Inactive Doctor
  console.log('--- TEST 9: Patient Directory Exclusion (GET /api/doctors) ---');
  const patDocList = await makeRequest('/api/doctors', 'GET', null, tokenPatient);
  const foundInactiveInPatientList = patDocList.data?.data?.some(
    (d) => (d._id === doctorProfileId || (d.userId && d.userId._id === doctorUserId))
  );
  console.log(`Status: ${patDocList.status}, Inactive Doctor Found in Patient List: ${foundInactiveInPatientList}`);
  console.log(`PASS: ${patDocList.status === 200 && !foundInactiveInPatientList}\n`);

  // TEST 10: Reactivate Doctor Account
  console.log('--- TEST 10: Reactivate Doctor Account (PATCH /api/admin/doctors/:doctorId/status) ---');
  const reactRes = await makeRequest(`/api/admin/doctors/${doctorProfileId}/status`, 'PATCH', {
    isActive: true,
  }, tokenAdmin);
  console.log(`Status: ${reactRes.status}, User isActive: ${reactRes.data?.data?.userId?.isActive}`);
  console.log(`PASS: ${reactRes.status === 200 && reactRes.data?.data?.userId?.isActive === true}\n`);

  console.log('=== ADMIN FRONTEND & BACKEND AUDIT COMPLETE ===');
}

runAdminTests().catch(console.error);

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

async function runStep34MapBackendTests() {
  console.log('=== STARTING STEP 34 GOOGLE MAPS BACKEND AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Admin Login
  const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLoginRes.data?.data?.token;
  console.log(`Admin Login Status: ${adminLoginRes.status}, Token Present: ${!!tokenAdmin}`);

  if (!tokenAdmin) {
    console.error('Failed to log in as admin. Exiting test.');
    process.exit(1);
  }

  // 2. Admin Create Doctor with Valid Coordinates
  console.log('\n--- TEST 1: Admin Create Doctor with Valid Coordinates (POST /api/admin/doctors) ---');
  const docValidEmail = `doc_map_valid_${timestamp}@mediheal.com`;
  const docValidRes = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Anoma Fernando',
      email: docValidEmail,
      phoneNumber: '+94779988771',
      slmcNumber: `SLMC-MAP-${timestamp}-V`,
      password: 'DoctorPass123!',
      specialization: 'Cardiologist',
      hospital: 'Lanka Hospitals',
      location: 'Colombo 05',
      latitude: 6.8925,
      longitude: 79.8752,
      consultationFee: 3500,
    },
    tokenAdmin
  );

  const docValidId = docValidRes.data?.data?.doctor?._id;
  const returnedLat = docValidRes.data?.data?.doctor?.latitude;
  const returnedLng = docValidRes.data?.data?.doctor?.longitude;

  console.log(`Status: ${docValidRes.status}`);
  console.log(`Created Doctor Profile ID: ${docValidId}`);
  console.log(`Latitude: ${returnedLat}, Longitude: ${returnedLng}`);
  const pass1 = docValidRes.status === 201 && returnedLat === 6.8925 && returnedLng === 79.8752;
  console.log(`TEST 1 RESULT: ${pass1 ? 'PASS' : 'FAIL'}`);

  // 3. Admin Create Doctor with Invalid Latitude (> 90)
  console.log('\n--- TEST 2: Rejection of Invalid Latitude > 90 (POST /api/admin/doctors) ---');
  const docInvalidLatRes = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Invalid Lat',
      email: `doc_invalid_lat_${timestamp}@mediheal.com`,
      phoneNumber: '+94779988772',
      slmcNumber: `SLMC-MAP-${timestamp}-ILAT`,
      password: 'DoctorPass123!',
      specialization: 'General Physician',
      hospital: 'Asiri Medical',
      latitude: 100, // Invalid > 90
      longitude: 79.8612,
    },
    tokenAdmin
  );
  console.log(`Status: ${docInvalidLatRes.status}, Message: ${docInvalidLatRes.data?.message}`);
  const pass2 = docInvalidLatRes.status === 400;
  console.log(`TEST 2 RESULT: ${pass2 ? 'PASS' : 'FAIL'}`);

  // 4. Admin Create Doctor with Invalid Longitude (> 180)
  console.log('\n--- TEST 3: Rejection of Invalid Longitude > 180 (POST /api/admin/doctors) ---');
  const docInvalidLngRes = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Invalid Lng',
      email: `doc_invalid_lng_${timestamp}@mediheal.com`,
      phoneNumber: '+94779988773',
      slmcNumber: `SLMC-MAP-${timestamp}-ILNG`,
      password: 'DoctorPass123!',
      specialization: 'Neurologist',
      hospital: 'Nawaloka Hospital',
      latitude: 6.9271,
      longitude: 200, // Invalid > 180
    },
    tokenAdmin
  );
  console.log(`Status: ${docInvalidLngRes.status}, Message: ${docInvalidLngRes.data?.message}`);
  const pass3 = docInvalidLngRes.status === 400;
  console.log(`TEST 3 RESULT: ${pass3 ? 'PASS' : 'FAIL'}`);

  // 5. Admin Create Doctor Without Coordinates (Historical Record Compatibility)
  console.log('\n--- TEST 4: Create Doctor Without Coordinates (POST /api/admin/doctors) ---');
  const docNoCoordsEmail = `doc_nocoords_${timestamp}@mediheal.com`;
  const docNoCoordsRes = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Sunil Perera',
      email: docNoCoordsEmail,
      phoneNumber: '+94779988774',
      slmcNumber: `SLMC-MAP-${timestamp}-NC`,
      password: 'DoctorPass123!',
      specialization: 'General Physician',
      hospital: 'Asiri Medical',
      location: 'Colombo 05',
    },
    tokenAdmin
  );
  const docNoCoordsId = docNoCoordsRes.data?.data?.doctor?._id;
  console.log(`Status: ${docNoCoordsRes.status}, Doctor ID: ${docNoCoordsId}`);
  const pass4 = docNoCoordsRes.status === 201 && docNoCoordsId;
  console.log(`TEST 4 RESULT: ${pass4 ? 'PASS' : 'FAIL'}`);

  // 6. Admin Update Doctor Coordinates
  console.log('\n--- TEST 5: Admin Update Doctor Coordinates (PUT /api/admin/doctors/:id) ---');
  const updateRes = await makeRequest(
    `/api/admin/doctors/${docNoCoordsId}`,
    'PUT',
    {
      latitude: 6.9185,
      longitude: 79.8682,
    },
    tokenAdmin
  );
  const updatedLat = updateRes.data?.data?.latitude;
  const updatedLng = updateRes.data?.data?.longitude;
  console.log(`Status: ${updateRes.status}, Updated Latitude: ${updatedLat}, Updated Longitude: ${updatedLng}`);
  const pass5 = updateRes.status === 200 && updatedLat === 6.9185 && updatedLng === 79.8682;
  console.log(`TEST 5 RESULT: ${pass5 ? 'PASS' : 'FAIL'}`);

  // 7. Patient Login & GET /api/doctors Response Audit
  console.log('\n--- TEST 6: Public Patient Doctors List & Details API (GET /api/doctors) ---');
  const patientEmail = `patient_map_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Kamala Fernando',
    email: patientEmail,
    phoneNumber: '+94771122998',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patLogin = await makeRequest('/api/auth/login', 'POST', {
    email: patientEmail,
    password: 'PatientPass123!',
  });
  const tokenPatient = patLogin.data?.data?.token;

  const publicDoctorsRes = await makeRequest('/api/doctors', 'GET', null, tokenPatient);
  console.log(`GET /api/doctors Status: ${publicDoctorsRes.status}, Count: ${publicDoctorsRes.data?.count}`);

  const fetchedDocWithCoords = publicDoctorsRes.data?.data?.find((d) => d._id === docValidId);
  console.log(`Fetched Doctor Coordinates: Lat ${fetchedDocWithCoords?.latitude}, Lng ${fetchedDocWithCoords?.longitude}`);

  const getSingleDocRes = await makeRequest(`/api/doctors/${docValidId}`, 'GET', null, tokenPatient);
  console.log(`GET /api/doctors/:id Status: ${getSingleDocRes.status}`);

  const pass6 =
    publicDoctorsRes.status === 200 &&
    fetchedDocWithCoords?.latitude === 6.8925 &&
    getSingleDocRes.status === 200 &&
    getSingleDocRes.data?.data?.latitude === 6.8925;
  console.log(`TEST 6 RESULT: ${pass6 ? 'PASS' : 'FAIL'}`);

  console.log('\n=== STEP 34 GOOGLE MAPS BACKEND AUDIT COMPLETE ===');
  const overallPass = pass1 && pass2 && pass3 && pass4 && pass5 && pass6;
  console.log(`OVERALL BACKEND STATUS: ${overallPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
}

runStep34MapBackendTests().catch(console.error);

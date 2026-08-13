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

async function runDoctorTests() {
  console.log('=== STARTING DOCTOR MODULE API AUDIT ===\n');

  // 1. Login Admin to seed doctors
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLogin.data?.data?.token;

  // Create General Physician if not present
  const doc1Res = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Sunil Perera',
    email: `sunil.${Date.now()}@mediheal.com`,
    password: 'Password123!',
    phoneNumber: '0771112233',
    slmcNumber: `SLMC-${Date.now()}-1`,
    specialization: 'General Physician',
    hospital: 'Asiri Hospital',
    yearsOfExperience: 12,
    consultationFee: 3000,
    languages: ['English', 'Sinhala'],
    availableDays: ['Monday', 'Wednesday', 'Friday'],
    availableTimeSlots: ['09:00 AM', '10:00 AM', '11:00 AM'],
    biography: 'Experienced General Physician specializing in adult care.',
    location: 'Colombo 05',
  }, tokenAdmin);

  // Create Cardiologist
  const doc2Res = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Anoma Fernando',
    email: `anoma.${Date.now()}@mediheal.com`,
    password: 'Password123!',
    phoneNumber: '0774445566',
    slmcNumber: `SLMC-${Date.now()}-2`,
    specialization: 'Cardiologist',
    hospital: 'Lanka Hospitals',
    yearsOfExperience: 18,
    consultationFee: 4500,
    languages: ['English', 'Sinhala', 'Tamil'],
    availableDays: ['Tuesday', 'Thursday'],
    availableTimeSlots: ['02:00 PM', '03:30 PM'],
    biography: 'Leading cardiologist with 18+ years of clinical experience.',
    location: 'Colombo 05',
  }, tokenAdmin);

  // 2. Register & Login Patient
  const patientEmail = `patient.${Date.now()}@test.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Test Patient',
    email: patientEmail,
    phoneNumber: '+94779998877',
    password: 'PatientPass123!',
    role: 'patient',
  });

  const loginPatient = await makeRequest('/api/auth/login', 'POST', {
    email: patientEmail,
    password: 'PatientPass123!',
  });
  const tokenPatient = loginPatient.data?.data?.token;

  // TEST A: GET /api/doctors (All Doctors Flow)
  console.log('--- TEST A: Home Doctor Flow (GET /api/doctors) ---');
  const allDocs = await makeRequest('/api/doctors', 'GET', null, tokenPatient);
  console.log(`Status: ${allDocs.status}, Count: ${allDocs.data?.count}`);
  console.log(`PASS: ${allDocs.status === 200 && allDocs.data?.count >= 2}\n`);

  // TEST B: GET /api/doctors?specialization=General Physician
  console.log('--- TEST B: Recommended Specialist Flow (General Physician) ---');
  const genPhysDocs = await makeRequest('/api/doctors?specialization=General Physician', 'GET', null, tokenPatient);
  console.log(`Status: ${genPhysDocs.status}, Count: ${genPhysDocs.data?.count}`);
  console.log(`Specialization: ${genPhysDocs.data?.data?.[0]?.specialization}`);
  console.log(`PASS: ${genPhysDocs.status === 200 && genPhysDocs.data?.count >= 1}\n`);

  // TEST C: GET /api/doctors?specialization=Cardiologist
  console.log('--- TEST C: Cardiologist Flow ---');
  const cardioDocs = await makeRequest('/api/doctors?specialization=Cardiologist', 'GET', null, tokenPatient);
  console.log(`Status: ${cardioDocs.status}, Count: ${cardioDocs.data?.count}`);
  console.log(`Specialization: ${cardioDocs.data?.data?.[0]?.specialization}`);
  console.log(`PASS: ${cardioDocs.status === 200 && cardioDocs.data?.count >= 1}\n`);

  // TEST D: GET /api/doctors/:doctorId
  console.log('--- TEST D: Doctor Details Flow ---');
  const targetDocProfileId = cardioDocs.data?.data?.[0]?._id;
  const targetDocUserId = cardioDocs.data?.data?.[0]?.userId?._id;
  console.log(`DoctorProfile._id: ${targetDocProfileId}`);
  console.log(`Doctor User._id: ${targetDocUserId}`);

  const docDetailsById = await makeRequest(`/api/doctors/${targetDocProfileId}`, 'GET', null, tokenPatient);
  console.log(`By DoctorProfile ID -> Status: ${docDetailsById.status}, Name: ${docDetailsById.data?.data?.userId?.fullName}`);
  
  const docDetailsByUserId = await makeRequest(`/api/doctors/${targetDocUserId}`, 'GET', null, tokenPatient);
  console.log(`By Doctor User ID -> Status: ${docDetailsByUserId.status}, Name: ${docDetailsByUserId.data?.data?.userId?.fullName}`);
  console.log(`PASS: ${docDetailsById.status === 200 && docDetailsByUserId.status === 200}\n`);

  // TEST E: No Matching Doctors
  console.log('--- TEST E: No Matching Doctors ---');
  const noMatchDocs = await makeRequest('/api/doctors?specialization=NonExistentSpecialty123', 'GET', null, tokenPatient);
  console.log(`Status: ${noMatchDocs.status}, Count: ${noMatchDocs.data?.count}`);
  console.log(`PASS: ${noMatchDocs.status === 200 && noMatchDocs.data?.count === 0}\n`);

  // TEST F: Role Protection / Unauthenticated
  console.log('--- TEST F: Unauthenticated Request ---');
  const unauthRes = await makeRequest('/api/doctors', 'GET', null, null);
  console.log(`Status: ${unauthRes.status}`);
  console.log(`PASS: ${unauthRes.status === 401}\n`);

  console.log('=== DOCTOR MODULE API AUDIT COMPLETE ===');
}

runDoctorTests().catch(console.error);

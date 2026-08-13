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
  console.log('=== STARTING DOCTOR FRONTEND & BACKEND AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Admin Login
  const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLoginRes.data?.data?.token;

  // 2. Admin Creates Doctor A & Doctor B
  const docAEmail = `docA_${timestamp}@mediheal.com`;
  const docARes = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Nishan Silva',
    email: docAEmail,
    phoneNumber: '+94771122334',
    slmcNumber: `SLMC-${timestamp}-A`,
    password: 'DoctorPass123!',
    specialization: 'Cardiologist',
    hospital: 'Asiri Hospital Colombo',
    consultationFee: 2500,
    languages: ['English', 'Sinhala'],
  }, tokenAdmin);
  const docAUserId = docARes.data?.data?.doctor?.userId?._id;

  const docBEmail = `docB_${timestamp}@mediheal.com`;
  const docBRes = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Chathuri Perera',
    email: docBEmail,
    phoneNumber: '+94771122335',
    slmcNumber: `SLMC-${timestamp}-B`,
    password: 'DoctorPass123!',
    specialization: 'Neurologist',
    hospital: 'Lanka Hospital Colombo',
    consultationFee: 3000,
    languages: ['English'],
  }, tokenAdmin);
  const docBUserId = docBRes.data?.data?.doctor?.userId?._id;

  // Login Doctor A & Doctor B
  const docALogin = await makeRequest('/api/auth/login', 'POST', {
    email: docAEmail,
    password: 'DoctorPass123!',
  });
  const tokenDocA = docALogin.data?.data?.token;

  const docBLogin = await makeRequest('/api/auth/login', 'POST', {
    email: docBEmail,
    password: 'DoctorPass123!',
  });
  const tokenDocB = docBLogin.data?.data?.token;
  console.log(`Doctor A & Doctor B Created. Token A present: ${!!tokenDocA}, Token B present: ${!!tokenDocB}\n`);

  // 3. Register & Login Patient
  const patientEmail = `patient_doc_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Kanthi Jayawardena',
    email: patientEmail,
    phoneNumber: '+94775544332',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: patientEmail,
    password: 'PatientPass123!',
  });
  const tokenPatient = patLoginRes.data?.data?.token;
  const patientId = patLoginRes.data?.data?.user?._id;

  // TEST 1: Patient Books Appointment with Doctor A
  console.log('--- TEST 1: Patient Books Appointment with Doctor A (POST /api/appointments) ---');
  const apptRes = await makeRequest('/api/appointments', 'POST', {
    doctorId: docAUserId,
    appointmentDate: '2026-08-20',
    timeSlot: '10:00 AM',
    reason: 'Chest tightness and shortness of breath',
  }, tokenPatient);
  const appointmentId = apptRes.data?.data?._id;
  console.log(`Status: ${apptRes.status}, Appointment ID: ${appointmentId}`);
  console.log(`PASS: ${apptRes.status === 201 && !!appointmentId}\n`);

  // TEST 2: Assigned Doctor Appointment Isolation (Doctor A sees appointment, Doctor B does not)
  console.log('--- TEST 2: Assigned Doctor Appointment Isolation (GET /api/doctor/appointments) ---');
  const docAAppts = await makeRequest('/api/doctor/appointments', 'GET', null, tokenDocA);
  const docBAppts = await makeRequest('/api/doctor/appointments', 'GET', null, tokenDocB);

  console.log(`Doctor A Appts Count: ${docAAppts.data?.count}`);
  console.log(`Doctor B Appts Count: ${docBAppts.data?.count}`);
  console.log(`PASS: ${docAAppts.data?.count === 1 && docBAppts.data?.count === 0}\n`);

  // TEST 3: Doctor Confirm Appointment
  console.log('--- TEST 3: Doctor Confirms Appointment (PATCH /api/doctor/appointments/:id/status) ---');
  const confirmRes = await makeRequest(`/api/doctor/appointments/${appointmentId}/status`, 'PATCH', {
    status: 'confirmed',
  }, tokenDocA);
  console.log(`Status: ${confirmRes.status}, Message: ${confirmRes.data?.message}`);
  console.log(`New Status: ${confirmRes.data?.data?.status}`);
  console.log(`PASS: ${confirmRes.status === 200 && confirmRes.data?.data?.status === 'confirmed'}\n`);

  // TEST 4: Create Active Consultation with Multiple Prescriptions
  console.log('--- TEST 4: Create Consultation & Multiple Prescriptions (POST /api/consultations) ---');
  const consultRes = await makeRequest('/api/consultations', 'POST', {
    appointmentId,
    diagnosis: 'Angina Pectoris',
    clinicalNotes: 'ECG shows mild ST depression. Patient advised to rest.',
    prescriptions: [
      {
        medicineName: 'Aspirin 75mg',
        dosage: '75mg',
        frequency: 'Once daily',
        duration: '30 days',
        instructions: 'Take after breakfast',
      },
      {
        medicineName: 'Atorvastatin 20mg',
        dosage: '20mg',
        frequency: 'Nightly',
        duration: '30 days',
        instructions: 'Take before sleep',
      },
    ],
    recommendations: ['Avoid heavy physical exertion', 'Follow low-salt diet'],
    followUpDate: '2026-09-20',
  }, tokenDocA);
  const consultationId = consultRes.data?.data?._id;
  console.log(`Status: ${consultRes.status}, Consultation ID: ${consultationId}`);
  console.log(`Prescriptions Count: ${consultRes.data?.data?.prescriptions?.length}`);
  console.log(`PASS: ${consultRes.status === 201 && consultRes.data?.data?.prescriptions?.length === 2}\n`);

  // TEST 5: Automatic Appointment Status Completion
  console.log('--- TEST 5: Automatic Appointment Status Completion (GET /api/appointments/:id) ---');
  const checkApptRes = await makeRequest(`/api/appointments/${appointmentId}`, 'GET', null, tokenDocA);
  console.log(`Appointment Status: ${checkApptRes.data?.data?.status}`);
  console.log(`PASS: ${checkApptRes.data?.data?.status === 'completed'}\n`);

  // TEST 6: Patient Side Consultation Result Integration
  console.log('--- TEST 6: Patient Side Consultation History (GET /api/consultations/my) ---');
  const patConsultsRes = await makeRequest('/api/consultations/my', 'GET', null, tokenPatient);
  console.log(`Status: ${patConsultsRes.status}, Patient Consults Count: ${patConsultsRes.data?.count}`);
  console.log(`Diagnosis Seen by Patient: ${patConsultsRes.data?.data?.[0]?.diagnosis}`);
  console.log(`PASS: ${patConsultsRes.status === 200 && patConsultsRes.data?.data?.[0]?.diagnosis === 'Angina Pectoris'}\n`);

  // TEST 7: Duplicate Consultation Protection
  console.log('--- TEST 7: Duplicate Consultation Protection (POST /api/consultations) ---');
  const dupConsultRes = await makeRequest('/api/consultations', 'POST', {
    appointmentId,
    diagnosis: 'Duplicate Attempt',
  }, tokenDocA);
  console.log(`Status: ${dupConsultRes.status}, Message: ${dupConsultRes.data?.message}`);
  console.log(`PASS: ${dupConsultRes.status === 400}\n`);

  // TEST 8: Doctor Patient History Retrieval
  console.log('--- TEST 8: Doctor Patient History (GET /api/doctor/patients/:patientId/history) ---');
  const historyRes = await makeRequest(`/api/doctor/patients/${patientId}/history`, 'GET', null, tokenDocA);
  console.log(`Status: ${historyRes.status}, History Count: ${historyRes.data?.count}`);
  console.log(`PASS: ${historyRes.status === 200 && historyRes.data?.count === 1}\n`);

  // TEST 9: Unauthorized Doctor Access Control (Doctor B cannot access Doctor A's patient history)
  console.log('--- TEST 9: Unauthorized Doctor Access Control (GET /api/doctor/patients/:patientId/history) ---');
  const unauthHistoryRes = await makeRequest(`/api/doctor/patients/${patientId}/history`, 'GET', null, tokenDocB);
  console.log(`Status: ${unauthHistoryRes.status}, Message: ${unauthHistoryRes.data?.message}`);
  console.log(`PASS: ${unauthHistoryRes.status === 403}\n`);

  console.log('=== DOCTOR FRONTEND & BACKEND AUDIT COMPLETE ===');
}

runDoctorTests().catch(console.error);

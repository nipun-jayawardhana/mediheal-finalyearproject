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

async function runConsultationTests() {
  console.log('=== STARTING CONSULTATION MODULE AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Admin Login
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLogin.data?.data?.token;

  // 2. Register Doctor
  const docEmail = `dr_consult_${timestamp}@mediheal.com`;
  const createDoc = await makeRequest('/api/admin/doctors', 'POST', {
    fullName: 'Dr. Bandara Herath',
    email: docEmail,
    phoneNumber: '+94773334455',
    password: 'DoctorPass123!',
    slmcNumber: `SLMC_CONSULT_${timestamp}`,
    specialization: 'General Physician',
    hospital: 'MediHeal Central Clinic',
    yearsOfExperience: 15,
    consultationFee: 3500,
    languages: ['English', 'Sinhala'],
    availableDays: ['Monday', 'Tuesday', 'Wednesday'],
    availableTimeSlots: ['10:00 AM', '11:00 AM'],
  }, tokenAdmin);

  const doctorUserId = createDoc.data?.data?.doctor?.userId?._id;

  // Doctor login to get token
  const docLogin = await makeRequest('/api/auth/login', 'POST', {
    email: docEmail,
    password: 'DoctorPass123!',
  });
  const tokenDoctor = docLogin.data?.data?.token;

  // 3. Register & Login Patient A
  const patAEmail = `patA_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Test Patient A',
    email: patAEmail,
    phoneNumber: '+94778881122',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patALogin = await makeRequest('/api/auth/login', 'POST', {
    email: patAEmail,
    password: 'PatientPass123!',
  });
  const tokenPatA = patALogin.data?.data?.token;

  // 4. Register & Login Patient B (For empty state test)
  const patBEmail = `patB_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Test Patient B',
    email: patBEmail,
    phoneNumber: '+94778889900',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patBLogin = await makeRequest('/api/auth/login', 'POST', {
    email: patBEmail,
    password: 'PatientPass123!',
  });
  const tokenPatB = patBLogin.data?.data?.token;

  // TEST 1: Empty History Test (Patient B has no consultations)
  console.log('--- TEST 1: Empty History Test ---');
  const emptyRes = await makeRequest('/api/consultations/my', 'GET', null, tokenPatB);
  console.log(`Status: ${emptyRes.status}, Count: ${emptyRes.data?.count}`);
  console.log(`PASS: ${emptyRes.status === 200 && emptyRes.data?.count === 0}\n`);

  // TEST 2: Create Appointment & Confirm it
  console.log('--- TEST 2: Appointment Creation & Confirmation ---');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  const apptRes = await makeRequest('/api/appointments', 'POST', {
    doctorId: doctorUserId,
    appointmentDate: tomorrowIso,
    timeSlot: '10:00 AM',
    reason: 'Acute cough and breathing issue',
  }, tokenPatA);

  const apptId = apptRes.data?.data?._id;

  // Doctor confirms appointment
  await makeRequest(`/api/doctor/appointments/${apptId}/status`, 'PATCH', {
    status: 'confirmed',
  }, tokenDoctor);

  // Doctor creates consultation with multiple prescriptions & recommendations
  const createConsultRes = await makeRequest('/api/consultations', 'POST', {
    appointmentId: apptId,
    diagnosis: 'Acute Bronchitis (Recovering)',
    clinicalNotes: 'Patient reports improved breathing. Continue prescribed rest. Monitor cough frequency.',
    prescriptions: [
      {
        medicineName: 'Amoxicillin 500mg',
        dosage: '500mg',
        frequency: '3 times daily',
        duration: '7 days',
        instructions: 'Take after meals',
      },
      {
        medicineName: 'Cough Syrup',
        dosage: '10ml',
        frequency: 'Before bed',
        duration: '5 days',
        instructions: 'Drink warm water after taking syrup',
      },
    ],
    recommendations: [
      'Increase fluid intake',
      'Avoid cold beverages',
      'Rest in well-ventilated room',
    ],
    followUpDate: '2026-08-25',
  }, tokenDoctor);

  console.log(`Status: ${createConsultRes.status}, Message: ${createConsultRes.data?.message}`);
  const consultationId = createConsultRes.data?.data?._id;
  console.log(`Consultation ID: ${consultationId}`);
  console.log(`PASS: ${createConsultRes.status === 201 && !!consultationId}\n`);

  // TEST 3: Get My Consultations (Patient Consultation History)
  console.log('--- TEST 3: Patient Consultation History (GET /api/consultations/my) ---');
  const myConsultsRes = await makeRequest('/api/consultations/my', 'GET', null, tokenPatA);
  console.log(`Status: ${myConsultsRes.status}, Count: ${myConsultsRes.data?.count}`);
  const firstConsult = myConsultsRes.data?.data?.[0];
  console.log(`Diagnosis: ${firstConsult?.diagnosis}`);
  console.log(`Doctor: ${firstConsult?.doctorId?.fullName}`);
  console.log(`Prescriptions Count: ${firstConsult?.prescriptions?.length}`);
  console.log(`PASS: ${myConsultsRes.status === 200 && myConsultsRes.data?.count === 1}\n`);

  // TEST 4: Get Consultation By ID (Consultation Summary Screen)
  console.log('--- TEST 4: Consultation Summary Details (GET /api/consultations/:id) ---');
  const consultSummaryRes = await makeRequest(`/api/consultations/${consultationId}`, 'GET', null, tokenPatA);
  console.log(`Status: ${consultSummaryRes.status}`);
  console.log(`Diagnosis: ${consultSummaryRes.data?.data?.diagnosis}`);
  console.log(`Clinical Notes: ${consultSummaryRes.data?.data?.clinicalNotes}`);
  console.log(`Follow up date: ${consultSummaryRes.data?.data?.followUpDate}`);
  console.log(`PASS: ${consultSummaryRes.status === 200 && consultSummaryRes.data?.data?.diagnosis === 'Acute Bronchitis (Recovering)'}\n`);

  // TEST 5: Completed Appointment Integration (Linking appointment to consultation)
  console.log('--- TEST 5: Completed Appointment Integration ---');
  const myApptsRes = await makeRequest('/api/appointments/my', 'GET', null, tokenPatA);
  const completedAppt = myApptsRes.data?.data?.[0];
  console.log(`Appointment Status: ${completedAppt?.status}`);
  console.log(`Linked Consultation ID matches: ${firstConsult?.appointmentId?._id === completedAppt?._id}`);
  console.log(`PASS: ${completedAppt?.status === 'completed' && firstConsult?.appointmentId?._id === completedAppt?._id}\n`);

  // TEST 6: Role Protection / Unauthorized Access
  console.log('--- TEST 6: Role Protection (Forbidden for another patient) ---');
  const forbiddenRes = await makeRequest(`/api/consultations/${consultationId}`, 'GET', null, tokenPatB);
  console.log(`Status: ${forbiddenRes.status}, Message: ${forbiddenRes.data?.message}`);
  console.log(`PASS: ${forbiddenRes.status === 403}\n`);

  console.log('=== CONSULTATION MODULE AUDIT COMPLETE ===');
}

runConsultationTests().catch(console.error);

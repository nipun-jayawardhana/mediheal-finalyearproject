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

async function debugAudit() {
  const timestamp = Date.now();

  // Admin login
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLogin.data?.data?.token;

  // Debug Step 3: Admin creates doctor
  const createDoc = await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Audit Perera',
      email: `dr_audit_${timestamp}@mediheal.com`,
      phoneNumber: '+94771234567',
      slmcNumber: `SLMC_${timestamp}`,
      specialization: 'General Physician',
      hospital: 'National Hospital Colombo',
      password: 'DoctorPass123!',
    },
    tokenAdmin
  );
  console.log('Step 3 Debug:', createDoc.status, JSON.stringify(createDoc.data));

  // Patient Register & Profile & Caregiver
  const regPatient = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Sunil Jayasinghe',
    email: `pat_${timestamp}@mediheal.com`,
    phoneNumber: '+94779876543',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const tokenPatient = regPatient.data?.data?.token;
  const patientUserId = regPatient.data?.data?.user?._id;

  const createPatProfile = await makeRequest(
    '/api/patients/profile',
    'POST',
    {
      dateOfBirth: '1955-08-10',
      gender: 'male',
      bloodGroup: 'B+',
      address: '45 Temple Road, Kandy',
      emergencyContactName: 'Kamal Jayasinghe',
      emergencyContactPhone: '0771122334',
    },
    tokenPatient
  );
  const linkCode = createPatProfile.data?.data?.profile?.caregiverLinkCode;

  const regCaregiver = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Kamal Jayasinghe',
    email: `cg_${timestamp}@mediheal.com`,
    phoneNumber: '+94771122334',
    password: 'CaregiverPass123!',
    role: 'caregiver',
  });
  const tokenCaregiver = regCaregiver.data?.data?.token;

  await makeRequest(
    '/api/caregivers/link',
    'POST',
    { caregiverLinkCode: linkCode, relationship: 'Son' },
    tokenCaregiver
  );

  // Debug Step 13: Caregiver adds medication
  const addMed = await makeRequest(
    '/api/medications',
    'POST',
    {
      patientId: patientUserId,
      medicineName: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Daily',
      instructions: 'Take 1 tablet every morning after meal',
      timeSlots: ['08:00'],
      startDate: '2026-08-12',
    },
    tokenCaregiver
  );
  console.log('Step 13 Debug:', addMed.status, JSON.stringify(addMed.data));
}

debugAudit();

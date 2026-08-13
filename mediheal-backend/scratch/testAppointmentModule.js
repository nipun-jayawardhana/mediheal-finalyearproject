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

async function runAppointmentTests() {
  console.log('=== STARTING APPOINTMENT MODULE AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Admin Login to get doctor list
  const adminLogin = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLogin.data?.data?.token;

  // Fetch registered doctors
  const doctorsRes = await makeRequest('/api/doctors', 'GET', null, tokenAdmin);
  const targetDoctor = doctorsRes.data?.data?.[0];
  const doctorUserId = targetDoctor?.userId?._id;
  const doctorProfileId = targetDoctor?._id;

  console.log(`Target Doctor Name: ${targetDoctor?.userId?.fullName}`);
  console.log(`Target Doctor User ID: ${doctorUserId}`);
  console.log(`Target DoctorProfile ID: ${doctorProfileId}\n`);

  // 2. Register & Login Patient 1
  const pat1Email = `pat1_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Sunil Jayasinghe',
    email: pat1Email,
    phoneNumber: '+94771122334',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const pat1Login = await makeRequest('/api/auth/login', 'POST', {
    email: pat1Email,
    password: 'PatientPass123!',
  });
  const tokenPat1 = pat1Login.data?.data?.token;

  // 3. Register & Login Patient 2 (for Empty state test)
  const pat2Email = `pat2_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Nimali Perera',
    email: pat2Email,
    phoneNumber: '+94775566778',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const pat2Login = await makeRequest('/api/auth/login', 'POST', {
    email: pat2Email,
    password: 'PatientPass123!',
  });
  const tokenPat2 = pat2Login.data?.data?.token;

  // TEST 1: Empty State (Patient 2 has no appointments)
  console.log('--- TEST 1: My Bookings Empty State ---');
  const emptyRes = await makeRequest('/api/appointments/my', 'GET', null, tokenPat2);
  console.log(`Status: ${emptyRes.status}, Count: ${emptyRes.data?.count}`);
  console.log(`PASS: ${emptyRes.status === 200 && emptyRes.data?.count === 0}\n`);

  // TEST 2: Create Appointment (Patient 1)
  console.log('--- TEST 2: Book Appointment (POST /api/appointments) ---');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];
  const slotToBook = '10:00 AM';

  const createRes = await makeRequest('/api/appointments', 'POST', {
    doctorId: doctorUserId,
    appointmentDate: tomorrowIso,
    timeSlot: slotToBook,
    reason: 'Routine cardiology evaluation for chest tightness',
  }, tokenPat1);

  console.log(`Status: ${createRes.status}, Message: ${createRes.data?.message}`);
  const createdApptId = createRes.data?.data?._id;
  console.log(`Appointment ID: ${createdApptId}`);
  console.log(`PASS: ${createRes.status === 201 && !!createdApptId}\n`);

  // TEST 3: Duplicate Booking Prevention
  console.log('--- TEST 3: Duplicate Booking Prevention ---');
  const dupRes = await makeRequest('/api/appointments', 'POST', {
    doctorId: doctorUserId,
    appointmentDate: tomorrowIso,
    timeSlot: slotToBook,
    reason: 'Attempting duplicate slot booking',
  }, tokenPat1);
  console.log(`Status: ${dupRes.status}, Message: ${dupRes.data?.message}`);
  console.log(`PASS: ${dupRes.status === 400 && dupRes.data?.message?.includes('already booked')}\n`);

  // TEST 4: Past Date Rejection
  console.log('--- TEST 4: Past Date Rejection ---');
  const pastRes = await makeRequest('/api/appointments', 'POST', {
    doctorId: doctorUserId,
    appointmentDate: '2020-01-01',
    timeSlot: '09:00 AM',
    reason: 'Past date attempt',
  }, tokenPat1);
  console.log(`Status: ${pastRes.status}, Message: ${pastRes.data?.message}`);
  console.log(`PASS: ${pastRes.status === 400 && pastRes.data?.message?.includes('past')}\n`);

  // TEST 5: Get My Appointments
  console.log('--- TEST 5: Get My Appointments (GET /api/appointments/my) ---');
  const myApptsRes = await makeRequest('/api/appointments/my', 'GET', null, tokenPat1);
  console.log(`Status: ${myApptsRes.status}, Count: ${myApptsRes.data?.count}`);
  console.log(`Status of created appointment: ${myApptsRes.data?.data?.[0]?.status}`);
  console.log(`PASS: ${myApptsRes.status === 200 && myApptsRes.data?.count >= 1}\n`);

  // TEST 6: Patient Cancellation (PATCH /api/appointments/:id/cancel)
  console.log('--- TEST 6: Patient Appointment Cancellation ---');
  const cancelRes = await makeRequest(`/api/appointments/${createdApptId}/cancel`, 'PATCH', {
    cancellationReason: 'Need to reschedule date',
  }, tokenPat1);
  console.log(`Status: ${cancelRes.status}, Message: ${cancelRes.data?.message}`);
  console.log(`Updated Status: ${cancelRes.data?.data?.status}`);
  console.log(`PASS: ${cancelRes.status === 200 && cancelRes.data?.data?.status === 'cancelled'}\n`);

  // TEST 7: Role Protection
  console.log('--- TEST 7: Role Protection (Unauthenticated) ---');
  const unauthRes = await makeRequest('/api/appointments/my', 'GET', null, null);
  console.log(`Status: ${unauthRes.status}`);
  console.log(`PASS: ${unauthRes.status === 401}\n`);

  console.log('=== APPOINTMENT MODULE AUDIT COMPLETE ===');
}

runAppointmentTests().catch(console.error);

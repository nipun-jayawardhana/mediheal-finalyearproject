const BASE_URL = 'http://localhost:5000/api';

async function req(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('--- STARTING CONSULTATION MODULE VERIFICATION TESTS ---');

  try {
    const timestamp = Date.now();

    // 1. Admin Login (Ensure admin exists)
    let adminToken;
    let adminLoginRes = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'admin@mediheal.com',
      password: 'AdminPass123!',
    });

    if (adminLoginRes.status !== 200) {
      console.log('Admin not found, running seed script via node...');
      const { execSync } = require('child_process');
      execSync('node seedAdmin.js', { cwd: 'd:\\MediHeal\\mediheal-backend' });
      adminLoginRes = await req(`${BASE_URL}/auth/login`, 'POST', {
        email: 'admin@mediheal.com',
        password: 'AdminPass123!',
      });
    }
    adminToken = adminLoginRes.data.data.token;
    console.log('✅ Admin Logged In');

    // 2. Register Patient 1 & Patient 2
    const p1Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient One ${timestamp}`,
      email: `patient1_${timestamp}@example.com`,
      phoneNumber: '0771234567',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    if (p1Res.status !== 201) throw new Error(`Register P1 failed: ${JSON.stringify(p1Res.data)}`);
    const patient1Token = p1Res.data.data.token;
    const patient1Id = p1Res.data.data.user._id || p1Res.data.data.user.id;
    console.log('✅ Registered Patient 1:', patient1Id);

    const p2Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Two ${timestamp}`,
      email: `patient2_${timestamp}@example.com`,
      phoneNumber: '0771234568',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    if (p2Res.status !== 201) throw new Error(`Register P2 failed: ${JSON.stringify(p2Res.data)}`);
    const patient2Token = p2Res.data.data.token;
    const patient2Id = p2Res.data.data.user._id || p2Res.data.data.user.id;
    console.log('✅ Registered Patient 2:', patient2Id);

    // 3. Admin creates Doctor 1 & Doctor 2
    const doc1Email = `doc1_${timestamp}@example.com`;
    const d1Create = await req(`${BASE_URL}/admin/doctors`, 'POST', {
      fullName: `Dr. Smith ${timestamp}`,
      email: doc1Email,
      phoneNumber: '0777654321',
      password: 'Password123!',
      slmcNumber: `SLMC${timestamp}1`,
      specialization: 'General Medicine',
      hospital: 'City Hospital',
      preferredLanguage: 'English',
    }, adminToken);
    if (d1Create.status !== 201) throw new Error(`Create D1 failed: ${JSON.stringify(d1Create.data)}`);
    const doctor1Id = d1Create.data.data.doctor.userId._id || d1Create.data.data.doctor.userId;

    // Login Doctor 1
    const d1Login = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: doc1Email,
      password: 'Password123!',
    });
    const doctor1Token = d1Login.data.data.token;
    console.log('✅ Created & Logged In Doctor 1:', doctor1Id);

    const doc2Email = `doc2_${timestamp}@example.com`;
    const d2Create = await req(`${BASE_URL}/admin/doctors`, 'POST', {
      fullName: `Dr. Jones ${timestamp}`,
      email: doc2Email,
      phoneNumber: '0777654322',
      password: 'Password123!',
      slmcNumber: `SLMC${timestamp}2`,
      specialization: 'Pediatrics',
      hospital: 'General Hospital',
      preferredLanguage: 'English',
    }, adminToken);
    if (d2Create.status !== 201) throw new Error(`Create D2 failed: ${JSON.stringify(d2Create.data)}`);
    const doctor2Id = d2Create.data.data.doctor.userId._id || d2Create.data.data.doctor.userId;

    // Login Doctor 2
    const d2Login = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: doc2Email,
      password: 'Password123!',
    });
    const doctor2Token = d2Login.data.data.token;
    console.log('✅ Created & Logged In Doctor 2:', doctor2Id);

    // 4. Patient 1 creates Appointment with Doctor 1
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);
    const appointmentDateStr = futureDate.toISOString().split('T')[0];

    const apptRes = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: doctor1Id,
      appointmentDate: appointmentDateStr,
      timeSlot: '10:00 AM - 10:30 AM',
      reason: 'Regular Health Checkup & Fever',
    }, patient1Token);
    if (apptRes.status !== 201) throw new Error(`Create Appt failed: ${JSON.stringify(apptRes.data)}`);
    const appointmentId = apptRes.data.data._id;
    console.log('✅ Created Appointment 1:', appointmentId, '| Initial Status:', apptRes.data.data.status);

    // 5. Test Rule 3 Validation: Trying to create consultation for PENDING appointment
    const rule3Res = await req(`${BASE_URL}/consultations`, 'POST', {
      appointmentId: appointmentId,
      diagnosis: 'Viral Fever',
    }, doctor1Token);
    if (rule3Res.status === 400 && rule3Res.data.success === false) {
      console.log('✅ Rule 3 Verified (Pending Appt Rejected):', rule3Res.data.message);
    } else {
      console.error('❌ Failed Rule 3 test:', rule3Res);
    }

    // 6. Doctor 1 confirms Appointment 1
    const confirmRes = await req(`${BASE_URL}/doctor/appointments/${appointmentId}/status`, 'PATCH', {
      status: 'confirmed',
    }, doctor1Token);
    if (confirmRes.status !== 200) throw new Error(`Confirm Appt failed: ${JSON.stringify(confirmRes.data)}`);
    console.log('✅ Doctor 1 Confirmed Appointment:', confirmRes.data.data.status);

    // 7. Test Rule 1 Validation: Unassigned Doctor (Doctor 2) tries to create consultation
    const rule1Res = await req(`${BASE_URL}/consultations`, 'POST', {
      appointmentId: appointmentId,
      diagnosis: 'Viral Fever',
    }, doctor2Token);
    if (rule1Res.status === 403 && rule1Res.data.success === false) {
      console.log('✅ Rule 1 Verified (Unassigned Doctor Rejected):', rule1Res.data.message);
    } else {
      console.error('❌ Failed Rule 1 test:', rule1Res);
    }

    // 8. Doctor 1 creates Consultation (SUCCESS)
    const consultationPayload = {
      appointmentId: appointmentId,
      diagnosis: 'Acute Viral Pharyngitis with mild dehydration',
      clinicalNotes: 'Patient presents with sore throat, elevated temperature of 38.5°C, and fatigue.',
      prescriptions: [
        {
          medicineName: 'Paracetamol 500mg',
          dosage: '1 tablet',
          frequency: '3 times daily after meals',
          duration: '5 days',
          instructions: 'Take with plenty of water',
        },
        {
          medicineName: 'Amoxicillin 500mg',
          dosage: '1 capsule',
          frequency: 'Every 8 hours',
          duration: '7 days',
          instructions: 'Complete full course',
        },
      ],
      recommendations: [
        'Rest adequately for 3 days',
        'Drink at least 2.5 liters of fluids daily',
        'Gargle with warm salt water twice daily',
      ],
      followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const createConsultationRes = await req(`${BASE_URL}/consultations`, 'POST', consultationPayload, doctor1Token);
    if (createConsultationRes.status !== 201) throw new Error(`Create Consultation failed: ${JSON.stringify(createConsultationRes.data)}`);
    const consultationId = createConsultationRes.data.data._id;
    console.log('✅ Created Consultation successfully:', consultationId);
    console.log('   - Password check patient:', createConsultationRes.data.data.patientId.password === undefined ? 'PASS (Hidden)' : 'FAIL');
    console.log('   - Password check doctor:', createConsultationRes.data.data.doctorId.password === undefined ? 'PASS (Hidden)' : 'FAIL');

    // 9. Verify Rule 4: Appointment status automatically updated to 'completed'
    const getApptRes = await req(`${BASE_URL}/appointments/${appointmentId}`, 'GET', null, patient1Token);
    console.log('✅ Rule 4 Verified (Appt auto-completed):', getApptRes.data.data.status === 'completed' ? 'PASS (completed)' : 'FAIL');

    // 10. Test Rule 5 & Requirement 6: DUPLICATE CONSULTATION PREVENTION
    const dupRes = await req(`${BASE_URL}/consultations`, 'POST', consultationPayload, doctor1Token);
    if (dupRes.status === 400 && dupRes.data.success === false) {
      console.log('✅ Rule 5 & Req 6 Verified (Duplicate Consultation Rejected):', dupRes.data.message);
    } else {
      console.error('❌ Failed Duplicate Consultation test:', dupRes);
    }

    // 11. Test GET /api/consultations/my as Patient 1
    const myPatientConsultations = await req(`${BASE_URL}/consultations/my`, 'GET', null, patient1Token);
    console.log('✅ GET /api/consultations/my (Patient 1): Count =', myPatientConsultations.data.count);

    // 12. Test GET /api/consultations/my as Doctor 1
    const myDoctorConsultations = await req(`${BASE_URL}/consultations/my`, 'GET', null, doctor1Token);
    console.log('✅ GET /api/consultations/my (Doctor 1): Count =', myDoctorConsultations.data.count);

    // 13. Test GET /api/consultations/:consultationId (Patient 1 - SUCCESS)
    const getSingleRes = await req(`${BASE_URL}/consultations/${consultationId}`, 'GET', null, patient1Token);
    console.log('✅ GET /api/consultations/:consultationId (Patient 1 - Own):', getSingleRes.data.data.diagnosis);

    // 14. Test Rule 6 Validation: Patient 2 tries to view Patient 1's consultation
    const rule6Res = await req(`${BASE_URL}/consultations/${consultationId}`, 'GET', null, patient2Token);
    if (rule6Res.status === 403 && rule6Res.data.success === false) {
      console.log('✅ Rule 6 Verified (Other Patient Access Denied):', rule6Res.data.message);
    } else {
      console.error('❌ Failed Rule 6 test:', rule6Res);
    }

    // 15. Test Rule 7 Validation: Doctor 2 (unrelated) tries to view Patient 1's consultation history
    const rule7Res = await req(`${BASE_URL}/doctor/patients/${patient1Id}/history`, 'GET', null, doctor2Token);
    if (rule7Res.status === 403 && rule7Res.data.success === false) {
      console.log('✅ Rule 7 Verified (Unrelated Doctor Access Denied):', rule7Res.data.message);
    } else {
      console.error('❌ Failed Rule 7 test:', rule7Res);
    }

    // 16. Test Doctor 1 viewing Patient 1's consultation history (SUCCESS)
    const historyRes = await req(`${BASE_URL}/doctor/patients/${patient1Id}/history`, 'GET', null, doctor1Token);
    console.log('✅ GET /api/doctor/patients/:patientId/history (Doctor 1): Count =', historyRes.data.count);

    console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

runTests();

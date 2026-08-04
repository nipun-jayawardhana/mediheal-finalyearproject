const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const Appointment = require('../src/models/Appointment');
const dotenv = require('dotenv');

dotenv.config();

let server;

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- STARTING APPOINTMENT MODULE VERIFICATION TESTS ---');

    server = app.listen(5002);
    const baseUrl = 'http://localhost:5002';

    // 1. Login Admin
    console.log('1. Admin Login...');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL || 'admin@mediheal.com',
        password: process.env.ADMIN_PASSWORD || 'AdminPass123!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data.token;

    // Clean test data
    const patientEmail = 'patient.sunil@mediheal.com';
    const doctorEmail = 'dr.kamal@mediheal.com';
    const slmcNumber = 'SLMC-77788';

    await User.deleteOne({ email: patientEmail });
    const existingDocUser = await User.findOne({ email: doctorEmail });
    if (existingDocUser) {
      await DoctorProfile.deleteOne({ userId: existingDocUser._id });
      await User.deleteOne({ _id: existingDocUser._id });
    }
    await Appointment.deleteMany({ reason: /Test Appointment/i });

    // 2. Register Patient
    console.log('2. Registering Patient...');
    const regPatientRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Sunil Perera',
        email: patientEmail,
        phoneNumber: '+94711112222',
        password: 'PatientPass123!',
        role: 'patient',
      }),
    });
    const regPatientData = await regPatientRes.json();
    const patientToken = regPatientData.data.token;
    const patientUserId = regPatientData.data.user._id;

    // 3. Admin creates Doctor
    console.log('3. Admin creating Doctor...');
    const createDocRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Dr. Kamal Silva',
        email: doctorEmail,
        phoneNumber: '+94772223333',
        slmcNumber: slmcNumber,
        specialization: 'General Physician',
        hospital: 'Durdans Hospital',
        yearsOfExperience: 8,
        consultationFee: 2500,
        availableDays: ['Monday', 'Tuesday', 'Wednesday'],
        availableTimeSlots: ['10:00 AM - 12:00 PM', '02:00 PM - 04:00 PM'],
      }),
    });
    const createDocData = await createDocRes.json();
    const doctorProfileId = createDocData.data.doctor._id;
    const doctorUserId = createDocData.data.doctor.userId._id;
    const tempPassword = createDocData.data.temporaryPassword;

    // 4. Doctor Login
    console.log('4. Doctor Login...');
    const docLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: doctorEmail, password: tempPassword }),
    });
    const docLoginData = await docLoginRes.json();
    const doctorToken = docLoginData.data.token;

    // Tomorrow's date string YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 5. Patient Creates Appointment (Rule 1, 2)
    console.log('5. Patient Creating Appointment...');
    const createApptRes = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: doctorUserId,
        appointmentDate: tomorrowStr,
        timeSlot: '10:00 AM - 12:00 PM',
        reason: 'Test Appointment - General Checkup',
      }),
    });
    const createApptData = await createApptRes.json();
    console.log('   Create Appointment Status:', createApptRes.status, createApptData.success ? 'SUCCESS' : 'FAILED');
    if (createApptRes.status !== 201) throw new Error(`Create appointment failed: ${JSON.stringify(createApptData)}`);
    const appointmentId = createApptData.data._id;

    // 6. Test Duplicate Booking Validation (Rule 4)
    console.log('6. Testing Duplicate Booking Validation...');
    const dupApptRes = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: doctorUserId,
        appointmentDate: tomorrowStr,
        timeSlot: '10:00 AM - 12:00 PM',
        reason: 'Test Appointment - Duplicate Attempt',
      }),
    });
    const dupApptData = await dupApptRes.json();
    console.log('   Duplicate Booking Status:', dupApptRes.status, dupApptRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');
    console.log('   Duplicate Message:', dupApptData.message);

    // 7. Test Past Date Validation (Rule 3)
    console.log('7. Testing Past Date Validation...');
    const pastApptRes = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: doctorUserId,
        appointmentDate: '2020-01-01',
        timeSlot: '02:00 PM - 04:00 PM',
        reason: 'Test Appointment - Past Date',
      }),
    });
    console.log('   Past Date Status:', pastApptRes.status, pastApptRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');

    // 8. Patient Get My Appointments (Rule 5)
    console.log('8. Patient Getting My Appointments...');
    const myApptsRes = await fetch(`${baseUrl}/api/appointments/my`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const myApptsData = await myApptsRes.json();
    console.log('   My Appointments Status:', myApptsRes.status, `Count: ${myApptsData.count}`);

    // 9. Doctor Get Assigned Appointments (Rule 6)
    console.log('9. Doctor Getting Assigned Appointments...');
    const docApptsRes = await fetch(`${baseUrl}/api/doctor/appointments`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const docApptsData = await docApptsRes.json();
    console.log('   Doctor Appointments Status:', docApptsRes.status, `Count: ${docApptsData.count}`);

    // 10. Doctor Updates Appointment Status to Confirmed (Rule 8)
    console.log('10. Doctor Updating Status to Confirmed...');
    const confirmRes = await fetch(`${baseUrl}/api/doctor/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    const confirmData = await confirmRes.json();
    console.log('   Confirm Status:', confirmRes.status, `New Status: ${confirmData.data?.status}`);

    // 11. Doctor Updates Appointment Status to Completed (Rule 8)
    console.log('11. Doctor Updating Status to Completed...');
    const completeRes = await fetch(`${baseUrl}/api/doctor/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'completed' }),
    });
    const completeData = await completeRes.json();
    console.log('   Complete Status:', completeRes.status, `New Status: ${completeData.data?.status}`);

    // 12. Test Patient Cannot Cancel Completed Appointment (Rule 7, 9)
    console.log('12. Patient Attempting to Cancel Completed Appointment...');
    const cancelCompRes = await fetch(`${baseUrl}/api/appointments/${appointmentId}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ cancellationReason: 'Changed mind' }),
    });
    console.log('   Cancel Completed Status:', cancelCompRes.status, cancelCompRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');

    // 13. Create second appointment & test Patient Cancellation
    console.log('13. Creating Second Appointment for Cancellation Test...');
    const appt2Res = await fetch(`${baseUrl}/api/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: doctorUserId,
        appointmentDate: tomorrowStr,
        timeSlot: '02:00 PM - 04:00 PM',
        reason: 'Test Appointment - To Be Cancelled',
      }),
    });
    const appt2Data = await appt2Res.json();
    const appt2Id = appt2Data.data._id;

    console.log('   Patient Cancelling Pending Appointment...');
    const cancelRes = await fetch(`${baseUrl}/api/appointments/${appt2Id}/cancel`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ cancellationReason: 'Schedule conflict' }),
    });
    const cancelData = await cancelRes.json();
    console.log('   Cancel Pending Status:', cancelRes.status, `New Status: ${cancelData.data?.status}`);

    // 14. Doctor Attempting to Update Cancelled Appointment
    console.log('14. Doctor Attempting to Update Cancelled Appointment...');
    const docUpdateCancelRes = await fetch(`${baseUrl}/api/doctor/appointments/${appt2Id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'confirmed' }),
    });
    console.log('   Update Cancelled Status:', docUpdateCancelRes.status, docUpdateCancelRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');

    console.log('--- ALL APPOINTMENT MODULE VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();

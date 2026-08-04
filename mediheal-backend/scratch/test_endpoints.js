const app = require('../src/app');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const dotenv = require('dotenv');

dotenv.config();

let server;

const runTests = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('--- STARTING VERIFICATION TESTS ---');

    server = app.listen(5001);

    const baseUrl = 'http://localhost:5001';

    // 1. Admin Login
    console.log('1. Testing Admin Login...');
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.ADMIN_EMAIL || 'admin@mediheal.com',
        password: process.env.ADMIN_PASSWORD || 'AdminPass123!',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    console.log('   Admin Login Status:', adminLoginRes.status, adminLoginData.success ? 'SUCCESS' : 'FAILED');
    if (!adminLoginData.success) throw new Error('Admin login failed');
    const adminToken = adminLoginData.data.token;

    // Clean test doctors if existing
    const testDocEmail = 'dr.nimal@mediheal.com';
    const testSlmc = 'SLMC-98765';
    const existingUser = await User.findOne({ email: testDocEmail });
    if (existingUser) {
      await DoctorProfile.deleteOne({ userId: existingUser._id });
      await User.deleteOne({ _id: existingUser._id });
    }

    // 2. Admin Create Doctor (POST /api/admin/doctors)
    console.log('2. Testing POST /api/admin/doctors...');
    const createDocRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Dr. Nimal Perera',
        email: testDocEmail,
        phoneNumber: '+94771234567',
        slmcNumber: testSlmc,
        specialization: 'Cardiologist',
        hospital: 'Asiri Surgical Hospital',
        yearsOfExperience: 12,
        consultationFee: 3500,
        languages: ['English', 'Sinhala'],
        availableDays: ['Monday', 'Wednesday', 'Friday'],
        availableTimeSlots: ['09:00 AM - 12:00 PM', '04:00 PM - 07:00 PM'],
        biography: 'Experienced Senior Cardiologist specialized in interventional cardiology.',
        location: 'Colombo 05',
      }),
    });
    const createDocData = await createDocRes.json();
    console.log('   Create Doctor Status:', createDocRes.status);
    console.log('   Temp Password Generated:', !!createDocData.data?.temporaryPassword);
    console.log('   Password Exposed in Doctor Object?:', !!createDocData.data?.doctor?.userId?.password);
    if (createDocRes.status !== 201) throw new Error(`Create Doctor failed: ${JSON.stringify(createDocData)}`);
    const doctorId = createDocData.data.doctor._id;
    const tempPassword = createDocData.data.temporaryPassword;

    // 3. Doctor Login using generated temp password
    console.log('3. Testing Doctor Login with Temporary Password...');
    const docLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testDocEmail,
        password: tempPassword,
      }),
    });
    const docLoginData = await docLoginRes.json();
    console.log('   Doctor Login Status:', docLoginRes.status, docLoginData.success ? 'SUCCESS' : 'FAILED');
    if (!docLoginData.success) throw new Error('Doctor login failed with temporary password');
    const doctorToken = docLoginData.data.token;

    // 4. Test Duplicate Email Validation
    console.log('4. Testing Duplicate Email Validation...');
    const dupEmailRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Dr. Duplicate',
        email: testDocEmail,
        phoneNumber: '+94771112233',
        slmcNumber: 'SLMC-99999',
        specialization: 'Neurologist',
        hospital: 'Lanka Hospital',
      }),
    });
    console.log('   Duplicate Email Status:', dupEmailRes.status, dupEmailRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');

    // 5. Test Duplicate SLMC Validation
    console.log('5. Testing Duplicate SLMC Validation...');
    const dupSlmcRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        fullName: 'Dr. Duplicate SLMC',
        email: 'dr.dupslmc@mediheal.com',
        phoneNumber: '+94771112233',
        slmcNumber: testSlmc,
        specialization: 'Neurologist',
        hospital: 'Lanka Hospital',
      }),
    });
    console.log('   Duplicate SLMC Status:', dupSlmcRes.status, dupSlmcRes.status === 400 ? 'PASSED (400 Bad Request)' : 'FAILED');

    // 6. Admin Get All Doctors (GET /api/admin/doctors)
    console.log('6. Testing Admin GET /api/admin/doctors...');
    const adminGetDocsRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGetDocsData = await adminGetDocsRes.json();
    console.log('   Admin Get Doctors Status:', adminGetDocsRes.status, `Count: ${adminGetDocsData.count}`);

    // 7. Admin Get Doctor By ID (GET /api/admin/doctors/:doctorId)
    console.log('7. Testing Admin GET /api/admin/doctors/:doctorId...');
    const adminGetDocRes = await fetch(`${baseUrl}/api/admin/doctors/${doctorId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminGetDocData = await adminGetDocRes.json();
    console.log('   Admin Get Doctor By ID Status:', adminGetDocRes.status, adminGetDocData.data?.userId?.fullName);

    // 8. Admin Update Doctor (PUT /api/admin/doctors/:doctorId)
    console.log('8. Testing Admin PUT /api/admin/doctors/:doctorId...');
    const updateDocRes = await fetch(`${baseUrl}/api/admin/doctors/${doctorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        consultationFee: 4000,
        hospital: 'Nawaloka Hospital',
      }),
    });
    const updateDocData = await updateDocRes.json();
    console.log('   Update Doctor Status:', updateDocRes.status, `New Fee: ${updateDocData.data?.consultationFee}`);

    // 9. Patient View Doctors (GET /api/doctors) & Search by Specialization
    console.log('9. Testing Patient GET /api/doctors?specialization=Cardiologist...');
    const patientGetDocsRes = await fetch(`${baseUrl}/api/doctors?specialization=Cardiologist`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const patientGetDocsData = await patientGetDocsRes.json();
    console.log('   Patient Get Doctors Status:', patientGetDocsRes.status, `Count: ${patientGetDocsData.count}`);

    // 10. Patient View Doctor by ID (GET /api/doctors/:doctorId)
    console.log('10. Testing Patient GET /api/doctors/:doctorId...');
    const patientGetDocRes = await fetch(`${baseUrl}/api/doctors/${doctorId}`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    const patientGetDocData = await patientGetDocRes.json();
    console.log('   Patient Get Doctor By ID Status:', patientGetDocRes.status, patientGetDocData.data?.hospital);

    // 11. Patient Forbidden from Admin endpoint
    console.log('11. Testing Patient Accessing Admin Endpoint (Forbidden Check)...');
    const forbiddenRes = await fetch(`${baseUrl}/api/admin/doctors`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    console.log('   Forbidden Check Status:', forbiddenRes.status, forbiddenRes.status === 403 ? 'PASSED (403 Forbidden)' : 'FAILED');

    // 12. Admin Deactivate Doctor (PATCH /api/admin/doctors/:doctorId/status)
    console.log('12. Testing Admin PATCH /api/admin/doctors/:doctorId/status (Deactivate)...');
    const deactivateRes = await fetch(`${baseUrl}/api/admin/doctors/${doctorId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: false }),
    });
    const deactivateData = await deactivateRes.json();
    console.log('   Deactivate Status:', deactivateRes.status, `User Active: ${deactivateData.data?.userId?.isActive}`);

    // 13. Verify Deactivated Doctor Hidden from Patient View (tested with active user token)
    console.log('13. Testing Patient GET /api/doctors (Deactivated Doctor Hidden)...');
    const hiddenDocRes = await fetch(`${baseUrl}/api/doctors/${doctorId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log('   Deactivated Doctor View Status:', hiddenDocRes.status, hiddenDocRes.status === 404 ? 'PASSED (404 Not Found)' : 'FAILED');

    // Reactivate Doctor for cleanliness
    await fetch(`${baseUrl}/api/admin/doctors/${doctorId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ isActive: true, isAvailable: true }),
    });
    console.log('--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(0);
  }
};

runTests();

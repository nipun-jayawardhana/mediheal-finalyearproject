const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../src/models/User');
const DoctorProfile = require('../src/models/DoctorProfile');
const PatientProfile = require('../src/models/PatientProfile');
const Appointment = require('../src/models/Appointment');
const Notification = require('../src/models/Notification');
const { processAppointmentReminders } = require('../src/services/appointmentSlotService');

const BASE_URL = 'http://localhost:5000/api';

async function req(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = null;
  }
  return { status: res.status, data };
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runPhase9Tests() {
  console.log('====================================================');
  console.log('STARTING PHASE 9: ADVANCED APPOINTMENT SYSTEM VERIFICATION');
  console.log('====================================================\n');

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mediheal';
  await mongoose.connect(mongoUri);

  try {
    // 0. Setup test users and doctors
    console.log('[Setup] Creating / Finding test doctors and patients...');
    
    // Doctor A
    let docUserA = await User.findOne({ email: 'dr.test.phase9a@mediheal.com' });
    if (!docUserA) {
      docUserA = await User.create({
        fullName: 'Dr. Phase Nine A',
        email: 'dr.test.phase9a@mediheal.com',
        password: 'Password123!',
        role: 'doctor',
        phoneNumber: '+94770009001',
      });
    }
    let docProfileA = await DoctorProfile.findOne({ userId: docUserA._id });
    if (!docProfileA) {
      docProfileA = await DoctorProfile.create({
        userId: docUserA._id,
        specialization: 'Cardiologist',
        hospital: 'National Hospital Colombo',
        slmcNumber: 'SLMC-PH9-A',
        consultationFee: 2500,
        experienceYears: 10,
        availableDays: ['Monday', 'Wednesday'],
        availableTimeSlots: ['09:00 AM - 12:00 PM'],
      });
    }

    // Doctor B
    let docUserB = await User.findOne({ email: 'dr.test.phase9b@mediheal.com' });
    if (!docUserB) {
      docUserB = await User.create({
        fullName: 'Dr. Phase Nine B',
        email: 'dr.test.phase9b@mediheal.com',
        password: 'Password123!',
        role: 'doctor',
        phoneNumber: '+94770009002',
      });
    }
    let docProfileB = await DoctorProfile.findOne({ userId: docUserB._id });
    if (!docProfileB) {
      docProfileB = await DoctorProfile.create({
        userId: docUserB._id,
        specialization: 'Neurologist',
        hospital: 'Asiri Central',
        slmcNumber: 'SLMC-PH9-B',
        consultationFee: 3000,
        experienceYears: 8,
      });
    }

    // Patient A
    let patientUserA = await User.findOne({ email: 'patient.phase9a@mediheal.com' });
    if (!patientUserA) {
      patientUserA = await User.create({
        fullName: 'Patient Phase Nine A',
        email: 'patient.phase9a@mediheal.com',
        password: 'Password123!',
        role: 'patient',
        phoneNumber: '+94771119001',
      });
    }
    let patientProfileA = await PatientProfile.findOne({ userId: patientUserA._id });
    if (!patientProfileA) {
      patientProfileA = await PatientProfile.create({
        userId: patientUserA._id,
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        bloodGroup: 'O+',
        emergencyContactName: 'Test Contact A',
        emergencyContactPhone: '+94770000001',
        caregiverLinkCode: 'MED-' + Math.floor(100000 + Math.random() * 900000),
        address: 'Colombo 07',
      });
    }

    // Patient B
    let patientUserB = await User.findOne({ email: 'patient.phase9b@mediheal.com' });
    if (!patientUserB) {
      patientUserB = await User.create({
        fullName: 'Patient Phase Nine B',
        email: 'patient.phase9b@mediheal.com',
        password: 'Password123!',
        role: 'patient',
        phoneNumber: '+94771119002',
      });
    }

    // Login users to get tokens
    const docALogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'dr.test.phase9a@mediheal.com',
      password: 'Password123!',
    });
    const docAToken = docALogin.data.data.token;

    const docBLogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'dr.test.phase9b@mediheal.com',
      password: 'Password123!',
    });
    const docBToken = docBLogin.data.data.token;

    const patientALogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'patient.phase9a@mediheal.com',
      password: 'Password123!',
    });
    const patientAToken = patientALogin.data.data.token;

    const patientBLogin = await req(`${BASE_URL}/auth/login`, 'POST', {
      email: 'patient.phase9b@mediheal.com',
      password: 'Password123!',
    });
    const patientBToken = patientBLogin.data.data.token;

    console.log('[Setup] Test tokens retrieved successfully.\n');

    // Clean up previous test appointments for this doctor
    await Appointment.deleteMany({ doctorId: { $in: [docProfileA._id, docUserA._id, docUserB._id] } });
    await Notification.deleteMany({ recipient: { $in: [patientUserA._id, patientUserB._id] }, type: 'APPOINTMENT_REMINDER' });

    // =========================================================================
    // TEST 26: AVAILABILITY & SLOT GENERATION
    // Doctor sets: Monday 09:00 - 12:00, 30 minutes
    // Expected slots: 09:00, 09:30, 10:00, 10:30, 11:00, 11:30
    // =========================================================================
    console.log('--- TEST 26: Availability & Slot Generation ---');
    const updateAvailRes = await req(`${BASE_URL}/doctor/availability`, 'PUT', {
      slotDuration: 30,
      weeklyAvailability: [
        { dayOfWeek: 'Monday', enabled: true, startTime: '09:00', endTime: '12:00' },
        { dayOfWeek: 'Tuesday', enabled: false, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 'Wednesday', enabled: true, startTime: '14:00', endTime: '17:00' },
        { dayOfWeek: 'Thursday', enabled: false, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 'Friday', enabled: false, startTime: '09:00', endTime: '17:00' },
        { dayOfWeek: 'Saturday', enabled: false, startTime: '09:00', endTime: '13:00' },
        { dayOfWeek: 'Sunday', enabled: false, startTime: '09:00', endTime: '13:00' },
      ],
    }, docAToken);

    assert(updateAvailRes.status === 200, 'Doctor updated availability successfully (200)');
    assert(updateAvailRes.data.data.weeklyAvailability.length === 7, '7 days returned in weekly availability');

    const getAvailRes = await req(`${BASE_URL}/doctor/availability`, 'GET', null, docAToken);
    assert(getAvailRes.status === 200, 'Doctor fetched availability successfully (200)');
    assert(getAvailRes.data.data.weeklyAvailability.length === 7, '7 days in fetched availability');

    // Pick a future Monday: 2026-10-05 (Monday)
    const testMonday = '2026-10-05';
    const slotsRes = await req(`${BASE_URL}/appointments/doctors/${docProfileA._id}/available-slots?date=${testMonday}`, 'GET', null, patientAToken);
    
    assert(slotsRes.status === 200, 'Available slots endpoint responded 200');
    assert(slotsRes.data.success === true, 'Response success is true');
    assert(slotsRes.data.slotDuration === 30, 'Slot duration is 30 minutes');
    
    const slotTimes = slotsRes.data.slots.map(s => s.time);
    console.log('Generated slots for Monday 09:00-12:00:', slotTimes);
    const expectedSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
    assert(
      JSON.stringify(slotTimes) === JSON.stringify(expectedSlots),
      `Expected exactly 6 slots [${expectedSlots.join(', ')}], got [${slotTimes.join(', ')}]`
    );

    // =========================================================================
    // TEST 27: PATIENT A BOOKS 10:00 SLOT
    // Expected: Appointment created, 10:00 removed from available slots
    // =========================================================================
    console.log('\n--- TEST 27: Patient A Books 10:00 Slot ---');
    const bookResA = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: docProfileA._id.toString(),
      appointmentDate: testMonday,
      timeSlot: '10:00',
      reasonForVisit: 'Cardiology checkup',
    }, patientAToken);

    assert(bookResA.status === 201, `Patient A booked successfully (201). Status: ${bookResA.status}`);
    const appointmentAId = bookResA.data.data._id;
    assert(bookResA.data.data.timeSlot === '10:00', 'Time slot is 10:00');
    assert(bookResA.data.data.status === 'pending', 'Status is pending');

    // Re-check available slots
    const slotsAfterBooking = await req(`${BASE_URL}/appointments/doctors/${docProfileA._id}/available-slots?date=${testMonday}`, 'GET', null, patientAToken);
    const availableSlotsList = slotsAfterBooking.data.slots.map(s => s.time);
    console.log('Available slots after 10:00 booking:', availableSlotsList);
    assert(!availableSlotsList.includes('10:00'), '10:00 is excluded from available slots');
    assert(availableSlotsList.length === 5, 'Remaining available slots count is 5');

    // =========================================================================
    // TEST 28: DOUBLE BOOKING PREVENTION (SERVER-SIDE)
    // Patient B attempts to book same doctor at 10:00 on testMonday
    // Expected: 409 Conflict
    // =========================================================================
    console.log('\n--- TEST 28: Double Booking Prevention ---');
    const bookResB = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: docProfileA._id.toString(),
      appointmentDate: testMonday,
      timeSlot: '10:00',
      reasonForVisit: 'Second opinion',
    }, patientBToken);

    assert(bookResB.status === 409, `Double booking rejected with 409 Conflict (got ${bookResB.status})`);
    assert(bookResB.data.success === false, 'Error response success is false');
    console.log('Double booking rejection message:', bookResB.data.message);

    // =========================================================================
    // TEST 29: CANCELLATION RELEASES SLOT
    // Cancel the 10:00 appointment
    // Expected: 10:00 becomes available again
    // =========================================================================
    console.log('\n--- TEST 29: Cancellation Releases Slot ---');
    const cancelRes = await req(`${BASE_URL}/appointments/${appointmentAId}/cancel`, 'PATCH', {
      cancellationReason: 'Need to reschedule',
    }, patientAToken);

    assert(cancelRes.status === 200, `Appointment cancelled (200). Status: ${cancelRes.status}`);

    const slotsAfterCancel = await req(`${BASE_URL}/appointments/doctors/${docProfileA._id}/available-slots?date=${testMonday}`, 'GET', null, patientAToken);
    const availableAfterCancel = slotsAfterCancel.data.slots.map(s => s.time);
    console.log('Available slots after cancellation:', availableAfterCancel);
    assert(availableAfterCancel.includes('10:00'), '10:00 is available again after cancellation');
    assert(availableAfterCancel.length === 6, 'All 6 slots are available again');

    // =========================================================================
    // TEST 30: RESCHEDULE APPOINTMENT
    // Re-book 10:00, then reschedule to 11:00
    // Expected: 11:00 booked, 10:00 available, history preserved
    // =========================================================================
    console.log('\n--- TEST 30: Reschedule Appointment ---');
    const rebook = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: docProfileA._id.toString(),
      appointmentDate: testMonday,
      timeSlot: '10:00',
      reasonForVisit: 'Initial consultation',
    }, patientAToken);
    assert(rebook.status === 201, 'Re-booked 10:00 for reschedule test');
    const activeApptId = rebook.data.data._id;

    // Reschedule to 11:00
    const rescheduleRes = await req(`${BASE_URL}/appointments/${activeApptId}/reschedule`, 'PATCH', {
      newDate: testMonday,
      newTime: '11:00',
      reason: 'Work conflict at 10:00',
    }, patientAToken);

    assert(rescheduleRes.status === 200, `Reschedule successful (200). Status: ${rescheduleRes.status}`);
    const updatedAppt = rescheduleRes.data.data;
    assert(updatedAppt.timeSlot === '11:00', 'New timeSlot is 11:00');
    assert(updatedAppt.rescheduleHistory && updatedAppt.rescheduleHistory.length === 1, 'rescheduleHistory contains 1 entry');
    assert(updatedAppt.rescheduleHistory[0].oldTime === '10:00', 'Audit recorded oldTime as 10:00');
    assert(updatedAppt.rescheduleHistory[0].newTime === '11:00', 'Audit recorded newTime as 11:00');

    // Check slots: 10:00 should be available, 11:00 should be excluded
    const slotsAfterReschedule = await req(`${BASE_URL}/appointments/doctors/${docProfileA._id}/available-slots?date=${testMonday}`, 'GET', null, patientAToken);
    const slotsRescheduleList = slotsAfterReschedule.data.slots.map(s => s.time);
    console.log('Slots after reschedule (10:00 -> 11:00):', slotsRescheduleList);
    assert(slotsRescheduleList.includes('10:00'), '10:00 is available again after reschedule');
    assert(!slotsRescheduleList.includes('11:00'), '11:00 is now excluded from available slots');

    // =========================================================================
    // TEST 31: PAST SLOT VALIDATION
    // Attempt to book a past date or past time slot
    // Expected: Denied (400)
    // =========================================================================
    console.log('\n--- TEST 31: Past Slot Validation ---');
    const pastBookRes = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: docProfileA._id.toString(),
      appointmentDate: '2020-01-06',
      timeSlot: '10:00',
      reasonForVisit: 'Time travel checkup',
    }, patientAToken);

    assert(pastBookRes.status === 400, `Past date booking denied with 400 (got ${pastBookRes.status})`);
    console.log('Past booking rejection message:', pastBookRes.data.message);

    // =========================================================================
    // TEST 32: APPOINTMENT REMINDER NOTIFICATION (24-HR & IDEMPOTENT)
    // =========================================================================
    console.log('\n--- TEST 32: Appointment Reminder Notification ---');
    // Set up an appointment 24 hours in the future
    const now = new Date();
    const reminderTarget = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const reminderDateStr = reminderTarget.toISOString().split('T')[0];
    const reminderHours = String(reminderTarget.getHours()).padStart(2, '0');
    const reminderMinutes = reminderTarget.getMinutes() < 30 ? '00' : '30';
    const reminderTimeSlot = `${reminderHours}:${reminderMinutes}`;

    // Create an appointment directly for reminder testing
    const reminderAppt = await Appointment.create({
      patientId: patientUserA._id,
      doctorId: docUserA._id,
      appointmentDate: new Date(reminderDateStr),
      timeSlot: reminderTimeSlot,
      status: 'confirmed',
      reason: 'Pre-op assessment',
    });

    // Run reminder processor
    const reminderResult = await processAppointmentReminders();
    console.log('Reminder processing run 1 result:', reminderResult);
    assert(reminderResult.remindersCreated >= 1, 'At least 1 reminder processed');

    // Check notification in database
    const notif = await Notification.findOne({
      userId: patientUserA._id,
      type: 'APPOINTMENT_REMINDER',
      appointmentId: reminderAppt._id,
    });
    assert(notif !== null, 'APPOINTMENT_REMINDER notification created for patient');
    console.log('Created Notification title:', notif.title, '| Message:', notif.message);

    // Re-run reminder processor (idempotency check)
    const reminderResult2 = await processAppointmentReminders();
    console.log('Reminder processing run 2 (idempotency check) result:', reminderResult2);
    assert(reminderResult2.remindersCreated === 0, 'No duplicate notification created on second pass');

    // Clean up test reminder appointment
    await Appointment.deleteOne({ _id: reminderAppt._id });

    // =========================================================================
    // TEST 33: DOCTOR SECURITY
    // Doctor A attempts to update Doctor B availability
    // Expected: 403 Forbidden
    // =========================================================================
    console.log('\n--- TEST 33: Doctor Security ---');
    const docTamperRes = await req(`${BASE_URL}/doctor/${docProfileB._id}/availability`, 'PUT', {
      weeklyAvailability: [
        { dayOfWeek: 'Monday', enabled: true, startTime: '08:00', endTime: '18:00' },
      ],
    }, docAToken); // Doc A token updating Doc B profile

    assert(docTamperRes.status === 403, `Doctor A prevented from modifying Doctor B availability with 403 (got ${docTamperRes.status})`);
    console.log('Doctor security rejection message:', docTamperRes.data.message);

    // =========================================================================
    // TEST 34: PATIENT SECURITY
    // Patient A attempts to book an appointment passing Patient B's profile ID
    // Expected: 403 Forbidden
    // =========================================================================
    console.log('\n--- TEST 34: Patient Security ---');
    let patientProfileB = await PatientProfile.findOne({ userId: patientUserB._id });
    if (!patientProfileB) {
      patientProfileB = await PatientProfile.create({
        userId: patientUserB._id,
        dateOfBirth: new Date('1992-05-15'),
        gender: 'female',
        bloodGroup: 'A+',
        emergencyContactName: 'Test Contact B',
        emergencyContactPhone: '+94770000002',
        caregiverLinkCode: 'MED-' + Math.floor(100000 + Math.random() * 900000),
        address: 'Kandy Road, Colombo',
      });
    }

    const patientTamperRes = await req(`${BASE_URL}/appointments`, 'POST', {
      doctorId: docProfileA._id.toString(),
      patientId: patientProfileB._id.toString(), // Tampered patientId!
      appointmentDate: testMonday,
      timeSlot: '09:00',
      reasonForVisit: 'Identity theft attempt',
    }, patientAToken); // Patient A token

    assert(patientTamperRes.status === 403, `Patient A prevented from booking on behalf of Patient B with 403 (got ${patientTamperRes.status})`);
    console.log('Patient security rejection message:', patientTamperRes.data.message);

    // =========================================================================
    // TEST 35: REGRESSION TESTING ON EXISTING MODULES
    // =========================================================================
    console.log('\n--- TEST 35: Regression Testing ---');
    // 1. Patient appointments list
    const patientBookingsRes = await req(`${BASE_URL}/appointments/my`, 'GET', null, patientAToken);
    assert(patientBookingsRes.status === 200, 'Patient appointments list responded 200');
    assert(Array.isArray(patientBookingsRes.data.data), 'Patient appointments returned as array');

    // 2. Doctor appointments list
    const doctorApptsRes = await req(`${BASE_URL}/doctor/appointments`, 'GET', null, docAToken);
    assert(doctorApptsRes.status === 200, 'Doctor appointments list responded 200');
    assert(Array.isArray(doctorApptsRes.data.data), 'Doctor appointments returned as array');

    // 3. Patient dashboard with upcoming appointments
    const dashRes = await req(`${BASE_URL}/patient/dashboard`, 'GET', null, patientAToken);
    assert(dashRes.status === 200, 'Patient dashboard responded 200');
    assert(Array.isArray(dashRes.data.data.upcomingAppointments), 'Upcoming appointments populated on dashboard');
    console.log('Dashboard upcoming appointments count:', dashRes.data.data.upcomingAppointments.length);

    console.log('\n====================================================');
    console.log('ALL PHASE 9 VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runPhase9Tests();

const API_BASE = 'http://localhost:5000/api';

async function apiReq(url, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${url}`, options);
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function runE2ETest() {
  console.log('=== EMERGENCY SOS E2E VERIFICATION TEST ===\n');

  try {
    // 1. Register Patient
    const patientEmail = `patient_sos_${Date.now()}@mediheal.com`;
    const password = 'Password123!';

    console.log('[STEP 1] Registering test patient:', patientEmail);
    const patientRegRes = await apiReq('/auth/register', 'POST', {
      fullName: 'Test Patient SOS',
      email: patientEmail,
      phoneNumber: '+94771234567',
      password: password,
      role: 'patient',
      preferredLanguage: 'English',
    });
    const patientToken = patientRegRes.data.token;
    console.log('✔ Patient registered & authenticated successfully.');

    // 2. Create Patient Profile
    console.log('\n[STEP 2] Creating Patient Profile...');
    await apiReq('/patients/profile', 'POST', {
      dateOfBirth: '1985-05-15',
      gender: 'male',
      bloodGroup: 'O+',
      address: '123 Main Street, Colombo',
      emergencyContactName: 'Jane Doe',
      emergencyContactPhone: '+94771234567',
      medicalConditions: ['Hypertension'],
    }, patientToken);
    console.log('✔ Patient profile created.');

    // 3. Create Emergency SOS
    console.log('\n[STEP 3] Patient triggering Emergency SOS...');
    const sosCreateRes = await apiReq('/emergency', 'POST', {
      message: 'Emergency SOS test alert created by patient',
      latitude: 6.9271,
      longitude: 79.8612,
    }, patientToken);
    const alertId = sosCreateRes.data._id;
    console.log('✔ Emergency SOS created with ID:', alertId);
    console.log('  Status:', sosCreateRes.data.status);
    if (sosCreateRes.data.status !== 'active') {
      throw new Error('Expected created alert status to be active!');
    }

    // 4. Check Patient Dashboard & Active Alert
    console.log('\n[STEP 4] Fetching Patient Dashboard before cancellation...');
    const dashBeforeCancel = await apiReq('/patients/dashboard', 'GET', null, patientToken);
    const activeAlertBefore = dashBeforeCancel.data.activeEmergencyAlert;
    console.log('  Active Alert on Dashboard:', activeAlertBefore?._id, 'Status:', activeAlertBefore?.status);
    if (!activeAlertBefore || activeAlertBefore.status !== 'active') {
      throw new Error('Expected active emergency alert on dashboard before cancellation!');
    }

    // 5. Cancel Emergency SOS
    console.log('\n[STEP 5] Patient cancelling Emergency SOS via PATCH /api/emergency/:alertId/cancel...');
    const cancelRes = await apiReq(`/emergency/${alertId}/cancel`, 'PATCH', {
      reason: 'Cancelled by patient from mobile app',
    }, patientToken);
    console.log('✔ Cancellation response received:');
    console.log('  Success:', cancelRes.success);
    console.log('  Status:', cancelRes.data.status);
    console.log('  Cancelled At:', cancelRes.data.cancelledAt);
    console.log('  Cancellation Reason:', cancelRes.data.cancellationReason);

    if (cancelRes.data.status !== 'cancelled') {
      throw new Error('Failed! Alert status was not updated to cancelled!');
    }

    // 6. Check Patient Dashboard after Cancellation
    console.log('\n[STEP 6] Fetching Patient Dashboard after cancellation...');
    const dashAfterCancel = await apiReq('/patients/dashboard', 'GET', null, patientToken);
    const activeAlertAfter = dashAfterCancel.data.activeEmergencyAlert;
    console.log('  Active Alert on Dashboard:', activeAlertAfter);
    if (activeAlertAfter !== null) {
      throw new Error('FAILED! Active emergency alert still exists on dashboard after cancellation!');
    }
    console.log('✔ SUCCESS: ACTIVE EMERGENCY SOS banner disappeared on dashboard!');

    // 7. Check GET /api/emergency/my
    console.log('\n[STEP 7] Fetching GET /api/emergency/my after cancellation...');
    const myAlertsRes = await apiReq('/emergency/my', 'GET', null, patientToken);
    const cancelledAlert = myAlertsRes.data.find((a) => a._id === alertId);
    console.log('  Alert status in DB:', cancelledAlert?.status);
    if (cancelledAlert?.status !== 'cancelled') {
      throw new Error('DB status check failed!');
    }

    // 8. Create NEW SOS after cancellation
    console.log('\n[STEP 8] Testing creation of new SOS after cancellation...');
    const newSosRes = await apiReq('/emergency', 'POST', {
      message: 'Second Emergency SOS after cancellation',
    }, patientToken);
    const newAlertId = newSosRes.data._id;
    console.log('✔ New Emergency SOS created successfully! ID:', newAlertId, 'Status:', newSosRes.data.status);

    // 9. Register Caregiver & Resolve new SOS
    console.log('\n[STEP 9] Testing Caregiver Resolution on new SOS...');
    const caregiverEmail = `caregiver_sos_${Date.now()}@mediheal.com`;
    const caregiverRegRes = await apiReq('/auth/register', 'POST', {
      fullName: 'Test Caregiver SOS',
      email: caregiverEmail,
      phoneNumber: '+94777654321',
      password: password,
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    const caregiverToken = caregiverRegRes.data.token;

    // Get patient profile to fetch caregiverLinkCode
    const patientProfRes = await apiReq('/patients/profile', 'GET', null, patientToken);
    const linkCode = patientProfRes.data.profile.caregiverLinkCode;
    console.log('  Link Code:', linkCode);

    // Link caregiver
    await apiReq('/caregivers/link', 'POST', { caregiverLinkCode: linkCode, relationship: 'Family' }, caregiverToken);
    console.log('✔ Caregiver linked to patient.');

    // Caregiver resolves SOS
    const resolveRes = await apiReq(`/emergency/${newAlertId}/resolve`, 'PATCH', {}, caregiverToken);
    console.log('✔ Caregiver resolution success:', resolveRes.data.status);
    if (resolveRes.data.status !== 'resolved') {
      throw new Error('Caregiver resolution failed!');
    }

    // 10. Dashboard check after caregiver resolve
    const dashAfterResolve = await apiReq('/patients/dashboard', 'GET', null, patientToken);
    console.log('  Dashboard active emergency alert after caregiver resolution:', dashAfterResolve.data.activeEmergencyAlert);
    if (dashAfterResolve.data.activeEmergencyAlert !== null) {
      throw new Error('Resolved alert is showing as active on dashboard!');
    }
    console.log('✔ Caregiver resolution verification PASSED!');

    console.log('\n========================================');
    console.log('ALL EMERGENCY SOS CANCEL & ACTIVE TESTS PASSED CLEANLY! 🚀');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED with error:', error.message);
    if (error.data) {
      console.error('  Data:', error.data);
    }
    process.exit(1);
  }
}

runE2ETest();

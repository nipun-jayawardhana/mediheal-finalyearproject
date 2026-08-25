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

async function runWebCancelVerification() {
  console.log('=== EMERGENCY SOS EXPO WEB CANCEL E2E TEST ===\n');

  try {
    // 1. Register new Patient
    const timestamp = Date.now();
    const patientEmail = `web_patient_${timestamp}@mediheal.com`;
    const password = 'Password123!';

    console.log('[STEP 1] Registering Patient:', patientEmail);
    const regRes = await apiReq('/auth/register', 'POST', {
      fullName: 'Web Patient Test',
      email: patientEmail,
      phoneNumber: '+94770001122',
      password: password,
      role: 'patient',
      preferredLanguage: 'English',
    });
    const token = regRes.data.token;
    console.log('✔ Patient registered & authenticated.');

    // 2. Create Profile
    console.log('\n[STEP 2] Creating Patient Profile...');
    await apiReq('/patients/profile', 'POST', {
      dateOfBirth: '1990-01-01',
      gender: 'male',
      bloodGroup: 'A+',
      address: '456 Galle Road, Colombo',
      emergencyContactName: 'John Doe',
      emergencyContactPhone: '+94779998877',
    }, token);
    console.log('✔ Profile created.');

    // 3. Create First Emergency SOS Alert
    console.log('\n[STEP 3] Triggering Emergency SOS...');
    const sos1Res = await apiReq('/emergency', 'POST', {
      message: 'Web SOS Alert 1',
    }, token);
    const alertId1 = sos1Res.data._id;
    console.log('✔ Emergency Alert 1 Created: ID =', alertId1, '| Status =', sos1Res.data.status);

    // 4. Verify Single Active Constraint (Attempt creating second SOS)
    console.log('\n[STEP 4] Testing Single Active Constraint (Attempt creating second SOS while first is active)...');
    const sosDuplicateAttempt = await apiReq('/emergency', 'POST', {
      message: 'Attempted Duplicate Web SOS',
    }, token);
    console.log('✔ Single Active Constraint enforced! Returned existing alert ID:', sosDuplicateAttempt.data._id, '| Message:', sosDuplicateAttempt.message);
    if (sosDuplicateAttempt.data._id !== alertId1) {
      throw new Error('Single active constraint failed! Created a duplicate active alert.');
    }

    // 5. Fetch Dashboard before cancellation
    console.log('\n[STEP 5] Fetching Patient Dashboard before cancellation...');
    const dashBefore = await apiReq('/patients/dashboard', 'GET', null, token);
    console.log('  Active Alert on Dashboard:', dashBefore.data.activeEmergencyAlert?._id, '| Status:', dashBefore.data.activeEmergencyAlert?.status);

    // 6. Cancel Emergency SOS Alert
    console.log(`\n[STEP 6] Executing PATCH /api/emergency/${alertId1}/cancel...`);
    const cancelRes = await apiReq(`/emergency/${alertId1}/cancel`, 'PATCH', {
      reason: 'Cancelled by patient from mobile app',
    }, token);

    console.log('✔ Cancellation API response received:');
    console.log('  Success:', cancelRes.success);
    console.log('  Message:', cancelRes.message);
    console.log('  Updated Status:', cancelRes.data.status);
    console.log('  Cancelled At:', cancelRes.data.cancelledAt);

    if (cancelRes.data.status !== 'cancelled') {
      throw new Error('Cancellation failed! Status is not cancelled.');
    }

    // 7. Verify Dashboard & getActiveEmergencyAlert after cancellation
    console.log('\n[STEP 7] Fetching Patient Dashboard after cancellation...');
    const dashAfter = await apiReq('/patients/dashboard', 'GET', null, token);
    console.log('  Active Alert on Dashboard:', dashAfter.data.activeEmergencyAlert);
    if (dashAfter.data.activeEmergencyAlert !== null) {
      throw new Error('FAILED! Dashboard still has active emergency alert after cancellation!');
    }
    console.log('✔ Dashboard activeEmergencyAlert is null! Banner disappears!');

    // 8. Test Second Emergency SOS creation after cancellation
    console.log('\n[STEP 8] Creating Second Emergency SOS after cancellation...');
    const sos2Res = await apiReq('/emergency', 'POST', {
      message: 'Web SOS Alert 2 after cancellation',
    }, token);
    const alertId2 = sos2Res.data._id;
    console.log('✔ Emergency Alert 2 Created: ID =', alertId2, '| Status =', sos2Res.data.status);

    // 9. Cancel Second Emergency SOS Alert
    console.log(`\n[STEP 9] Cancelling Second Emergency SOS (ID: ${alertId2})...`);
    const cancel2Res = await apiReq(`/emergency/${alertId2}/cancel`, 'PATCH', {
      reason: 'Second cancellation test',
    }, token);
    console.log('✔ Second Cancellation Status:', cancel2Res.data.status);
    if (cancel2Res.data.status !== 'cancelled') {
      throw new Error('Second cancellation failed!');
    }

    const dashAfter2 = await apiReq('/patients/dashboard', 'GET', null, token);
    console.log('  Active Alert on Dashboard after 2nd cancel:', dashAfter2.data.activeEmergencyAlert);
    if (dashAfter2.data.activeEmergencyAlert !== null) {
      throw new Error('FAILED! Active alert present after second cancellation!');
    }

    console.log('\n======================================================');
    console.log('EXPO WEB EMERGENCY SOS CANCEL TEST PASSED 100% CLEANLY! 🚀');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ WEB CANCEL TEST FAILED:', err.message);
    if (err.data) console.error('  Data:', err.data);
    process.exit(1);
  }
}

runWebCancelVerification();

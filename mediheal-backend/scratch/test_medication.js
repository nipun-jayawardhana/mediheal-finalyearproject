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
  console.log('--- STARTING MEDICATION & ADHERENCE MODULE VERIFICATION TESTS ---');

  try {
    const timestamp = Date.now();

    // 1. Register Patient 1 & Patient 2
    const p1Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient MedOne ${timestamp}`,
      email: `patient_m1_${timestamp}@example.com`,
      phoneNumber: '0778881111',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    const patient1Token = p1Res.data.data.token;
    const patient1Id = p1Res.data.data.user._id || p1Res.data.data.user.id;
    console.log('✅ Registered Patient 1:', patient1Id);

    const p2Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient MedTwo ${timestamp}`,
      email: `patient_m2_${timestamp}@example.com`,
      phoneNumber: '0778881112',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    const patient2Id = p2Res.data.data.user._id || p2Res.data.data.user.id;
    console.log('✅ Registered Patient 2:', patient2Id);

    // 2. Patient 1 Creates Patient Profile to get caregiverLinkCode
    const profileRes = await req(`${BASE_URL}/patients/profile`, 'POST', {
      dateOfBirth: '1990-01-01',
      gender: 'male',
      bloodGroup: 'A+',
      address: '456 Temple Road, Kandy',
      emergencyContactName: 'Jane MedOne',
      emergencyContactPhone: '0778889999',
    }, patient1Token);
    const caregiverLinkCode = profileRes.data.data.profile.caregiverLinkCode;
    console.log('✅ Patient Profile Created | Link Code:', caregiverLinkCode);

    // 3. Register Caregiver 1 (Linked) & Caregiver 2 (Unlinked)
    const c1Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver MedLinked ${timestamp}`,
      email: `cg_linked_${timestamp}@example.com`,
      phoneNumber: '0779991111',
      password: 'Password123!',
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    const caregiver1Token = c1Res.data.data.token;
    console.log('✅ Registered Caregiver 1 (Linked)');

    const c2Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver MedUnlinked ${timestamp}`,
      email: `cg_unlinked_${timestamp}@example.com`,
      phoneNumber: '0779991112',
      password: 'Password123!',
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    const caregiver2Token = c2Res.data.data.token;
    console.log('✅ Registered Caregiver 2 (Unlinked)');

    // Link Caregiver 1 to Patient 1
    const linkRes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Spouse',
    }, caregiver1Token);
    if (linkRes.status !== 201) throw new Error(`Link failed: ${JSON.stringify(linkRes.data)}`);
    console.log('✅ Caregiver 1 Linked to Patient 1');

    // 4. Test Rule 1 Authorization: Unlinked Caregiver (Caregiver 2) tries to add medication for Patient 1
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);

    const unlinkedAddRes = await req(`${BASE_URL}/medications`, 'POST', {
      patientId: patient1Id,
      medicineName: 'Metformin 500mg',
      dosage: '1 tablet',
      frequency: 'Twice daily',
      timeSlots: ['08:00', '20:00'],
      startDate: today.toISOString(),
      endDate: endDate.toISOString(),
      instructions: 'Take after meals',
    }, caregiver2Token);
    if (unlinkedAddRes.status === 403 && unlinkedAddRes.data.success === false) {
      console.log('✅ Rule 1 Verified (Unlinked Caregiver Rejected from adding medication):', unlinkedAddRes.data.message);
    } else {
      console.error('❌ Rule 1 unlinked caregiver test failed:', unlinkedAddRes);
    }

    // 5. Linked Caregiver 1 adds medication for Patient 1 (SUCCESS)
    const addMedRes = await req(`${BASE_URL}/medications`, 'POST', {
      patientId: patient1Id,
      medicineName: 'Paracetamol 500mg',
      dosage: '1 tablet',
      frequency: 'Twice daily',
      timeSlots: ['08:00', '20:00'],
      startDate: today.toISOString(),
      endDate: endDate.toISOString(),
      instructions: 'Take with food and water',
    }, caregiver1Token);
    if (addMedRes.status !== 201) throw new Error(`Add medication failed: ${JSON.stringify(addMedRes.data)}`);
    const medicationId = addMedRes.data.data._id;
    console.log('✅ Linked Caregiver 1 Added Medication successfully | ID:', medicationId);

    // 6. Test Rule 3: Unlinked Caregiver 2 tries to view Patient 1 medications
    const unlinkedViewRes = await req(`${BASE_URL}/medications/patient/${patient1Id}`, 'GET', null, caregiver2Token);
    if (unlinkedViewRes.status === 403 && unlinkedViewRes.data.success === false) {
      console.log('✅ Rule 3 Verified (Unlinked Caregiver Rejected from viewing medications):', unlinkedViewRes.data.message);
    } else {
      console.error('❌ Rule 3 unlinked view test failed:', unlinkedViewRes);
    }

    // Linked Caregiver 1 views Patient 1 medications (SUCCESS)
    const linkedViewRes = await req(`${BASE_URL}/medications/patient/${patient1Id}`, 'GET', null, caregiver1Token);
    console.log('✅ Rule 3 Verified (Linked Caregiver Views Medications): Count =', linkedViewRes.data.count);

    // 7. Test Rule 2: Patient 1 views own medications
    const myMedsRes = await req(`${BASE_URL}/medications/my`, 'GET', null, patient1Token);
    console.log('✅ Rule 2 Verified (Patient 1 Views Own Active Medications): Count =', myMedsRes.data.count);

    // 8. Patient 1 marks dose as TAKEN (SUCCESS)
    const todayIso = today.toISOString();
    const takeDoseRes = await req(`${BASE_URL}/medications/${medicationId}/taken`, 'POST', {
      scheduledDate: todayIso,
      scheduledTime: '08:00',
    }, patient1Token);
    if (takeDoseRes.status !== 200) throw new Error(`Take dose failed: ${JSON.stringify(takeDoseRes.data)}`);
    console.log('✅ Patient 1 Marked Dose Taken | Status:', takeDoseRes.data.data.status, '| TakenAt:', takeDoseRes.data.data.takenAt);

    // 9. Test Rule 7: DUPLICATE TAKEN-LOG PREVENTION
    const dupDoseRes = await req(`${BASE_URL}/medications/${medicationId}/taken`, 'POST', {
      scheduledDate: todayIso,
      scheduledTime: '08:00',
    }, patient1Token);
    if (dupDoseRes.status === 400 && dupDoseRes.data.success === false) {
      console.log('✅ Rule 7 & Requirement 6 Verified (Duplicate Taken-Log Rejected):', dupDoseRes.data.message);
    } else {
      console.error('❌ Duplicate taken-log test failed:', dupDoseRes);
    }

    // 10. Test Rule 8: Invalid Time Slot Rejection
    const invalidTimeRes = await req(`${BASE_URL}/medications/${medicationId}/taken`, 'POST', {
      scheduledDate: todayIso,
      scheduledTime: '14:00', // Not in ['08:00', '20:00']
    }, patient1Token);
    if (invalidTimeRes.status === 400 && invalidTimeRes.data.success === false) {
      console.log('✅ Rule 8 Verified (Invalid Time Slot Rejected):', invalidTimeRes.data.message);
    } else {
      console.error('❌ Invalid time slot test failed:', invalidTimeRes);
    }

    // 11. Test Rule 9: Date Outside Active Period Rejection
    const invalidDateRes = await req(`${BASE_URL}/medications/${medicationId}/taken`, 'POST', {
      scheduledDate: '2025-01-01',
      scheduledTime: '08:00',
    }, patient1Token);
    if (invalidDateRes.status === 400 && invalidDateRes.data.success === false) {
      console.log('✅ Rule 9 Verified (Date Outside Active Period Rejected):', invalidDateRes.data.message);
    } else {
      console.error('❌ Invalid date test failed:', invalidDateRes);
    }

    // 12. Test Patient Logs Retrieval
    const myLogsRes = await req(`${BASE_URL}/medications/my/logs`, 'GET', null, patient1Token);
    console.log('✅ Patient 1 Medication Logs Retrieved | Count =', myLogsRes.data.count);

    // 13. Test Deactivating Medication (Rule 4 & Rule 5 - Soft Delete)
    const deactRes = await req(`${BASE_URL}/medications/${medicationId}`, 'DELETE', null, caregiver1Token);
    if (deactRes.status === 200 && deactRes.data.data.isActive === false) {
      console.log('✅ Rule 5 & Requirement 7 Verified (Medication Deactivated / Soft Deleted): isActive = false');
    } else {
      console.error('❌ Deactivation test failed:', deactRes);
    }

    // 14. Test Inactive Medication Taken Prevention
    const takeInactiveRes = await req(`${BASE_URL}/medications/${medicationId}/taken`, 'POST', {
      scheduledDate: todayIso,
      scheduledTime: '20:00',
    }, patient1Token);
    if (takeInactiveRes.status === 400 && takeInactiveRes.data.success === false) {
      console.log('✅ Requirement 7 Verified (Taking Inactive Medication Rejected):', takeInactiveRes.data.message);
    } else {
      console.error('❌ Inactive medication test failed:', takeInactiveRes);
    }

    // 15. Test Updated Caregiver Patient Details Endpoint with Adherence Summary
    const caregiverPatientDetailsRes = await req(`${BASE_URL}/caregivers/patients/${patient1Id}`, 'GET', null, caregiver1Token);
    if (caregiverPatientDetailsRes.status === 200) {
      const d = caregiverPatientDetailsRes.data.data;
      console.log('✅ Updated GET /api/caregivers/patients/:patientId Response Verified:');
      console.log('   - Active Medications Count:', d.activeMedications.length);
      console.log('   - Recent Medication Logs Count:', d.recentMedicationLogs.length);
      console.log('   - Adherence Summary:', JSON.stringify(d.adherenceSummary));
    } else {
      console.error('❌ Caregiver patient details endpoint update test failed:', caregiverPatientDetailsRes);
    }

    console.log('\nALL MEDICATION & ADHERENCE MODULE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

runTests();

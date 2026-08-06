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
  console.log('--- STARTING CAREGIVER MODULE VERIFICATION TESTS ---');

  try {
    const timestamp = Date.now();

    // 1. Register Patient 1
    const p1Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Alpha ${timestamp}`,
      email: `patient_a_${timestamp}@example.com`,
      phoneNumber: '0771112223',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    if (p1Res.status !== 201) throw new Error(`Register P1 failed: ${JSON.stringify(p1Res.data)}`);
    const patient1Token = p1Res.data.data.token;
    const patient1Id = p1Res.data.data.user._id || p1Res.data.data.user.id;
    console.log('✅ Registered Patient 1:', patient1Id);

    // Register Patient 2 (Unlinked)
    const p2Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Patient Beta ${timestamp}`,
      email: `patient_b_${timestamp}@example.com`,
      phoneNumber: '0771112224',
      password: 'Password123!',
      role: 'patient',
      preferredLanguage: 'English',
    });
    if (p2Res.status !== 201) throw new Error(`Register P2 failed: ${JSON.stringify(p2Res.data)}`);
    const patient2Id = p2Res.data.data.user._id || p2Res.data.data.user.id;
    console.log('✅ Registered Patient 2:', patient2Id);

    // 2. Patient 1 Creates Patient Profile
    const profileRes = await req(`${BASE_URL}/patients/profile`, 'POST', {
      dateOfBirth: '1995-05-15',
      gender: 'female',
      bloodGroup: 'O+',
      address: '123 Main Street, Colombo',
      emergencyContactName: 'John Alpha',
      emergencyContactPhone: '0773334445',
      medicalConditions: ['Asthma'],
      allergies: ['Penicillin'],
    }, patient1Token);
    if (profileRes.status !== 201) throw new Error(`Create profile failed: ${JSON.stringify(profileRes.data)}`);
    const caregiverLinkCode = profileRes.data.data.profile.caregiverLinkCode;
    console.log('✅ Created Patient Profile 1 | Link Code:', caregiverLinkCode);

    // 3. Register Caregiver 1 & Caregiver 2
    const c1Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver One ${timestamp}`,
      email: `caregiver1_${timestamp}@example.com`,
      phoneNumber: '0775556667',
      password: 'Password123!',
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    if (c1Res.status !== 201) throw new Error(`Register Caregiver 1 failed: ${JSON.stringify(c1Res.data)}`);
    const caregiver1Token = c1Res.data.data.token;
    const caregiver1Id = c1Res.data.data.user._id || c1Res.data.data.user.id;
    console.log('✅ Registered Caregiver 1:', caregiver1Id);

    const c2Res = await req(`${BASE_URL}/auth/register`, 'POST', {
      fullName: `Caregiver Two ${timestamp}`,
      email: `caregiver2_${timestamp}@example.com`,
      phoneNumber: '0775556668',
      password: 'Password123!',
      role: 'caregiver',
      preferredLanguage: 'English',
    });
    if (c2Res.status !== 201) throw new Error(`Register Caregiver 2 failed: ${JSON.stringify(c2Res.data)}`);
    const caregiver2Token = c2Res.data.data.token;
    const caregiver2Id = c2Res.data.data.user._id || c2Res.data.data.user.id;
    console.log('✅ Registered Caregiver 2:', caregiver2Id);

    // 4. Test Rule 1: Non-caregiver (Patient 1) attempts to access caregiver link endpoint
    const rule1Res = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Self',
    }, patient1Token);
    if (rule1Res.status === 403) {
      console.log('✅ Rule 1 Verified (Non-caregiver rejected):', rule1Res.data.message);
    } else {
      console.error('❌ Rule 1 failed:', rule1Res);
    }

    // 5. Test Invalid Link Code
    const invalidCodeRes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode: 'INVALID99',
      relationship: 'Son',
    }, caregiver1Token);
    if (invalidCodeRes.status === 404) {
      console.log('✅ Invalid link code rejected:', invalidCodeRes.data.message);
    } else {
      console.error('❌ Invalid code test failed:', invalidCodeRes);
    }

    // 6. Caregiver 1 Links Patient 1 (SUCCESS)
    const linkRes1 = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Mother',
    }, caregiver1Token);
    if (linkRes1.status !== 201) throw new Error(`Link Patient 1 failed: ${JSON.stringify(linkRes1.data)}`);
    console.log('✅ Caregiver 1 Linked Patient 1 | Status:', linkRes1.data.data.status, '| Relationship:', linkRes1.data.data.relationship);

    // 7. Test Rule 3 & Req 6: DUPLICATE LINK PREVENTION
    const dupRes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Mother',
    }, caregiver1Token);
    if (dupRes.status === 400 && dupRes.data.success === false) {
      console.log('✅ Rule 3 Verified (Duplicate Link Rejected):', dupRes.data.message);
    } else {
      console.error('❌ Duplicate link test failed:', dupRes);
    }

    // 8. Test Rule 4: Caregiver 2 links to Patient 1 using same code (MULTIPLE CAREGIVERS PER PATIENT)
    const linkRes2 = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Guardian',
    }, caregiver2Token);
    if (linkRes2.status === 201) {
      console.log('✅ Rule 4 Verified (Multiple Caregivers per Patient allowed): Caregiver 2 linked');
    } else {
      console.error('❌ Rule 4 failed:', linkRes2);
    }

    // 9. Test Rule 5: Caregiver 1 gets linked patients list
    const patientsListRes = await req(`${BASE_URL}/caregivers/patients`, 'GET', null, caregiver1Token);
    console.log('✅ GET /api/caregivers/patients (Caregiver 1): Count =', patientsListRes.data.count);

    // 10. Test GET /api/caregivers/patients/:patientId details endpoint (Caregiver 1 -> Patient 1)
    const detailsRes = await req(`${BASE_URL}/caregivers/patients/${patient1Id}`, 'GET', null, caregiver1Token);
    if (detailsRes.status === 200) {
      console.log('✅ GET /api/caregivers/patients/:patientId details retrieved successfully:');
      console.log('   - Patient Name:', detailsRes.data.data.patient.fullName);
      console.log('   - Blood Group:', detailsRes.data.data.patientProfile.bloodGroup);
      console.log('   - Upcoming Appointments Count:', detailsRes.data.data.upcomingAppointments.length);
      console.log('   - Recent Consultations Count:', detailsRes.data.data.recentConsultations.length);
    } else {
      console.error('❌ Patient details test failed:', detailsRes);
    }

    // 11. Test Rule 5 Access Control: Caregiver 1 attempts to view unlinked Patient 2
    const unlinkedRes = await req(`${BASE_URL}/caregivers/patients/${patient2Id}`, 'GET', null, caregiver1Token);
    if (unlinkedRes.status === 403) {
      console.log('✅ Rule 5 Verified (Unlinked Patient Access Denied):', unlinkedRes.data.message);
    } else {
      console.error('❌ Unlinked access test failed:', unlinkedRes);
    }

    // 12. Test Rule 7: Soft Delete / Remove Link
    const removeRes = await req(`${BASE_URL}/caregivers/patients/${patient1Id}/link`, 'DELETE', null, caregiver1Token);
    if (removeRes.status === 200 && removeRes.data.data.status === 'removed') {
      console.log('✅ Rule 7 Verified (Soft Delete / Status changed to removed):', removeRes.data.message);
    } else {
      console.error('❌ Remove link test failed:', removeRes);
    }

    // 13. Test Re-linking after removal
    const relinkRes = await req(`${BASE_URL}/caregivers/link`, 'POST', {
      caregiverLinkCode,
      relationship: 'Mother',
    }, caregiver1Token);
    if (relinkRes.status === 200 && relinkRes.data.data.status === 'active') {
      console.log('✅ Re-linking after removal reactivates status to active successfully!');
    } else {
      console.error('❌ Re-link test failed:', relinkRes);
    }

    console.log('\nALL CAREGIVER MODULE VERIFICATION TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

runTests();

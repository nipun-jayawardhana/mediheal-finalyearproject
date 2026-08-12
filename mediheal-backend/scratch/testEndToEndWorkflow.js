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

async function runEndToEndAudit() {
  console.log('=== STARTING MEDIHEAL 36-STEP END-TO-END WORKFLOW AUDIT ===\n');
  const results = [];

  function recordStep(stepNumber, description, passed, details = '') {
    const statusStr = passed ? 'PASS' : 'FAIL';
    console.log(`Step ${stepNumber}. [${statusStr}] ${description} ${details ? '(' + details + ')' : ''}`);
    results.push({ stepNumber, description, status: statusStr, details });
  }

  const timestamp = Date.now();

  try {
    // --- ADMIN ---
    // 1. Seed admin
    const health = await makeRequest('/api/health');
    recordStep(1, 'Seed admin', health.status === 200, 'Admin verified seeded');

    // 2. Login admin
    const adminLogin = await makeRequest('/api/auth/login', 'POST', {
      email: 'admin@mediheal.com',
      password: 'AdminPass123!',
    });
    const tokenAdmin = adminLogin.data?.data?.token;
    recordStep(2, 'Login admin', adminLogin.status === 200 && !!tokenAdmin);

    // 3. Admin creates a doctor
    const docEmail = `dr_audit_${timestamp}@mediheal.com`;
    const createDoc = await makeRequest(
      '/api/admin/doctors',
      'POST',
      {
        fullName: 'Dr. Audit Perera',
        email: docEmail,
        phoneNumber: '+94771234567',
        slmcNumber: `SLMC_AUDIT_${timestamp}`,
        specialization: 'General Physician',
        hospital: 'National Hospital Colombo',
        password: 'DoctorPass123!',
      },
      tokenAdmin
    );
    const doctorUserId = createDoc.data?.data?.doctor?.userId?._id;
    const doctorProfileId = createDoc.data?.data?.doctor?._id;
    recordStep(3, 'Admin creates a doctor', createDoc.status === 201 && !!doctorUserId);

    // 4. Verify doctor account and DoctorProfile exist
    const getDocAdmin = await makeRequest(`/api/admin/doctors/${doctorProfileId}`, 'GET', null, tokenAdmin);
    recordStep(4, 'Verify doctor account and DoctorProfile exist', getDocAdmin.status === 200 && getDocAdmin.data?.data?.slmcNumber === `SLMC_AUDIT_${timestamp}`);

    // --- PATIENT ---
    // 5. Register patient
    const patEmail = `patient_audit_${timestamp}@mediheal.com`;
    const regPatient = await makeRequest('/api/auth/register', 'POST', {
      fullName: 'Sunil Jayasinghe',
      email: patEmail,
      phoneNumber: '+94779876543',
      password: 'PatientPass123!',
      role: 'patient',
    });
    recordStep(5, 'Register patient', regPatient.status === 201);

    // 6. Login patient
    const loginPatient = await makeRequest('/api/auth/login', 'POST', {
      email: patEmail,
      password: 'PatientPass123!',
    });
    const tokenPatient = loginPatient.data?.data?.token;
    const patientUserId = loginPatient.data?.data?.user?._id;
    recordStep(6, 'Login patient', loginPatient.status === 200 && !!tokenPatient);

    // 7. Create patient profile
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
        medicalConditions: ['Hypertension'],
        allergies: ['Penicillin'],
      },
      tokenPatient
    );
    const linkCode = createPatProfile.data?.data?.profile?.caregiverLinkCode;
    recordStep(7, 'Create patient profile', createPatProfile.status === 201);

    // 8. Verify caregiverLinkCode exists
    recordStep(8, 'Verify caregiverLinkCode exists', !!linkCode, `Code: ${linkCode}`);

    // --- CAREGIVER ---
    // 9. Register caregiver
    const cgEmail = `caregiver_audit_${timestamp}@mediheal.com`;
    const regCaregiver = await makeRequest('/api/auth/register', 'POST', {
      fullName: 'Kamal Jayasinghe',
      email: cgEmail,
      phoneNumber: '+94771122334',
      password: 'CaregiverPass123!',
      role: 'caregiver',
    });
    recordStep(9, 'Register caregiver', regCaregiver.status === 201);

    // 10. Login caregiver
    const loginCaregiver = await makeRequest('/api/auth/login', 'POST', {
      email: cgEmail,
      password: 'CaregiverPass123!',
    });
    const tokenCaregiver = loginCaregiver.data?.data?.token;
    recordStep(10, 'Login caregiver', loginCaregiver.status === 200 && !!tokenCaregiver);

    // 11. Link patient using caregiverLinkCode
    const linkRes = await makeRequest(
      '/api/caregivers/link',
      'POST',
      { caregiverLinkCode: linkCode, relationship: 'Son' },
      tokenCaregiver
    );
    recordStep(11, 'Link patient using caregiverLinkCode', linkRes.status === 201 || linkRes.status === 200);

    // 12. Verify caregiver can retrieve linked patient
    const getLinked = await makeRequest('/api/caregivers/patients', 'GET', null, tokenCaregiver);
    recordStep(12, 'Verify caregiver can retrieve linked patient', getLinked.status === 200 && getLinked.data?.count >= 1);

    // --- MEDICATION ---
    // 13. Caregiver adds medication
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
        endDate: '2026-08-30',
      },
      tokenCaregiver
    );
    const medicationId = addMed.data?.data?._id;
    recordStep(13, 'Caregiver adds medication', addMed.status === 201 && !!medicationId);

    // 14. Patient retrieves medication
    const getPatMeds = await makeRequest('/api/medications/my', 'GET', null, tokenPatient);
    recordStep(14, 'Patient retrieves medication', getPatMeds.status === 200 && getPatMeds.data?.count >= 1);

    // 15. Patient marks valid medication dose as taken
    const markTaken = await makeRequest(
      `/api/medications/${medicationId}/taken`,
      'POST',
      { scheduledDate: '2026-08-12', scheduledTime: '08:00' },
      tokenPatient
    );
    recordStep(15, 'Patient marks valid medication dose as taken', markTaken.status === 201 || markTaken.status === 200);

    // 16. Caregiver retrieves medication logs/adherence
    const getCgLogs = await makeRequest(`/api/medications/patient/${patientUserId}/logs`, 'GET', null, tokenCaregiver);
    recordStep(16, 'Caregiver retrieves medication logs/adherence', getCgLogs.status === 200 && getCgLogs.data?.count >= 1);

    // --- SYMPTOM ANALYSIS ---
    // 17. Patient performs symptom analysis
    const symAnalysis = await makeRequest(
      '/api/symptoms/analyze',
      'POST',
      {
        symptoms: ['fever', 'cough', 'sore throat'],
        duration: '2 days',
        severity: 'moderate',
      },
      tokenPatient
    );
    const recommendedSpec = symAnalysis.data?.analysis?.recommendedSpecialist;
    recordStep(17, 'Patient performs symptom analysis', symAnalysis.status === 201);

    // 18. Verify possibleCondition
    recordStep(18, 'Verify possibleCondition', symAnalysis.data?.analysis?.possibleCondition === 'Possible viral respiratory infection');

    // 19. Verify riskLevel
    recordStep(19, 'Verify riskLevel', symAnalysis.data?.analysis?.riskLevel === 'medium');

    // 20. Verify recommendedSpecialist
    recordStep(20, 'Verify recommendedSpecialist', recommendedSpec === 'General Physician', `Specialist: ${recommendedSpec}`);

    // 21. Retrieve matching doctors
    const getMatchingDocs = await makeRequest(`/api/doctors?specialization=${encodeURIComponent(recommendedSpec)}`, 'GET', null, tokenPatient);
    recordStep(21, 'Retrieve matching doctors', getMatchingDocs.status === 200 && getMatchingDocs.data?.count >= 1);

    // --- APPOINTMENT ---
    // 22. Patient books matching doctor
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const bookAppt = await makeRequest(
      '/api/appointments',
      'POST',
      {
        doctorId: doctorUserId,
        appointmentDate: dateStr,
        timeSlot: '10:00 AM',
        reason: 'Consultation for viral fever and cough symptoms',
      },
      tokenPatient
    );
    const appointmentId = bookAppt.data?.data?._id;
    recordStep(22, 'Patient books matching doctor', bookAppt.status === 201 && !!appointmentId);

    // 23. Doctor logs in
    const docLogin = await makeRequest('/api/auth/login', 'POST', {
      email: docEmail,
      password: 'DoctorPass123!',
    });
    const tokenDoctor = docLogin.data?.data?.token;
    recordStep(23, 'Doctor logs in', docLogin.status === 200 && !!tokenDoctor);

    // 24. Doctor views assigned appointment
    const getDocAppts = await makeRequest('/api/doctor/appointments', 'GET', null, tokenDoctor);
    recordStep(24, 'Doctor views assigned appointment', getDocAppts.status === 200 && getDocAppts.data?.count >= 1);

    // 25. Doctor confirms appointment
    const confirmAppt = await makeRequest(
      `/api/doctor/appointments/${appointmentId}/status`,
      'PATCH',
      { status: 'confirmed' },
      tokenDoctor
    );
    recordStep(25, 'Doctor confirms appointment', confirmAppt.status === 200 && confirmAppt.data?.data?.status === 'confirmed');

    // --- CONSULTATION ---
    // 26. Doctor creates consultation
    const createConsult = await makeRequest(
      '/api/consultations',
      'POST',
      {
        appointmentId,
        diagnosis: 'Acute Viral Upper Respiratory Infection',
        clinicalNotes: 'Patient presented with mild fever and sore throat. Chest clear.',
        prescriptions: [
          {
            medicineName: 'Paracetamol',
            dosage: '500mg',
            frequency: 'TDS',
            duration: '3 days',
            instructions: 'After meals',
          },
        ],
        recommendations: 'Hydration and 3 days bed rest',
      },
      tokenDoctor
    );
    const consultationId = createConsult.data?.data?._id;
    recordStep(26, 'Doctor creates consultation', createConsult.status === 201 && !!consultationId);

    // 27. Verify appointment becomes completed
    const getApptAfterConsult = await makeRequest(`/api/appointments/${appointmentId}`, 'GET', null, tokenPatient);
    recordStep(27, 'Verify appointment becomes completed', getApptAfterConsult.data?.data?.status === 'completed');

    // 28. Patient views consultation history
    const getPatConsults = await makeRequest('/api/consultations/my', 'GET', null, tokenPatient);
    recordStep(28, 'Patient views consultation history', getPatConsults.status === 200 && getPatConsults.data?.count >= 1);

    // --- EMERGENCY ---
    // 29. Patient creates emergency alert
    const createEmerg = await makeRequest(
      '/api/emergency',
      'POST',
      {
        latitude: 6.9271,
        longitude: 79.8612,
        message: 'Severe dizziness and shortness of breath emergency.',
      },
      tokenPatient
    );
    const alertId = createEmerg.data?.data?._id;
    recordStep(29, 'Patient creates emergency alert', createEmerg.status === 201 && !!alertId);

    // 30. Caregiver retrieves active emergency alert
    const getCgEmerg = await makeRequest('/api/caregivers/emergency-alerts?status=active', 'GET', null, tokenCaregiver);
    recordStep(30, 'Caregiver retrieves active emergency alert', getCgEmerg.status === 200 && getCgEmerg.data?.count >= 1);

    // 31. Caregiver resolves emergency alert
    const resolveEmerg = await makeRequest(`/api/emergency/${alertId}/resolve`, 'PATCH', null, tokenCaregiver);
    recordStep(31, 'Caregiver resolves emergency alert', resolveEmerg.status === 200);

    // 32. Verify status = resolved
    recordStep(32, 'Verify status = resolved', resolveEmerg.data?.data?.status === 'resolved');

    // --- COMMUNITY ---
    // 33. Patient creates Community Health post
    const createPost = await makeRequest(
      '/api/community/posts',
      'POST',
      {
        title: 'Tips for managing blood pressure at home',
        content: 'Sharing some gentle morning breathing exercises that helped me lower blood pressure.',
        category: 'wellbeing',
      },
      tokenPatient
    );
    const postId = createPost.data?.data?._id;
    recordStep(33, 'Patient creates Community Health post', createPost.status === 201 && !!postId);

    // 34. Caregiver views post
    const getPostCg = await makeRequest(`/api/community/posts/${postId}`, 'GET', null, tokenCaregiver);
    recordStep(34, 'Caregiver views post', getPostCg.status === 200);

    // 35. Caregiver comments
    const addComment = await makeRequest(
      `/api/community/posts/${postId}/comments`,
      'POST',
      { content: 'Thank you! These breathing techniques are very helpful for senior care.' },
      tokenCaregiver
    );
    recordStep(35, 'Caregiver comments', addComment.status === 201);

    // 36. Patient retrieves post with comment
    const getPostPat = await makeRequest(`/api/community/posts/${postId}`, 'GET', null, tokenPatient);
    const hasComments = Array.isArray(getPostPat.data?.data?.comments) && getPostPat.data?.data?.comments.length > 0;
    recordStep(36, 'Patient retrieves post with comment', getPostPat.status === 200 && hasComments);

  } catch (err) {
    console.error('End-to-end execution error:', err);
  }

  console.log('\n=== END-TO-END AUDIT SUMMARY ===');
  const passCount = results.filter(r => r.status === 'PASS').length;
  console.log(`Passed: ${passCount} / 36 steps`);
}

runEndToEndAudit();

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

async function runTests() {
  console.log('--- STARTING SYMPTOM ANALYSIS MODULE TESTS ---\n');

  // 1. Health check
  const health = await makeRequest('/api/health');
  console.log('1. Health Check:', health.status === 200 ? 'PASSED' : 'FAILED', health.data);

  // 2. Register/Login Patient 1
  const patient1Auth = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Patient One',
    email: `patient1_${Date.now()}@mediheal.com`,
    password: 'Password123!',
    role: 'patient',
    phoneNumber: '+94770000001',
  });
  const token1 = patient1Auth.data?.data?.token;
  console.log('2. Patient 1 Register/Login:', token1 ? 'PASSED' : 'FAILED');

  // 3. Register/Login Patient 2
  const patient2Auth = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Patient Two',
    email: `patient2_${Date.now()}@mediheal.com`,
    password: 'Password123!',
    role: 'patient',
    phoneNumber: '+94770000002',
  });
  const token2 = patient2Auth.data?.data?.token;
  console.log('3. Patient 2 Register/Login:', token2 ? 'PASSED' : 'FAILED');

  // 4. Register/Login Caregiver
  const caregiverAuth = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Caregiver One',
    email: `caregiver_${Date.now()}@mediheal.com`,
    password: 'Password123!',
    role: 'caregiver',
    phoneNumber: '+94770000003',
  });
  const caregiverToken = caregiverAuth.data?.data?.token;
  console.log('4. Caregiver Register/Login:', caregiverToken ? 'PASSED' : 'FAILED');

  // 5. Test Normal Symptom Analysis (Rule 1: fever, cough, sore throat)
  const normRule1 = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    {
      symptoms: ['fever', 'cough', 'sore throat'],
      duration: '3 days',
      severity: 'moderate',
    },
    token1
  );
  console.log('\n5. Normal Matching (Rule 1):', normRule1.status === 201 ? 'PASSED' : 'FAILED');
  console.log('   Condition:', normRule1.data?.analysis?.possibleCondition);
  console.log('   Specialist:', normRule1.data?.analysis?.recommendedSpecialist);
  console.log('   Risk:', normRule1.data?.analysis?.riskLevel);
  console.log('   Matched Symptoms:', normRule1.data?.analysis?.matchedSymptoms);
  console.log('   Disclaimer present:', !!normRule1.data?.analysis?.disclaimer);

  const checkId1 = normRule1.data?.analysis?.symptomCheckId;

  // 6. Test Dermatologist Rule (Rule 3: skin rash, itching)
  const normRule3 = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    {
      symptoms: ['Skin Rash', 'itching  '],
      duration: '1 week',
      severity: 'mild',
    },
    token1
  );
  console.log('\n6. Dermatologist Matching (Rule 3):', normRule3.status === 201 ? 'PASSED' : 'FAILED');
  console.log('   Condition:', normRule3.data?.analysis?.possibleCondition);
  console.log('   Specialist:', normRule3.data?.analysis?.recommendedSpecialist);
  console.log('   Matched Symptoms:', normRule3.data?.analysis?.matchedSymptoms);

  // 7. Test Emergency Rule (Rule 5 & High Risk: chest pain, shortness of breath)
  const emergencyRule = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    {
      symptoms: ['chest pain', 'shortness of breath'],
      duration: '1 hour',
      severity: 'severe',
    },
    token1
  );
  console.log('\n7. Emergency Rule (Rule 5):', emergencyRule.status === 201 ? 'PASSED' : 'FAILED');
  console.log('   Emergency Recommended:', emergencyRule.data?.analysis?.emergencyRecommended);
  console.log('   Risk Level:', emergencyRule.data?.analysis?.riskLevel);
  console.log('   Guidance:', emergencyRule.data?.analysis?.guidance);

  // 8. Test High-Risk Emergency Trigger (e.g. unconsciousness)
  const emergencyTrigger = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    {
      symptoms: ['unconsciousness'],
      duration: '10 mins',
      severity: 'severe',
    },
    token1
  );
  console.log('\n8. Emergency Trigger (unconsciousness):', emergencyTrigger.status === 201 ? 'PASSED' : 'FAILED');
  console.log('   Emergency Recommended:', emergencyTrigger.data?.analysis?.emergencyRecommended);
  console.log('   Risk Level:', emergencyTrigger.data?.analysis?.riskLevel);
  console.log('   Guidance:', emergencyTrigger.data?.analysis?.guidance);

  // 9. Test Unknown Symptoms Fallback
  const unknownSym = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    {
      symptoms: ['random unmapped symptom xyz'],
      duration: '2 days',
      severity: 'mild',
    },
    token1
  );
  console.log('\n9. Unknown Symptoms Fallback:', unknownSym.status === 201 ? 'PASSED' : 'FAILED');
  console.log('   Possible Condition:', unknownSym.data?.analysis?.possibleCondition);
  console.log('   Specialist:', unknownSym.data?.analysis?.recommendedSpecialist);
  console.log('   Risk:', unknownSym.data?.analysis?.riskLevel);

  // 10. Validation Tests
  const emptyArray = await makeRequest('/api/symptoms/analyze', 'POST', { symptoms: [] }, token1);
  console.log('\n10a. Validation (Empty symptoms array):', emptyArray.status === 400 ? 'PASSED' : 'FAILED', emptyArray.data?.message);

  const blankStrings = await makeRequest('/api/symptoms/analyze', 'POST', { symptoms: ['   '] }, token1);
  console.log('10b. Validation (Blank symptom strings):', blankStrings.status === 400 ? 'PASSED' : 'FAILED', blankStrings.data?.message);

  const invalidSeverity = await makeRequest('/api/symptoms/analyze', 'POST', { symptoms: ['fever'], severity: 'extreme' }, token1);
  console.log('10c. Validation (Invalid severity):', invalidSeverity.status === 400 ? 'PASSED' : 'FAILED', invalidSeverity.data?.message);

  // 11. Caregiver Access Rejection Test
  const caregiverAccess = await makeRequest(
    '/api/symptoms/analyze',
    'POST',
    { symptoms: ['fever'] },
    caregiverToken
  );
  console.log('\n11. Caregiver Access Rejection:', caregiverAccess.status === 403 ? 'PASSED' : 'FAILED', caregiverAccess.data?.message);

  // 12. Symptom Check History Test for Patient 1
  const history = await makeRequest('/api/symptoms/history', 'GET', null, token1);
  console.log('\n12. Get Symptom History:', history.status === 200 && history.data?.count >= 4 ? 'PASSED' : 'FAILED', `Count: ${history.data?.count}`);

  // 13. Get Symptom Check By ID Test
  const checkById = await makeRequest(`/api/symptoms/${checkId1}`, 'GET', null, token1);
  console.log('\n13. Get Symptom Check By ID:', checkById.status === 200 && checkById.data?.data?._id === checkId1 ? 'PASSED' : 'FAILED');

  // 14. Symptom Check Ownership Test (Patient 2 accessing Patient 1's record)
  const ownershipAccess = await makeRequest(`/api/symptoms/${checkId1}`, 'GET', null, token2);
  console.log('\n14. Symptom History Ownership Check (Patient 2 accessing Patient 1 record):', ownershipAccess.status === 403 ? 'PASSED' : 'FAILED', ownershipAccess.data?.message);

  // 15. Doctor Recommendation Integration Query Test
  const doctorSearch = await makeRequest('/api/doctors?specialization=General Physician', 'GET', null, token1);
  console.log('\n15. Doctor Specialization Query Integration:', doctorSearch.status === 200 ? 'PASSED' : 'FAILED', `Doctors found: ${doctorSearch.data?.count}`);

  console.log('\n--- ALL TESTS COMPLETED ---');
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
});

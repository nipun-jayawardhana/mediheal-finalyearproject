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

async function runCommunityTests() {
  console.log('--- STARTING COMMUNITY HEALTH MODULE TESTS ---\n');

  const timestamp = Date.now();

  // Setup Patient User
  const patientRes = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Patient Community User',
    email: `p_comm_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'patient',
    phoneNumber: '+94778888881',
  });
  const tokenP = patientRes.data?.data?.token;

  // Setup Caregiver User
  const caregiverRes = await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Caregiver Community User',
    email: `c_comm_${timestamp}@mediheal.com`,
    password: 'Password123!',
    role: 'caregiver',
    phoneNumber: '+94778888882',
  });
  const tokenC = caregiverRes.data?.data?.token;

  // Setup Doctor User (using Admin credentials to create doctor)
  const adminLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@mediheal.com',
    password: 'AdminPass123!',
  });
  const tokenAdmin = adminLoginRes.data?.data?.token;

  await makeRequest(
    '/api/admin/doctors',
    'POST',
    {
      fullName: 'Dr. Community Tester',
      email: `doc_comm_${timestamp}@mediheal.com`,
      phoneNumber: '+94778888883',
      slmcNumber: `SLMC_COMM_${timestamp}`,
      specialization: 'General Physician',
      hospital: 'Colombo National Hospital',
      password: 'DoctorPass123!',
    },
    tokenAdmin
  );

  const docLoginRes = await makeRequest('/api/auth/login', 'POST', {
    email: `doc_comm_${timestamp}@mediheal.com`,
    password: 'DoctorPass123!',
  });
  const tokenDoc = docLoginRes.data?.data?.token;

  console.log('User setup completed.\n');

  // TEST 1 — Patient creates post
  const test1 = await makeRequest(
    '/api/community/posts',
    'POST',
    {
      title: 'Healthy walking habits',
      content: 'What are some safe walking habits for elderly people?',
      category: 'exercise',
    },
    tokenP
  );
  console.log('Test 1 — Patient creates post:', test1.status === 201 ? 'PASSED' : 'FAILED');
  const post1 = test1.data?.data;

  // TEST 2 — Caregiver creates post
  const test2 = await makeRequest(
    '/api/community/posts',
    'POST',
    {
      title: 'Balanced nutrition for seniors',
      content: 'Here are some helpful dietary tips for older adults.',
      category: 'nutrition',
    },
    tokenC
  );
  console.log('Test 2 — Caregiver creates post:', test2.status === 201 ? 'PASSED' : 'FAILED');
  const post2 = test2.data?.data;

  // TEST 3 — Doctor attempts to create post
  const test3 = await makeRequest(
    '/api/community/posts',
    'POST',
    {
      title: 'Medical advice post',
      content: 'Doctor posting content.',
      category: 'general',
    },
    tokenDoc
  );
  console.log('Test 3 — Doctor attempts to create post:', test3.status === 403 ? 'PASSED' : 'FAILED', test3.data?.message);

  // TEST 4 — View feed
  const test4 = await makeRequest('/api/community/posts', 'GET', null, tokenP);
  console.log('Test 4 — View feed:', test4.status === 200 && test4.data?.count >= 2 ? 'PASSED' : 'FAILED');

  // TEST 5 — Category filtering
  const test5 = await makeRequest('/api/community/posts?category=exercise', 'GET', null, tokenP);
  const onlyExercise = test5.data?.data?.every((p) => p.category === 'exercise');
  console.log('Test 5 — Category filtering (exercise):', test5.status === 200 && onlyExercise ? 'PASSED' : 'FAILED', `Count: ${test5.data?.count}`);

  // TEST 6 — Pagination
  const test6 = await makeRequest('/api/community/posts?page=1&limit=10', 'GET', null, tokenP);
  console.log('Test 6 — Pagination metadata:', test6.status === 200 && test6.data?.pagination?.page === 1 ? 'PASSED' : 'FAILED');

  // TEST 7 — View single post
  const test7 = await makeRequest(`/api/community/posts/${post1._id}`, 'GET', null, tokenP);
  console.log('Test 7 — View single post:', test7.status === 200 && test7.data?.data?.post?._id === post1._id ? 'PASSED' : 'FAILED');

  // TEST 8 — Add comment
  const test8 = await makeRequest(
    `/api/community/posts/${post1._id}/comments`,
    'POST',
    { content: 'Thank you for sharing this.' },
    tokenC
  );
  console.log('Test 8 — Add comment:', test8.status === 201 ? 'PASSED' : 'FAILED');
  const comment1 = test8.data?.data;

  // TEST 9 — Another user tries to edit post
  const test9 = await makeRequest(
    `/api/community/posts/${post1._id}`,
    'PUT',
    { title: 'Hacked Title' },
    tokenC
  );
  console.log('Test 9 — Non-owner tries to edit post:', test9.status === 403 ? 'PASSED' : 'FAILED', test9.data?.message);

  // TEST 10 — Owner updates post
  const test10 = await makeRequest(
    `/api/community/posts/${post1._id}`,
    'PUT',
    { title: 'Safe daily walking habits', category: 'exercise' },
    tokenP
  );
  console.log('Test 10 — Owner updates post:', test10.status === 200 && test10.data?.data?.title === 'Safe daily walking habits' ? 'PASSED' : 'FAILED');

  // TEST 11 — Another user attempts to remove comment
  const test11 = await makeRequest(`/api/community/comments/${comment1._id}`, 'DELETE', null, tokenP);
  console.log('Test 11 — Non-owner attempts to remove comment:', test11.status === 403 ? 'PASSED' : 'FAILED', test11.data?.message);

  // TEST 12 — Comment owner removes comment
  const test12 = await makeRequest(`/api/community/comments/${comment1._id}`, 'DELETE', null, tokenC);
  console.log('Test 12 — Comment owner removes comment:', test12.status === 200 ? 'PASSED' : 'FAILED');

  // TEST 13 — Post owner removes post (soft delete)
  const test13 = await makeRequest(`/api/community/posts/${post2._id}`, 'DELETE', null, tokenC);
  console.log('Test 13 — Post owner removes post (soft delete):', test13.status === 200 ? 'PASSED' : 'FAILED');

  // TEST 14 — Removed post not in feed
  const test14 = await makeRequest('/api/community/posts', 'GET', null, tokenP);
  const notInFeed = !test14.data?.data?.some((p) => p._id === post2._id);
  console.log('Test 14 — Removed post not in feed:', notInFeed ? 'PASSED' : 'FAILED');

  // TEST 15 — Comment on inactive post
  const test15 = await makeRequest(
    `/api/community/posts/${post2._id}/comments`,
    'POST',
    { content: 'Commenting on inactive post' },
    tokenP
  );
  console.log('Test 15 — Comment on inactive post rejected:', test15.status === 400 ? 'PASSED' : 'FAILED', test15.data?.message);

  // TEST 16 — Invalid MongoDB ID validation
  const test16 = await makeRequest('/api/community/posts/invalid_id_123', 'GET', null, tokenP);
  console.log('Test 16 — Invalid MongoDB ID:', test16.status === 400 ? 'PASSED' : 'FAILED', test16.data?.message);

  console.log('\n--- ALL COMMUNITY HEALTH TESTS COMPLETED ---');
}

runCommunityTests().catch((err) => {
  console.error('Test execution error:', err);
});

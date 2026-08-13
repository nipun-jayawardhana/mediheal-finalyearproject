const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(path, method, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const payload = body ? JSON.stringify(body) : null;
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
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (e) => reject(e));

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

async function runCommunityTests() {
  console.log('=== STARTING COMMUNITY HEALTH MODULE AUDIT ===\n');
  const timestamp = Date.now();

  // 1. Register & Login Patient A
  const patAEmail = `pat_commA_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Saman Perera',
    email: patAEmail,
    phoneNumber: '+94771199331',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patALogin = await makeRequest('/api/auth/login', 'POST', {
    email: patAEmail,
    password: 'PatientPass123!',
  });
  const tokenPatA = patALogin.data?.data?.token;

  // 2. Register & Login Patient B
  const patBEmail = `pat_commB_${timestamp}@mediheal.com`;
  await makeRequest('/api/auth/register', 'POST', {
    fullName: 'Leela Karunaratne',
    email: patBEmail,
    phoneNumber: '+94771199332',
    password: 'PatientPass123!',
    role: 'patient',
  });
  const patBLogin = await makeRequest('/api/auth/login', 'POST', {
    email: patBEmail,
    password: 'PatientPass123!',
  });
  const tokenPatB = patBLogin.data?.data?.token;

  // TEST 1: Create Post (Patient A)
  console.log('--- TEST 1: Create Community Post (POST /api/community/posts) ---');
  const createPostRes = await makeRequest('/api/community/posts', 'POST', {
    title: 'Tips for staying active at home?',
    content: 'I have been finding it harder to go for daily walks in the park lately. What light indoor exercises do you recommend?',
    category: 'general',
  }, tokenPatA);

  console.log(`Status: ${createPostRes.status}, Message: ${createPostRes.data?.message}`);
  const postId = createPostRes.data?.data?._id;
  console.log(`Post ID: ${postId}`);
  console.log(`Disclaimer present: ${!!createPostRes.data?.disclaimer}`);
  console.log(`PASS: ${createPostRes.status === 201 && !!postId}\n`);

  // TEST 2: Community Feed & Category Filtering (GET /api/community/posts)
  console.log('--- TEST 2: Community Feed & Category Filtering (GET /api/community/posts) ---');
  const feedRes = await makeRequest('/api/community/posts?category=general', 'GET', null, tokenPatB);
  console.log(`Status: ${feedRes.status}, Count: ${feedRes.data?.count}`);
  console.log(`First Post Title: ${feedRes.data?.data?.[0]?.title}`);
  console.log(`Pagination total: ${feedRes.data?.pagination?.total}`);
  console.log(`PASS: ${feedRes.status === 200 && feedRes.data?.count >= 1}\n`);

  // TEST 3: Add Comment (Patient B comments on Patient A's post)
  console.log('--- TEST 3: Add Comment (POST /api/community/posts/:id/comments) ---');
  const commentRes = await makeRequest(`/api/community/posts/${postId}/comments`, 'POST', {
    content: 'Light stretching and stationary marching in place works wonderfully for me!',
  }, tokenPatB);

  console.log(`Status: ${commentRes.status}, Message: ${commentRes.data?.message}`);
  const commentId = commentRes.data?.data?._id;
  console.log(`Comment ID: ${commentId}`);
  console.log(`PASS: ${commentRes.status === 201 && !!commentId}\n`);

  // TEST 4: View Single Post with Comments (GET /api/community/posts/:id)
  console.log('--- TEST 4: View Single Post (GET /api/community/posts/:id) ---');
  const singlePostRes = await makeRequest(`/api/community/posts/${postId}`, 'GET', null, tokenPatA);
  console.log(`Status: ${singlePostRes.status}`);
  console.log(`Comments Count: ${singlePostRes.data?.data?.comments?.length}`);
  console.log(`Commenter Name: ${singlePostRes.data?.data?.comments?.[0]?.authorId?.fullName}`);
  console.log(`PASS: ${singlePostRes.status === 200 && singlePostRes.data?.data?.comments?.length === 1}\n`);

  // TEST 5: Edit Own Post (Patient A updates post)
  console.log('--- TEST 5: Edit Own Post (PUT /api/community/posts/:id) ---');
  const editPostRes = await makeRequest(`/api/community/posts/${postId}`, 'PUT', {
    title: 'Tips for staying active at home (Updated)',
    content: 'I have been finding it harder to go for daily walks. Sharing updated tips!',
    category: 'exercise',
  }, tokenPatA);

  console.log(`Status: ${editPostRes.status}, New Category: ${editPostRes.data?.data?.category}`);
  console.log(`PASS: ${editPostRes.status === 200 && editPostRes.data?.data?.category === 'exercise'}\n`);

  // TEST 6: Ownership Protection (Patient B attempts to edit Patient A's post)
  console.log('--- TEST 6: Ownership Protection (Unauthorized edit attempt) ---');
  const unauthEditRes = await makeRequest(`/api/community/posts/${postId}`, 'PUT', {
    title: 'Hacked Title',
  }, tokenPatB);

  console.log(`Status: ${unauthEditRes.status}, Message: ${unauthEditRes.data?.message}`);
  console.log(`PASS: ${unauthEditRes.status === 403}\n`);

  // TEST 7: Remove Own Comment (Patient B removes own comment)
  console.log('--- TEST 7: Remove Own Comment (DELETE /api/community/comments/:id) ---');
  const removeCommentRes = await makeRequest(`/api/community/comments/${commentId}`, 'DELETE', null, tokenPatB);
  console.log(`Status: ${removeCommentRes.status}, Message: ${removeCommentRes.data?.message}`);
  console.log(`PASS: ${removeCommentRes.status === 200}\n`);

  // TEST 8: Remove Own Post (Patient A removes own post)
  console.log('--- TEST 8: Remove Own Post (DELETE /api/community/posts/:id) ---');
  const removePostRes = await makeRequest(`/api/community/posts/${postId}`, 'DELETE', null, tokenPatA);
  console.log(`Status: ${removePostRes.status}, Message: ${removePostRes.data?.message}`);
  console.log(`PASS: ${removePostRes.status === 200}\n`);

  // TEST 9: Role Protection (Unauthenticated access)
  console.log('--- TEST 9: Role Protection (Unauthenticated) ---');
  const unauthRes = await makeRequest('/api/community/posts', 'GET', null, null);
  console.log(`Status: ${unauthRes.status}`);
  console.log(`PASS: ${unauthRes.status === 401}\n`);

  console.log('=== COMMUNITY HEALTH MODULE AUDIT COMPLETE ===');
}

runCommunityTests().catch(console.error);

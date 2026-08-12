const express = require('express');
const {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  removePost,
  addComment,
  removeComment,
} = require('../controllers/communityController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Enforce authentication & role restrictions (Patient & Caregiver only)
router.use(protect);
router.use(authorize('patient', 'caregiver'));

// Community Post Endpoints
router.post('/posts', createPost);
router.get('/posts', getPosts);
router.get('/posts/:postId', getPostById);
router.put('/posts/:postId', updatePost);
router.delete('/posts/:postId', removePost);

// Community Comment Endpoints
router.post('/posts/:postId/comments', addComment);
router.delete('/comments/:commentId', removeComment);

module.exports = router;

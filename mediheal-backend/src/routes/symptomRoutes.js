const express = require('express');
const {
  analyzeSymptoms,
  getSymptomHistory,
  getSymptomCheckById,
  handleFollowUp,
} = require('../controllers/symptomController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Require authentication and patient role for all symptom routes
router.use(protect);
router.use(authorize('patient'));

router.post('/follow-up', handleFollowUp);
router.post('/analyze', analyzeSymptoms);
router.get('/history', getSymptomHistory);
router.get('/:symptomCheckId', getSymptomCheckById);

module.exports = router;

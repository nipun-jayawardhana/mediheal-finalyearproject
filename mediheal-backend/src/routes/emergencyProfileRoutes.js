const express = require('express');
const {
  getMyEmergencyProfile,
  updateMyEmergencyProfile,
} = require('../controllers/emergencyProfileController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Emergency Health Profile (Authenticated patient only)
router
  .route('/my')
  .get(protect, authorize('patient'), getMyEmergencyProfile)
  .put(protect, authorize('patient'), updateMyEmergencyProfile);

module.exports = router;

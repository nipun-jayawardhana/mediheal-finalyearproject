const express = require('express');
const {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Apply global authentication middleware
router.use(protect);

// --- Patient Notification Endpoints ---
router.get('/my', authorize('patient'), getMyNotifications);
router.get('/unread-count', authorize('patient'), getUnreadNotificationCount);
router.patch('/read-all', authorize('patient'), markAllNotificationsAsRead);
router.patch('/:id/read', authorize('patient'), markNotificationAsRead);

module.exports = router;

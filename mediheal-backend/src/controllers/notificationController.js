const Notification = require('../models/Notification');
const { generateMedicationReminders } = require('../services/medicationNotificationService');

/**
 * Get all notifications for the authenticated patient
 * GET /api/notifications/my
 */
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Proactively generate any due reminders for today
    await generateMedicationReminders(userId);

    const notifications = await Notification.find({ userId }).sort({ createdAt: -1 });
    const unreadCount = await Notification.countDocuments({ userId, status: 'UNREAD' });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get unread notification count for badge display
 * GET /api/notifications/unread-count
 */
const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Proactively generate any due reminders for today
    await generateMedicationReminders(userId);

    const unreadCount = await Notification.countDocuments({ userId, status: 'UNREAD' });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark a single notification as read
 * PATCH /api/notifications/:id/read
 */
const markNotificationAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const notification = await Notification.findOne({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or unauthorized',
      });
    }

    if (notification.status !== 'READ') {
      notification.status = 'READ';
      notification.readAt = new Date();
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Mark all notifications as read for the authenticated patient
 * PATCH /api/notifications/read-all
 */
const markAllNotificationsAsRead = async (req, res, next) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { userId, status: 'UNREAD' },
      {
        $set: {
          status: 'READ',
          readAt: new Date(),
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
};

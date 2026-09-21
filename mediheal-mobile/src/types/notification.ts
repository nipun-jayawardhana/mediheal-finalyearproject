export type NotificationType =
  | 'MEDICATION_REMINDER'
  | 'MISSED_MEDICATION'
  | 'MEDICATION_TAKEN';

export type NotificationStatus = 'UNREAD' | 'READ';

export interface NotificationItem {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedMedicationId?: string;
  scheduleId?: string;
  recordId?: string;
  medicineName?: string;
  dosage?: string;
  scheduledTime?: string;
  scheduledDate?: string;
  status: NotificationStatus;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  success: boolean;
  count: number;
  unreadCount: number;
  data: NotificationItem[];
}

export interface UnreadCountResponse {
  success: boolean;
  unreadCount: number;
}

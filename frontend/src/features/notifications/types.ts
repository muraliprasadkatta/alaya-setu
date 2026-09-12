export type NotificationType =
  | "temple_request_approved"
  | "temple_request_rejected"
  | "verified_edit_access_approved"
  | "verified_edit_access_rejected"
  | "verified_edit_changes_approved"
  | "verified_edit_changes_rejected";

export type NotificationReferenceType =
  | "temple_request"
  | "verified_edit_request"
  | "";

export type NotificationActionData = {
  action?: string;
  temple_id?: number;
  request_id?: number;
  status?: string;
  [key: string]: unknown;
};

export type AppNotification = {
  id: number;
  notification_type: NotificationType;
  notification_type_display: string;
  title: string;
  message: string;
  temple_id: number | null;
  temple_name: string | null;
  reference_type: NotificationReferenceType;
  reference_id: number | null;
  action_data: NotificationActionData;
  web_action_url: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
};

export type NotificationListResponse = {
  success: boolean;
  count: number;
  unread_count: number;
  next: string | null;
  previous: string | null;
  notifications: AppNotification[];
  message?: string;
};

export type NotificationUnreadCountResponse = {
  success: boolean;
  unread_count: number;
  message?: string;
};

export type NotificationMarkReadResponse = {
  success: boolean;
  notification: AppNotification;
  message?: string;
};

export type NotificationMarkAllReadResponse = {
  success: boolean;
  updated_count: number;
  unread_count: number;
  message?: string;
};
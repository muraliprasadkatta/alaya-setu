import {
  CheckCircle2,
  ChevronRight,
  CircleX,
  FilePenLine,
} from "lucide-react";

import type {
  AppNotification,
  NotificationType,
} from "./types";


type NotificationItemProps = {
  notification: AppNotification;
  onOpen: (notification: AppNotification) => void;
};


function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  const difference = Date.now() - date.getTime();

  if (difference < 60_000) {
    return "Just now";
  }

  const minutes = Math.floor(
    difference / 60_000,
  );

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);

  if (hours < 24) {
    return `${hours}h ago`;
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


function getNotificationIcon(
  notificationType: NotificationType,
) {
  if (
    notificationType ===
      "temple_request_rejected" ||
    notificationType ===
      "verified_edit_access_rejected" ||
    notificationType ===
      "verified_edit_changes_rejected"
  ) {
    return {
      Icon: CircleX,
      iconClass: "bg-red-100 text-red-700",
    };
  }

  if (
    notificationType ===
      "verified_edit_access_approved" ||
    notificationType ===
      "verified_edit_changes_approved"
  ) {
    return {
      Icon: FilePenLine,
      iconClass: "bg-blue-100 text-blue-700",
    };
  }

  return {
    Icon: CheckCircle2,
    iconClass: "bg-green-100 text-green-700",
  };
}


function NotificationItem({
  notification,
  onOpen,
}: NotificationItemProps) {
  const {
    Icon,
    iconClass,
  } = getNotificationIcon(
    notification.notification_type,
  );

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`group flex w-full items-start gap-3 border-b border-gray-100 px-4 py-4 text-left transition last:border-b-0 ${
        notification.is_read
          ? "bg-white hover:bg-gray-50"
          : "bg-orange-50/70 hover:bg-orange-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        <Icon className="h-5 w-5" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-gray-950">
              {notification.title}
            </span>

            <span className="mt-1 block text-sm leading-5 text-gray-600">
              {notification.message}
            </span>
          </span>

          {!notification.is_read && (
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-600"
              aria-label="Unread notification"
            />
          )}
        </span>

        <span className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-gray-500">
            {formatNotificationTime(
              notification.created_at,
            )}
          </span>

          {notification.web_action_url && (
            <ChevronRight className="h-4 w-4 text-gray-400 transition group-hover:translate-x-0.5 group-hover:text-orange-700" />
          )}
        </span>
      </span>
    </button>
  );
}


export default NotificationItem;
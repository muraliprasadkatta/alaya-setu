import { apiFetch } from "../../services/apiFetch";

import type {
  NotificationListResponse,
  NotificationMarkAllReadResponse,
  NotificationMarkReadResponse,
  NotificationUnreadCountResponse,
} from "./types";


const NOTIFICATIONS_API_URL =
  "http://127.0.0.1:8000/api/notifications/";


type NotificationStatusFilter =
  | "all"
  | "unread"
  | "read";

type ApiResponse = {
  success: boolean;
  message?: string;
};


async function requestJson<T extends ApiResponse>(
  url: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await apiFetch(url, init);

  const data = (await response
    .json()
    .catch(() => null)) as T | null;

  if (
    !response.ok ||
    !data ||
    !data.success
  ) {
    throw new Error(
      data?.message || fallbackMessage,
    );
  }

  return data;
}


export function getNotifications(
  status: NotificationStatusFilter = "all",
  page = 1,
  signal?: AbortSignal,
) {
  const query = new URLSearchParams({
    status,
    page: String(page),
  });

  return requestJson<NotificationListResponse>(
    `${NOTIFICATIONS_API_URL}?${query.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
    "Notifications load avvaledhu.",
  );
}


export function getNotificationUnreadCount(
  signal?: AbortSignal,
) {
  return requestJson<NotificationUnreadCountResponse>(
    `${NOTIFICATIONS_API_URL}unread-count/`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal,
    },
    "Unread notification count load avvaledhu.",
  );
}


export function markNotificationAsRead(
  notificationId: number,
) {
  return requestJson<NotificationMarkReadResponse>(
    `${NOTIFICATIONS_API_URL}${notificationId}/read/`,
    {
      method: "PATCH",
      headers: {
        Accept: "application/json",
      },
    },
    "Notification read status update avvaledhu.",
  );
}


export function markAllNotificationsAsRead() {
  return requestJson<NotificationMarkAllReadResponse>(
    `${NOTIFICATIONS_API_URL}read-all/`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "Notifications read status update avvaledhu.",
  );
}
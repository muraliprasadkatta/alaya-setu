import { useEffect } from "react";
import {
  AlertCircle,
  BellOff,
  CheckCheck,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";

import NotificationItem from "./NotificationItem";

import type {
  AppNotification,
} from "./types";


type NotificationPanelProps = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isMarkingAllRead: boolean;
  errorMessage: string;
  onClose: () => void;
  onRetry: () => void;
  onMarkAllRead: () => void;
  onOpenNotification: (
    notification: AppNotification,
  ) => void;
};


function NotificationPanel({
  notifications,
  unreadCount,
  isLoading,
  isMarkingAllRead,
  errorMessage,
  onClose,
  onRetry,
  onMarkAllRead,
  onOpenNotification,
}: NotificationPanelProps) {
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notifications"
        className="absolute inset-0 h-full w-full cursor-default bg-black/20 backdrop-blur-[1px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-panel-title"
        className="absolute inset-x-3 top-16 flex max-h-[calc(100vh-5rem)] flex-col overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[400px] md:right-8"
      >
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
          <div className="min-w-0">
            <h2
              id="notification-panel-title"
              className="text-base font-bold text-gray-950"
            >
              Notifications
            </h2>

            <p className="mt-0.5 text-xs text-gray-500">
            {unreadCount === 0
                ? "You are all caught up"
                : `${unreadCount} unread ${
                    unreadCount === 1
                    ? "notification"
                    : "notifications"
                }`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onMarkAllRead}
              disabled={
                unreadCount === 0 ||
                isLoading ||
                isMarkingAllRead
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-orange-800 transition hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMarkingAllRead ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}

              <span className="hidden sm:inline">
                Mark all read
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close notifications"
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex min-h-52 flex-col items-center justify-center gap-3 px-5 py-10 text-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-orange-700" />

              <p className="text-sm font-medium text-gray-600">
                Loading notifications...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertCircle className="h-6 w-6" />
              </span>

              <p className="mt-3 text-sm font-semibold text-gray-900">
                Notifications unavailable
              </p>

              <p className="mt-1 max-w-xs text-sm leading-5 text-gray-600">
                {errorMessage}
              </p>

              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-800 transition hover:bg-orange-50"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex min-h-52 flex-col items-center justify-center px-5 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                <BellOff className="h-6 w-6" />
              </span>

              <p className="mt-3 text-sm font-semibold text-gray-900">
                No notifications yet
              </p>

              <p className="mt-1 max-w-xs text-sm leading-5 text-gray-500">
                Request approvals and rejections will
                appear here.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map(
                (notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onOpen={onOpenNotification}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}


export default NotificationPanel;
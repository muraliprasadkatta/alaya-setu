import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { Bell } from "lucide-react";
import {
  useLocation,
  useNavigate,
} from "react-router";

import NotificationPanel from "./NotificationPanel";

import {
  getNotifications,
  getNotificationUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notificationApi";

import type {
  AppNotification,
} from "./types";


function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}


function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);

  const [notifications, setNotifications] =
    useState<AppNotification[]>([]);

  const [unreadCount, setUnreadCount] =
    useState(0);

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    isMarkingAllRead,
    setIsMarkingAllRead,
  ] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");


  const loadUnreadCount = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await getNotificationUnreadCount(
            signal,
          );

        setUnreadCount(data.unread_count);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        // Header count failure should not block
        // the rest of the dashboard.
      }
    },
    [],
  );


  const loadNotifications = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await getNotifications(
          "all",
          1,
          signal,
        );

        setNotifications(data.notifications);
        setUnreadCount(data.unread_count);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Notifications load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [],
  );


  useEffect(() => {
    const controller =
      new AbortController();

    void loadUnreadCount(
      controller.signal,
    );

    const intervalId = window.setInterval(
      () => {
        void loadUnreadCount(
          controller.signal,
        );
      },
      60_000,
    );

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [loadUnreadCount]);


  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const controller =
      new AbortController();

    void loadNotifications(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, [
    isOpen,
    loadNotifications,
  ]);


  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);


  const handleMarkAllRead = async () => {
    if (
      unreadCount === 0 ||
      isMarkingAllRead
    ) {
      return;
    }

    setIsMarkingAllRead(true);

    try {
      await markAllNotificationsAsRead();

      const currentTime =
        new Date().toISOString();

      setNotifications(
        (currentNotifications) =>
          currentNotifications.map(
            (notification) => ({
              ...notification,
              is_read: true,
              read_at:
                notification.read_at ||
                currentTime,
            }),
          ),
      );

      setUnreadCount(0);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Notifications update avvaledhu.",
      );
    } finally {
      setIsMarkingAllRead(false);
    }
  };


  const handleOpenNotification = async (
    notification: AppNotification,
  ) => {
    if (!notification.is_read) {
      try {
        const data =
          await markNotificationAsRead(
            notification.id,
          );

        setNotifications(
          (currentNotifications) =>
            currentNotifications.map(
              (currentNotification) =>
                currentNotification.id ===
                notification.id
                  ? data.notification
                  : currentNotification,
            ),
        );

        setUnreadCount(
          (currentCount) =>
            Math.max(0, currentCount - 1),
        );
      } catch {
        // Navigation should still work even if
        // read-status update temporarily fails.
      }
    }

    if (
      notification.web_action_url &&
      notification.web_action_url.startsWith(
        "/",
      )
    ) {
      setIsOpen(false);

      navigate(
        notification.web_action_url,
      );
    }
  };


  const badgeText =
    unreadCount > 99
      ? "99+"
      : String(unreadCount);


  return (
    <>
      <button
        type="button"
        onClick={() =>
          setIsOpen(
            (currentValue) => !currentValue,
          )
        }
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={isOpen}
        title="Notifications"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-orange-900 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
      >
        <Bell className="h-5 w-5" />

        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white">
            {badgeText}
          </span>
        )}
      </button>

      {isOpen && (
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          isLoading={isLoading}
          isMarkingAllRead={
            isMarkingAllRead
          }
          errorMessage={errorMessage}
          onClose={() => setIsOpen(false)}
          onRetry={() => {
            void loadNotifications();
          }}
          onMarkAllRead={() => {
            void handleMarkAllRead();
          }}
          onOpenNotification={(
            notification,
          ) => {
            void handleOpenNotification(
              notification,
            );
          }}
        />
      )}
    </>
  );
}


export default NotificationBell;
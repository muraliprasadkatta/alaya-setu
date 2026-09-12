import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useOutletContext } from "react-router";
import {
  AlertCircle,
  CalendarDays,
  Clock3,
  Landmark,
  LoaderCircle,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "../../services/apiFetch";
import type { ManageTempleOutletContext } from "../ManageTemple";


type AnnouncementStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected";

type AnnouncementType =
  | "general"
  | "pooja"
  | "seva"
  | "annadanam"
  | "notice"
  | "festival";

type TempleAnnouncement = {
  id: number;
  temple_id: number;
  temple_name: string;
  title: string;
  description: string;
  update_type: AnnouncementType;
  update_type_display: string;
  starts_at: string | null;
  ends_at: string | null;
  status: AnnouncementStatus;
  status_display: string;
  created_by_name: string;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
};

type AnnouncementsResponse = {
  success: boolean;
  can_create: boolean;
  workspace_id: number | null;
  announcements: TempleAnnouncement[];
  count: number;
  message?: string;
};

type MutationResponse = {
  success: boolean;
  announcement?: TempleAnnouncement;
  message?: string;
  errors?: Record<string, unknown>;
};

type AnnouncementForm = {
  title: string;
  description: string;
  update_type: AnnouncementType;
  status: "draft" | "published";
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
};

type AnnouncementFilter =
  | "all"
  | "active"
  | "scheduled"
  | "draft"
  | "expired";


const initialForm: AnnouncementForm = {
  title: "",
  description: "",
  update_type: "general",
  status: "published",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
};

const announcementTypes: Array<{
  value: AnnouncementType;
  label: string;
}> = [
  { value: "general", label: "General Update" },
  { value: "pooja", label: "Pooja Update" },
  { value: "seva", label: "Seva Update" },
  { value: "annadanam", label: "Annadanam Update" },
  { value: "notice", label: "Notice" },
  { value: "festival", label: "Festival Update" },
];


function getErrorMessage(
  errors: Record<string, unknown> | undefined,
  fallback: string,
) {
  if (!errors) {
    return fallback;
  }

  for (const value of Object.values(errors)) {
    if (typeof value === "string") {
      return value;
    }

    if (Array.isArray(value) && value.length > 0) {
      return String(value[0]);
    }
  }

  return fallback;
}


function formatAnnouncementDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function formatSchedule(value: string | null) {
  if (!value) {
    return "Schedule not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Schedule not available";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function getLocalScheduleParts(value: string | null) {
  if (!value) {
    return {
      date: "",
      time: "",
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: "",
      time: "",
    };
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}


function getAnnouncementTypeLabel(type: AnnouncementType) {
  return (
    announcementTypes.find((item) => item.value === type)
      ?.label || "General Update"
  );
}


function getStatusClasses(status: AnnouncementStatus) {
  if (status === "published") {
    return "border-green-200 bg-green-50 text-green-700";
  }

  if (status === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  return "border-gray-200 bg-gray-50 text-gray-700";
}


function getAnnouncementLifecycle(
  announcement: TempleAnnouncement,
  currentTime: number,
): Exclude<AnnouncementFilter, "all"> | "other" {
  if (announcement.status === "draft") {
    return "draft";
  }

  if (announcement.status !== "published") {
    return "other";
  }

  const startTime = announcement.starts_at
    ? new Date(announcement.starts_at).getTime()
    : null;

  const endTime = announcement.ends_at
    ? new Date(announcement.ends_at).getTime()
    : null;

  if (
    startTime !== null &&
    !Number.isNaN(startTime) &&
    startTime > currentTime
  ) {
    return "scheduled";
  }

  if (
    endTime !== null &&
    !Number.isNaN(endTime) &&
    endTime <= currentTime
  ) {
    return "expired";
  }

  return "active";
}


function TempleAnnouncements() {
  const { temple, reloadTemple } =
    useOutletContext<ManageTempleOutletContext>();

  const [announcements, setAnnouncements] =
    useState<TempleAnnouncement[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<TempleAnnouncement | null>(null);
  const [form, setForm] =
    useState<AnnouncementForm>(initialForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingAnnouncementId, setDeletingAnnouncementId] =
    useState<number | null>(null);

  const [currentTime, setCurrentTime] = useState(
    () => Date.now(),
  );

  const [selectedFilter, setSelectedFilter] =
    useState<AnnouncementFilter>("all");

  const announcementsUrl =
    `http://127.0.0.1:8000/api/temples/${temple.id}/announcements/`;


  const loadAnnouncements = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiFetch(announcementsUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal,
        });

        const data = (await response
          .json()
          .catch(() => null)) as
          | AnnouncementsResponse
          | null;

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message ||
              "Announcements load avvaledhu.",
          );
        }

        setAnnouncements(data.announcements);
        setCanCreate(data.can_create);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setAnnouncements([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Announcements load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [announcementsUrl],
  );


  useEffect(() => {
    const controller = new AbortController();

    void loadAnnouncements(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadAnnouncements]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);


  const openCreateModal = () => {
    setEditingAnnouncement(null);
    setForm(initialForm);
    setFormError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };


  const openEditModal = (
    announcement: TempleAnnouncement,
  ) => {
    const startSchedule = getLocalScheduleParts(
      announcement.starts_at,
    );
    const endSchedule = getLocalScheduleParts(
      announcement.ends_at,
    );

    setEditingAnnouncement(announcement);
    setForm({
      title: announcement.title,
      description: announcement.description,
      update_type: announcement.update_type,
      status:
        announcement.status === "published"
          ? "published"
          : "draft",
      start_date: startSchedule.date,
      start_time: startSchedule.time,
      end_date: endSchedule.date,
      end_time: endSchedule.time,
    });
    setFormError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };


  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingAnnouncement(null);
    setForm(initialForm);
    setFormError("");
  };


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    const title = form.title.trim();
    const description = form.description.trim();

    if (title.length < 3) {
      setFormError(
        "Announcement title minimum 3 characters undali.",
      );
      return;
    }

    if (description.length < 5) {
      setFormError(
        "Announcement details minimum 5 characters undali.",
      );
      return;
    }

    if (
      !form.start_date ||
      !form.start_time ||
      !form.end_date ||
      !form.end_time
    ) {
      setFormError(
        "Start and end date/time complete-ga enter cheyyandi.",
      );
      return;
    }

    const startsAt = new Date(
      `${form.start_date}T${form.start_time}`,
    );
    const endsAt = new Date(
      `${form.end_date}T${form.end_time}`,
    );

    if (
      Number.isNaN(startsAt.getTime()) ||
      Number.isNaN(endsAt.getTime())
    ) {
      setFormError(
        "Valid start and end date/time select cheyyandi.",
      );
      return;
    }

    if (endsAt <= startsAt) {
      setFormError(
        "End date and time start taruvatha undali.",
      );
      return;
    }

    const isEditing = editingAnnouncement !== null;
    const requestUrl = isEditing
      ? `${announcementsUrl}${editingAnnouncement.id}/`
      : announcementsUrl;

    setIsSubmitting(true);

    try {
      const response = await apiFetch(requestUrl, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          update_type: form.update_type,
          status: form.status,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (
        !response.ok ||
        !data?.success ||
        !data.announcement
      ) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message ||
              "Announcement save avvaledhu.",
          ),
        );
      }

      if (isEditing) {
        setAnnouncements((current) =>
          current.map((announcement) =>
            announcement.id === data.announcement!.id
              ? data.announcement!
              : announcement,
          ),
        );
      } else {
        setAnnouncements((current) => [
          data.announcement!,
          ...current,
        ]);
      }

      setSuccessMessage(
        data.message ||
          (isEditing
            ? "Announcement update ayyindi."
            : "Announcement create ayyindi."),
      );
      setIsModalOpen(false);
      setEditingAnnouncement(null);
      setForm(initialForm);

      await reloadTemple();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Announcement save avvaledhu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDelete = async (
    announcement: TempleAnnouncement,
  ) => {
    const shouldDelete = window.confirm(
      `"${announcement.title}" announcement delete cheyyala?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingAnnouncementId(announcement.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `${announcementsUrl}${announcement.id}/`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success) {
        throw new Error(
          data?.message ||
            "Announcement delete avvaledhu.",
        );
      }

      setAnnouncements((current) =>
        current.filter(
          (item) => item.id !== announcement.id,
        ),
      );
      setSuccessMessage(
        data.message ||
          "Announcement successfully delete ayyindi.",
      );

      await reloadTemple();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Announcement delete avvaledhu.",
      );
    } finally {
      setDeletingAnnouncementId(null);
    }
  };


  const announcementCounts = announcements.reduce(
    (counts, announcement) => {
      const lifecycle = getAnnouncementLifecycle(
        announcement,
        currentTime,
      );

      counts.all += 1;

      if (lifecycle !== "other") {
        counts[lifecycle] += 1;
      }

      return counts;
    },
    {
      all: 0,
      active: 0,
      scheduled: 0,
      draft: 0,
      expired: 0,
    },
  );

  const filteredAnnouncements =
    selectedFilter === "all"
      ? announcements
      : announcements.filter(
          (announcement) =>
            getAnnouncementLifecycle(
              announcement,
              currentTime,
            ) === selectedFilter,
        );

  const announcementFilters: Array<{
    value: AnnouncementFilter;
    label: string;
    count: number;
  }> = [
    {
      value: "all",
      label: "All",
      count: announcementCounts.all,
    },
    {
      value: "active",
      label: "Active",
      count: announcementCounts.active,
    },
    {
      value: "scheduled",
      label: "Scheduled",
      count: announcementCounts.scheduled,
    },
    {
      value: "draft",
      label: "Drafts",
      count: announcementCounts.draft,
    },
    {
      value: "expired",
      label: "Expired",
      count: announcementCounts.expired,
    },
  ];


  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#332018]">
            Temple Announcements
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-600">
            View announcements from all temples in this
            workspace. New announcements are posted under{" "}
            {temple.name}.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-900"
          >
            <Plus className="h-4 w-4" />
            New Announcement
          </button>
        )}
      </div>


      {successMessage && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          {successMessage}
        </div>
      )}


      {errorMessage && (
        <div
          role="alert"
          className="mt-5 flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>

          <button
            type="button"
            onClick={() => void loadAnnouncements()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}


      {!isLoading && announcements.length > 0 && (
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            {announcementFilters.map((filter) => {
              const isSelected =
                selectedFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() =>
                    setSelectedFilter(filter.value)
                  }
                  aria-pressed={isSelected}
                  className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                    isSelected
                      ? "border-orange-800 bg-orange-800 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              );
            })}
          </div>
        </div>
      )}


      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-2xl bg-orange-50"
            />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-5 py-12 text-center">
          <Megaphone className="h-11 w-11 text-orange-700" />

          <h3 className="mt-4 font-bold text-[#332018]">
            No announcements yet
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
            No announcements are available in this temple
            workspace yet.
          </p>

          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Create Announcement
            </button>
          )}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <h3 className="font-bold text-gray-800">
            No {selectedFilter} announcements
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Ee filter ki matching announcements levu.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filteredAnnouncements.map((announcement) => {
            const isDeleting =
              deletingAnnouncementId === announcement.id;

            const lifecycle = getAnnouncementLifecycle(
              announcement,
              currentTime,
            );

            const isExpired =
              lifecycle === "expired";

            return (
              <article
                key={announcement.id}
                className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${
                  isExpired
                    ? "border-red-200 bg-red-50/50"
                    : "border-gray-200 bg-white"
                }`}
              >
              <div
                className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 ${
                  isExpired
                    ? "border-red-200 bg-red-50"
                    : "border-orange-100 bg-orange-50/70"
                }`}
              >
                  <p className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-orange-900">
                    <Landmark className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {announcement.temple_name}
                    </span>
                  </p>

                  {announcement.temple_id === temple.id && (
                    <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-800">
                      Current Temple
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
                      {getAnnouncementTypeLabel(
                        announcement.update_type,
                      )}
                    </span>

                    {isExpired ? (
                      <span className="rounded-full border border-red-200 bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                        Expired
                      </span>
                    ) : (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClasses(
                          announcement.status,
                        )}`}
                      >
                        {announcement.status_display}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-[#332018]">
                    {announcement.title}
                  </h3>

                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                    {announcement.description}
                  </p>

                  <div
                    className={`mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2 ${
                      isExpired
                        ? "border-red-200 bg-red-50/70"
                        : "border-orange-100 bg-orange-50/70"
                    }`}
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-800">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Starts
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {formatSchedule(
                          announcement.starts_at,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-800">
                        <Clock3 className="h-3.5 w-3.5" />
                        Ends
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {formatSchedule(
                          announcement.ends_at,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs leading-5 text-gray-500">
                      <p className="font-semibold text-gray-700">
                        By {announcement.created_by_name}
                      </p>

                      <p className="mt-1 inline-flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatAnnouncementDate(
                          announcement.created_at,
                        )}
                      </p>
                    </div>

                    {(announcement.can_edit ||
                      announcement.can_delete) && (
                      <div className="flex items-center gap-2">
                        {announcement.can_edit && (
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(announcement)
                            }
                            disabled={isDeleting}
                            aria-label={`Edit ${announcement.title}`}
                            title="Edit announcement"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition hover:bg-orange-50 hover:text-orange-800 disabled:opacity-50"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}

                        {announcement.can_delete && (
                          <button
                            type="button"
                            onClick={() =>
                              void handleDelete(announcement)
                            }
                            disabled={isDeleting}
                            aria-label={`Delete ${announcement.title}`}
                            title="Delete announcement"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}


      {isModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-form-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white px-5 py-4">
              <div>
                <h3
                  id="announcement-form-title"
                  className="text-lg font-bold text-[#332018]"
                >
                  {editingAnnouncement
                    ? "Edit Announcement"
                    : "New Announcement"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {editingAnnouncement
                    ? editingAnnouncement.temple_name
                    : temple.name}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close announcement form"
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5"
            >
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-orange-900">
                Share a temple notice for a specific period.
                Venue and registration details belong in Events.
              </div>

              <div>
                <label
                  htmlFor="announcement-title"
                  className="text-sm font-bold text-gray-800"
                >
                  Title
                </label>

                <input
                  id="announcement-title"
                  type="text"
                  value={form.title}
                  maxLength={255}
                  required
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Example: Temple timings updated"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label
                  htmlFor="announcement-description"
                  className="text-sm font-bold text-gray-800"
                >
                  Announcement Details
                </label>

                <textarea
                  id="announcement-description"
                  value={form.description}
                  required
                  rows={6}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Share the notice, change, or important instructions..."
                  className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-gray-800">
                  Announcement Schedule
                </legend>

                <div className="mt-2 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="announcement-start-date"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Start Date
                    </label>

                    <input
                      id="announcement-start-date"
                      type="date"
                      value={form.start_date}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_date: event.target.value,
                          end_date:
                            current.end_date ||
                            event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="announcement-start-time"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Start Time
                    </label>

                    <input
                      id="announcement-start-time"
                      type="time"
                      value={form.start_time}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_time: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="announcement-end-date"
                      className="text-sm font-semibold text-gray-700"
                    >
                      End Date
                    </label>

                    <input
                      id="announcement-end-date"
                      type="date"
                      value={form.end_date}
                      min={form.start_date || undefined}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_date: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="announcement-end-time"
                      className="text-sm font-semibold text-gray-700"
                    >
                      End Time
                    </label>

                    <input
                      id="announcement-end-time"
                      type="time"
                      value={form.end_time}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_time: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="announcement-type"
                    className="text-sm font-bold text-gray-800"
                  >
                    Category
                  </label>

                  <select
                    id="announcement-type"
                    value={form.update_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        update_type: event.target
                          .value as AnnouncementType,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    {announcementTypes.map((item) => (
                      <option
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="announcement-status"
                    className="text-sm font-bold text-gray-800"
                  >
                    Status
                  </label>

                  <select
                    id="announcement-status"
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value as
                          | "draft"
                          | "published",
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="published">
                      Published
                    </option>
                    <option value="draft">
                      Draft
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Megaphone className="h-4 w-4" />
                  )}

                  {isSubmitting
                    ? "Saving..."
                    : editingAnnouncement
                      ? "Save Changes"
                      : "Create Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}


export default TempleAnnouncements;
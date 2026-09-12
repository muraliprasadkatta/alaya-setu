import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useOutletContext } from "react-router";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Landmark,
  LoaderCircle,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import { apiFetch } from "../../services/apiFetch";
import type { ManageTempleOutletContext } from "../ManageTemple";


type EventStatus =
  | "draft"
  | "pending"
  | "published"
  | "rejected";

type EventType =
  | "festival"
  | "pooja"
  | "seva"
  | "annadanam"
  | "pravachanam"
  | "cleaning"
  | "other";

type EventState = "upcoming" | "ongoing" | "completed";

type TempleEvent = {
  id: number;
  temple_id: number;
  temple_name: string;
  workspace_id: number | null;
  title: string;
  description: string;
  event_type: EventType;
  event_type_display: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  recurrence: "none" | "daily" | "weekly";
  recurrence_display: string;
  is_recurring_occurrence: boolean;
  recurrence_group_id: number | null;
  image: string | null;
  status: EventStatus;
  status_display: string;
  event_state: EventState;
  event_state_display: string;
  created_by_name: string;
  can_edit: boolean;
  can_delete: boolean;
  created_at: string;
  updated_at: string;
};

type EventsResponse = {
  success: boolean;
  can_create: boolean;
  workspace_id: number | null;
  events: TempleEvent[];
  count: number;
  message?: string;
};

type MutationResponse = {
  success: boolean;
  event?: TempleEvent;
  message?: string;
  errors?: Record<string, unknown>;
};

type EventForm = {
  title: string;
  description: string;
  event_type: EventType;
  event_date: string;
  start_time: string;
  end_time: string;
  recurrence: "none" | "daily" | "weekly";
  status: "draft" | "published";
};

type EventFilter =
  | "all"
  | "ongoing"
  | "upcoming"
  | "draft"
  | "completed";


const initialForm: EventForm = {
  title: "",
  description: "",
  event_type: "festival",
  event_date: "",
  start_time: "",
  end_time: "",
  recurrence: "none",
  status: "published",
};

const eventTypes: Array<{
  value: EventType;
  label: string;
}> = [
  { value: "festival", label: "Festival" },
  { value: "pooja", label: "Pooja" },
  { value: "seva", label: "Seva" },
  { value: "annadanam", label: "Annadanam" },
  { value: "pravachanam", label: "Pravachanam" },
  { value: "cleaning", label: "Temple Cleaning" },
  { value: "other", label: "Other" },
];


function getErrorMessage(
  errors: Record<string, unknown> | undefined,
  fallback: string,
): string {
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

    if (value && typeof value === "object") {
      const nestedMessage: string = getErrorMessage(
        value as Record<string, unknown>,
        "",
      );

      if (nestedMessage) {
        return nestedMessage;
      }
    }
  }

  return fallback;
}


function formatEventDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


function formatTime(value: string | null) {
  if (!value) {
    return "Not specified";
  }

  const [hoursValue, minutesValue] = value.split(":");
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return "Not specified";
  }

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}


function formatCreatedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}


function getEventTypeLabel(type: EventType) {
  return (
    eventTypes.find((item) => item.value === type)
      ?.label || "Other"
  );
}


function getStatusClasses(status: EventStatus) {
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


function getStateClasses(state: EventState) {
  if (state === "ongoing") {
    return "border-green-200 bg-green-100 text-green-800";
  }

  if (state === "completed") {
    return "border-red-200 bg-red-100 text-red-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}


function getEventFilterState(
  templeEvent: TempleEvent,
): Exclude<EventFilter, "all"> | "other" {
  if (templeEvent.status === "draft") {
    return "draft";
  }

  if (templeEvent.status !== "published") {
    return "other";
  }

  return templeEvent.event_state;
}


function getDateSortValue(templeEvent: TempleEvent) {
  const time = templeEvent.start_time || "00:00:00";
  const value = new Date(
    `${templeEvent.event_date}T${time}`,
  ).getTime();

  return Number.isNaN(value) ? 0 : value;
}


function TempleEvents() {
  const { temple, reloadTemple } =
    useOutletContext<ManageTempleOutletContext>();

  const [events, setEvents] = useState<TempleEvent[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [selectedFilter, setSelectedFilter] =
    useState<EventFilter>("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] =
    useState<TempleEvent | null>(null);
  const [form, setForm] = useState<EventForm>(initialForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingEventId, setDeletingEventId] =
    useState<number | null>(null);

  // Recurring series ni "View all occurrences" modal lo table గా
  // చూపించడానికి — null aithe modal మూసి ఉంటుంది.
  const [viewingGroupId, setViewingGroupId] =
    useState<number | null>(null);

  const eventsUrl =
    `http://127.0.0.1:8000/api/events/temples/${temple.id}/`;


  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiFetch(eventsUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal,
        });

        const data = (await response
          .json()
          .catch(() => null)) as EventsResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message || "Events load avvaledhu.",
          );
        }

        setEvents(data.events);
        setCanCreate(data.can_create);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setEvents([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Events load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [eventsUrl],
  );


  useEffect(() => {
    const controller = new AbortController();

    void loadEvents(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadEvents]);


  const openCreateModal = () => {
    setEditingEvent(null);
    setForm(initialForm);
    setImageFile(null);
    setFormError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };


  const openEditModal = (templeEvent: TempleEvent) => {
    setEditingEvent(templeEvent);
    setForm({
      title: templeEvent.title,
      description: templeEvent.description,
      event_type: templeEvent.event_type,
      event_date: templeEvent.event_date,
      start_time: templeEvent.start_time?.slice(0, 5) || "",
      end_time: templeEvent.end_time?.slice(0, 5) || "",
      recurrence: templeEvent.recurrence || "none",
      status:
        templeEvent.status === "published"
          ? "published"
          : "draft",
    });
    setImageFile(null);
    setFormError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };


  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsModalOpen(false);
    setEditingEvent(null);
    setForm(initialForm);
    setImageFile(null);
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
        "Event title minimum 3 characters undali.",
      );
      return;
    }

    if (description && description.length < 5) {
      setFormError(
        "Event details minimum 5 characters undali.",
      );
      return;
    }

    if (!form.event_date) {
      setFormError("Event date select cheyyandi.");
      return;
    }

    if (form.end_time && !form.start_time) {
      setFormError(
        "End time add chesthe start time kuda enter cheyyandi.",
      );
      return;
    }

    if (
      form.start_time &&
      form.end_time &&
      form.end_time <= form.start_time
    ) {
      setFormError(
        "End time start time taruvatha undali.",
      );
      return;
    }

    const isEditing = editingEvent !== null;
    const requestUrl = isEditing
      ? `${eventsUrl}${editingEvent.id}/`
      : eventsUrl;

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      formData.append("event_type", form.event_type);
      formData.append("event_date", form.event_date);
      formData.append("start_time", form.start_time || "");
      formData.append("end_time", form.end_time || "");
      formData.append("recurrence", form.recurrence);
      formData.append("status", form.status);

      if (imageFile) {
        formData.append("image", imageFile);
      }

      const response = await apiFetch(requestUrl, {
        method: isEditing ? "PATCH" : "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      });

      const data = (await response
        .json()
        .catch(() => null)) as MutationResponse | null;

      if (!response.ok || !data?.success || !data.event) {
        throw new Error(
          getErrorMessage(
            data?.errors,
            data?.message || "Event save avvaledhu.",
          ),
        );
      }

      if (isEditing) {
        setEvents((current) =>
          current.map((item) =>
            item.id === data.event!.id
              ? data.event!
              : item,
          ),
        );
      } else {
        setEvents((current) => [data.event!, ...current]);
      }

      setSuccessMessage(
        data.message ||
          (isEditing
            ? "Event update ayyindi."
            : "Event create ayyindi."),
      );
      setIsModalOpen(false);
      setEditingEvent(null);
      setForm(initialForm);
      setImageFile(null);
      

      await reloadTemple();
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Event save avvaledhu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDelete = async (templeEvent: TempleEvent) => {
    const shouldDelete = window.confirm(
      `"${templeEvent.title}" event delete cheyyala?`,
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingEventId(templeEvent.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await apiFetch(
        `${eventsUrl}${templeEvent.id}/`,
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
          data?.message || "Event delete avvaledhu.",
        );
      }

      const isPartOfSeries =
        templeEvent.recurrence !== "none" ||
        templeEvent.is_recurring_occurrence;

      if (isPartOfSeries) {
        // Backend ee event ni (recurring series lo undi kābatti)
        // hard-delete cheyyakunda status='rejected' గా mark చేస్తుంది
        // — local state ni కూడా అదే విధంగా reflect చేద్దాం, filter
        // చేసి తీసేస్తే refresh chేసినప్పుడు "Rejected" badge తో
        // మళ్ళీ vaste confusing గా అనిపిస్తుంది.
        setEvents((current) =>
          current.map((item) =>
            item.id === templeEvent.id
              ? { ...item, status: "rejected", status_display: "Rejected" }
              : item,
          ),
        );
      } else {
        setEvents((current) =>
          current.filter((item) => item.id !== templeEvent.id),
        );
      }

      setSuccessMessage(
        data.message || "Event successfully delete ayyindi.",
      );

      await reloadTemple();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Event delete avvaledhu.",
      );
    } finally {
      setDeletingEventId(null);
    }
  };


  const eventCounts = useMemo(
    () =>
      events.reduce(
        (counts, templeEvent) => {
          const filterState = getEventFilterState(templeEvent);

          counts.all += 1;

          if (filterState !== "other") {
            counts[filterState] += 1;
          }

          return counts;
        },
        {
          all: 0,
          ongoing: 0,
          upcoming: 0,
          draft: 0,
          completed: 0,
        },
      ),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const matchingEvents =
      selectedFilter === "all"
        ? [...events]
        : events.filter(
            (templeEvent) =>
              getEventFilterState(templeEvent) === selectedFilter,
          );

    return matchingEvents.sort((first, second) => {
      const firstState = getEventFilterState(first);
      const secondState = getEventFilterState(second);

      if (
        firstState === "completed" &&
        secondState === "completed"
      ) {
        return getDateSortValue(second) - getDateSortValue(first);
      }

      if (firstState === "completed") {
        return 1;
      }

      if (secondState === "completed") {
        return -1;
      }

      return getDateSortValue(first) - getDateSortValue(second);
    });
  }, [events, selectedFilter]);

  // Recurring series (Daily/Weekly) ki chెందిన anni occurrences ni
  // vetuku vetuku scroll చేయాల్సిన అవసరం లేకుండా — ఒకే series ki
  // chెందిన events anni okate "card" గా collapse చేస్తాం. Card
  // meedha "next" (soonest, Completed కాని) occurrence details
  // చూపిస్తాం; anni Completed aithe matrame latest completed
  // dానిని fallback గా చూపిస్తాం. Standalone (one-time) events
  // ekెప్పటిలాగే విడిగా cards గా ఉంటాయి.
  type DisplayCard =
    | { kind: "single"; event: TempleEvent }
    | {
        kind: "series";
        groupId: number;
        representative: TempleEvent;
        occurrences: TempleEvent[];
      };

  const displayCards = useMemo<DisplayCard[]>(() => {
    const seriesMap = new Map<number, TempleEvent[]>();
    const singles: TempleEvent[] = [];

    for (const templeEvent of filteredEvents) {
      if (templeEvent.recurrence_group_id != null) {
        const list =
          seriesMap.get(templeEvent.recurrence_group_id) ?? [];
        list.push(templeEvent);
        seriesMap.set(templeEvent.recurrence_group_id, list);
      } else {
        singles.push(templeEvent);
      }
    }

    const seriesCards: DisplayCard[] = Array.from(
      seriesMap.entries(),
    ).map(([groupId, occurrences]) => {
      const sorted = [...occurrences].sort(
        (a, b) => getDateSortValue(a) - getDateSortValue(b),
      );

      const nextUp = sorted.find(
        (occurrence) =>
          occurrence.status === "published" &&
          getEventFilterState(occurrence) !== "completed",
      );

      const representative = nextUp ?? sorted[sorted.length - 1];

      return { kind: "series", groupId, representative, occurrences: sorted };
    });

    const singleCards: DisplayCard[] = singles.map((event) => ({
      kind: "single",
      event,
    }));

    const getRepresentative = (card: DisplayCard) =>
      card.kind === "single" ? card.event : card.representative;

    return [...singleCards, ...seriesCards].sort((first, second) => {
      const firstEvent = getRepresentative(first);
      const secondEvent = getRepresentative(second);
      const firstState = getEventFilterState(firstEvent);
      const secondState = getEventFilterState(secondEvent);

      if (firstState === "completed" && secondState === "completed") {
        return getDateSortValue(secondEvent) - getDateSortValue(firstEvent);
      }

      if (firstState === "completed") return 1;
      if (secondState === "completed") return -1;

      return getDateSortValue(firstEvent) - getDateSortValue(secondEvent);
    });
  }, [filteredEvents]);

  const viewingSeriesEvents = useMemo(() => {
    if (viewingGroupId == null) {
      return [];
    }

    return events
      .filter(
        (templeEvent) =>
          templeEvent.recurrence_group_id === viewingGroupId,
      )
      .sort((a, b) => getDateSortValue(a) - getDateSortValue(b));
  }, [events, viewingGroupId]);

  const eventFilters: Array<{
    value: EventFilter;
    label: string;
    count: number;
  }> = [
    { value: "all", label: "All", count: eventCounts.all },
    {
      value: "ongoing",
      label: "Ongoing",
      count: eventCounts.ongoing,
    },
    {
      value: "upcoming",
      label: "Upcoming",
      count: eventCounts.upcoming,
    },
    {
      value: "draft",
      label: "Drafts",
      count: eventCounts.draft,
    },
    {
      value: "completed",
      label: "Completed",
      count: eventCounts.completed,
    },
  ];


  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#332018]">
            Temple Events
          </h2>

          <p className="mt-1 text-sm leading-6 text-gray-600">
            View events from all temples in this workspace. New
            events are created under {temple.name}.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-900"
          >
            <Plus className="h-4 w-4" />
            New Event
          </button>
        )}
      </div>


      {successMessage && (
        <div
          role="status"
          className="mt-5 flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{successMessage}</span>
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
            onClick={() => void loadEvents()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}


      {!isLoading && events.length > 0 && (
        <div className="mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-2">
            {eventFilters.map((filter) => {
              const isSelected =
                selectedFilter === filter.value;

              return (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setSelectedFilter(filter.value)}
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
              className="h-72 animate-pulse rounded-2xl bg-orange-50"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-5 py-12 text-center">
          <CalendarDays className="h-11 w-11 text-orange-700" />

          <h3 className="mt-4 font-bold text-[#332018]">
            No events yet
          </h3>

          <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
            No events are available in this temple workspace yet.
          </p>

          {canCreate && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              Create Event
            </button>
          )}
        </div>
      ) : displayCards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-5 py-10 text-center">
          <h3 className="font-bold text-gray-800">
            No {selectedFilter} events
          </h3>

          <p className="mt-2 text-sm text-gray-500">
            Ee filter ki matching events levu.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {displayCards.map((card) => {
            const templeEvent =
              card.kind === "single" ? card.event : card.representative;
            const isDeleting =
              deletingEventId === templeEvent.id;
            const isCompleted =
              templeEvent.status === "published" &&
              templeEvent.event_state === "completed";

            return (
              <article
                key={
                  card.kind === "single"
                    ? `single-${card.event.id}`
                    : `series-${card.groupId}`
                }
                className={`overflow-hidden rounded-2xl border shadow-sm transition-colors ${
                  isCompleted
                    ? "border-red-200 bg-red-50/40"
                    : "border-gray-200 bg-white"
                }`}
              >
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3 ${
                    isCompleted
                      ? "border-red-200 bg-red-50"
                      : "border-orange-100 bg-orange-50/70"
                  }`}
                >
                  <p className="inline-flex min-w-0 items-center gap-2 text-sm font-bold text-orange-900">
                    <Landmark className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {templeEvent.temple_name}
                    </span>
                  </p>

                  {templeEvent.temple_id === temple.id && (
                    <span className="rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-800">
                      Current Temple
                    </span>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
                      {getEventTypeLabel(templeEvent.event_type)}
                    </span>

                    {templeEvent.status === "published" ? (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStateClasses(
                          templeEvent.event_state,
                        )}`}
                      >
                        {templeEvent.event_state_display}
                      </span>
                    ) : (
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClasses(
                          templeEvent.status,
                        )}`}
                      >
                        {templeEvent.status_display}
                      </span>
                    )}

                    {card.kind === "series" && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-800">
                        <RefreshCw className="h-3 w-3" />
                        {templeEvent.recurrence_display} ·{" "}
                        {card.occurrences.length} occurrences
                      </span>
                    )}
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-[#332018]">
                    {templeEvent.title}
                  </h3>

                  {templeEvent.description ? (
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-600">
                      {templeEvent.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-gray-400">
                      No additional event details.
                    </p>
                  )}

                  <div
                    className={`mt-4 grid gap-3 rounded-xl border p-3 sm:grid-cols-2 ${
                      isCompleted
                        ? "border-red-200 bg-red-50/70"
                        : "border-orange-100 bg-orange-50/70"
                    }`}
                  >
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-800">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {card.kind === "series"
                          ? "Next Event Date"
                          : "Event Date"}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {formatEventDate(templeEvent.event_date)}
                      </p>
                    </div>

                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-orange-800">
                        <Clock3 className="h-3.5 w-3.5" />
                        Timings
                      </p>

                      <p className="mt-1 text-sm font-semibold text-gray-700">
                        {templeEvent.start_time
                          ? `${formatTime(templeEvent.start_time)}${
                              templeEvent.end_time
                                ? ` – ${formatTime(
                                    templeEvent.end_time,
                                  )}`
                                : ""
                            }`
                          : "All-day / not specified"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                    <div className="space-y-1 text-xs text-gray-500">
                      <p className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        Created by {templeEvent.created_by_name}
                      </p>

                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        Added {formatCreatedDate(
                          templeEvent.created_at,
                        )}
                      </p>
                    </div>

                    {card.kind === "series" ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingGroupId(card.groupId)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-bold text-purple-800 transition hover:bg-purple-50"
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        View all occurrences ({card.occurrences.length})
                      </button>
                    ) : (
                      (templeEvent.can_edit ||
                        templeEvent.can_delete) && (
                        <div className="flex items-center gap-2">
                          {templeEvent.can_edit && (
                            <button
                              type="button"
                              onClick={() =>
                                openEditModal(templeEvent)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>
                          )}

                          {templeEvent.can_delete && (
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() =>
                                void handleDelete(templeEvent)
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isDeleting ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Delete
                            </button>
                          )}
                        </div>
                      )
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="event-modal-title"
        >
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h3
                  id="event-modal-title"
                  className="text-lg font-bold text-[#332018]"
                >
                  {editingEvent ? "Edit Event" : "Create Event"}
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  This event will be stored under {temple.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                aria-label="Close event form"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-5 sm:p-6"
            >
              {formError && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="event-title"
                  className="text-sm font-bold text-gray-800"
                >
                  Event Title
                </label>

                <input
                  id="event-title"
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
                  placeholder="Example: Sri Rama Navami Celebrations"
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div>
                <label
                  htmlFor="event-image"
                  className="text-sm font-bold text-gray-800"
                >
                  Event Photo (optional)
                </label>

                <input
                  id="event-image"
                  type="file"
                  accept="image/*"
                  onChange={(event) =>
                    setImageFile(event.target.files?.[0] ?? null)
                  }
                  className="mt-2 w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-orange-700"
                />

                <p className="mt-1 text-xs text-gray-500">
                  Landscape (అడ్డం) photos better fit అవుతాయి.
                </p>
              </div>

              <div>
                <label
                  htmlFor="event-description"
                  className="text-sm font-bold text-gray-800"
                >
                  Event Details
                </label>

                <textarea
                  id="event-description"
                  value={form.description}
                  rows={5}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Share event programme, instructions, or devotee information..."
                  className="mt-2 w-full resize-y rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="event-type"
                    className="text-sm font-bold text-gray-800"
                  >
                    Event Type
                  </label>

                  <select
                    id="event-type"
                    value={form.event_type}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        event_type: event.target.value as EventType,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    {eventTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="event-status"
                    className="text-sm font-bold text-gray-800"
                  >
                    Status
                  </label>

                  <select
                    id="event-status"
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
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <fieldset>
                <legend className="text-sm font-bold text-gray-800">
                  Event Schedule
                </legend>

                <div className="mt-2 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="event-date"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Event Date
                    </label>

                    <input
                      id="event-date"
                      type="date"
                      value={form.event_date}
                      required
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          event_date: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-start-time"
                      className="text-sm font-semibold text-gray-700"
                    >
                      Start Time
                    </label>

                    <input
                      id="event-start-time"
                      type="time"
                      value={form.start_time}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          start_time: event.target.value,
                          end_time: event.target.value
                            ? current.end_time
                            : "",
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="event-end-time"
                      className="text-sm font-semibold text-gray-700"
                    >
                      End Time
                    </label>

                    <input
                      id="event-end-time"
                      type="time"
                      value={form.end_time}
                      min={form.start_time || undefined}
                      disabled={!form.start_time}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          end_time: event.target.value,
                        }))
                      }
                      className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                    />
                  </div>
                </div>

                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Timings optional. End time add cheyyalante start
                  time required.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="event-recurrence"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Repeat
                  </label>

                  <select
                    id="event-recurrence"
                    value={form.recurrence}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrence: event.target.value as
                          | "none"
                          | "daily"
                          | "weekly",
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="none">Never (one-time event)</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">
                      Weekly (same day as Event Date meedha)
                    </option>
                  </select>

                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Weekly ఎంచుకుంటే, పైన pettిన Event Date యొక్క
                    weekday (ఉదా. Friday) prathi week automatic గా
                    repeat అవుతుంది — matrame date rendundu manual
                    గా update చేయాల్సిన అవసరం ఉండదు.
                  </p>
                </div>
              </fieldset>

              <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-orange-900">
                  <Sparkles className="h-4 w-4" />
                  Event visibility
                </p>

                <p className="mt-1 text-xs leading-5 text-orange-800/80">
                  Published events workspace members ki visible
                  untayi. Draft events management section lo matrame
                  untayi.
                </p>
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
                    <CalendarDays className="h-4 w-4" />
                  )}

                  {isSubmitting
                    ? "Saving..."
                    : editingEvent
                      ? "Save Changes"
                      : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewingGroupId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="occurrences-modal-title"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white px-5 py-4 sm:px-6">
              <div>
                <h3
                  id="occurrences-modal-title"
                  className="text-lg font-bold text-[#332018]"
                >
                  All occurrences
                </h3>

                <p className="mt-1 text-sm text-gray-500">
                  {viewingSeriesEvents.length} occurrences in this
                  recurring series.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingGroupId(null)}
                aria-label="Close occurrences list"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-x-auto p-5 sm:p-6">
              <table className="w-full min-w-max text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <th className="pb-3 pr-4">Event Date</th>
                    <th className="pb-3 pr-4">Timings</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {viewingSeriesEvents.map((occurrence) => {
                    const isDeleting =
                      deletingEventId === occurrence.id;

                    return (
                      <tr key={occurrence.id}>
                        <td className="py-3 pr-4 font-semibold text-gray-700">
                          {formatEventDate(occurrence.event_date)}
                        </td>

                        <td className="py-3 pr-4 text-gray-600">
                          {occurrence.start_time
                            ? `${formatTime(occurrence.start_time)}${
                                occurrence.end_time
                                  ? ` – ${formatTime(occurrence.end_time)}`
                                  : ""
                              }`
                            : "All-day"}
                        </td>

                        <td className="py-3 pr-4">
                          {occurrence.status === "published" ? (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStateClasses(
                                occurrence.event_state,
                              )}`}
                            >
                              {occurrence.event_state_display}
                            </span>
                          ) : (
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClasses(
                                occurrence.status,
                              )}`}
                            >
                              {occurrence.status_display}
                            </span>
                          )}
                        </td>

                        <td className="py-3 pr-4">
                          <div className="flex items-center justify-end gap-2">
                            {occurrence.can_edit && (
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingGroupId(null);
                                  openEditModal(occurrence);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-900"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </button>
                            )}

                            {occurrence.can_delete && (
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={() =>
                                  void handleDelete(occurrence)
                                }
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isDeleting ? (
                                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


export default TempleEvents;
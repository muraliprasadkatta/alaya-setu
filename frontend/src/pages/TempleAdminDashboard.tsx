import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  Clock3,
  Landmark,
  PlusCircle,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";

import { apiFetch } from "../services/apiFetch";


const MY_TEMPLE_REQUESTS_URL =
  "http://127.0.0.1:8000/api/temples/requests/my/";

const MY_TEMPLES_URL =
  "http://127.0.0.1:8000/api/temples/my/";


type TempleRequestStatus = "pending" | "approved" | "rejected";

type TempleRequestFilter = "all" | TempleRequestStatus;

type TempleRequestType = "new_temple" | "claim_temple";

type TempleRequestSummary = {
  id: number;
  request_type: TempleRequestType;
  temple_name: string;
  status: TempleRequestStatus;
  status_display: string;
  rejection_reason: string;
  resubmitted_from_id: number | null;
  can_resubmit: boolean;
  created_at: string;
};

type MyTempleRequestsResponse = {
  success: boolean;
  latest_request: TempleRequestSummary | null;
  requests: TempleRequestSummary[];
  count: number;
  message?: string;
};

type MyTempleSummary = {
  id: number;
  name: string;
  main_deity: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  image: string | null;
  is_verified: boolean;
  membership_role: "owner" | "manager" | "editor";
  announcements_count?: number;
  events_count?: number;
};

type WorkspaceSummary = {
  total_members?: number;
  published_updates?: number;
};

type MyTemplesResponse = {
  success: boolean;
  temples: MyTempleSummary[];
  count: number;
  summary?: WorkspaceSummary;
  message?: string;
};

type UserRole =
  | "devotee"
  | "pending_temple_admin"
  | "temple_admin"
  | "temple_member"
  | "super_admin";


const requestStatusConfig = {
  pending: {
    label: "Pending Review",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    dotClass: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    badgeClass: "border-green-200 bg-green-50 text-green-700",
    dotClass: "bg-green-500",
  },
  rejected: {
    label: "Rejected",
    badgeClass: "border-red-200 bg-red-50 text-red-700",
    dotClass: "bg-red-500",
  },
} satisfies Record<
  TempleRequestStatus,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
  }
>;


const requestFilters: Array<{
  value: TempleRequestFilter;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "pending",
    label: "Pending",
  },
  {
    value: "approved",
    label: "Approved",
  },
  {
    value: "rejected",
    label: "Rejected",
  },
];


function isTempleRequestStatus(
  value: unknown,
): value is TempleRequestStatus {
  return (
    value === "pending" ||
    value === "approved" ||
    value === "rejected"
  );
}


function formatSubmittedDate(value: string) {
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


function getRequestTypeLabel(requestType: TempleRequestType) {
  if (requestType === "claim_temple") {
    return "Claim Existing Temple";
  }

  return "New Temple Registration";
}


function getTempleLocation(temple: MyTempleSummary) {
  return [
    temple.city,
    temple.district,
    temple.state,
  ]
    .filter(Boolean)
    .join(", ");
}


function getMembershipRoleLabel(
  role: MyTempleSummary["membership_role"],
) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}


function getTempleActivityCount(value?: number) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
    ? value
    : 0;
}


function getStoredUserRole(): UserRole | "" {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return "";
    }

    const parsedUser = JSON.parse(storedUser) as {
      role?: UserRole;
    };

    return parsedUser.role || "";
  } catch {
    return "";
  }
}


function getTempleCardGridClass(
  index: number,
  total: number,
) {
  const isLastCard = index === total - 1;
  const isInLastTwoCards = index >= total - 2;

  const tabletClass =
    total % 2 === 1 && isLastCard
      ? "sm:col-span-6"
      : "sm:col-span-3";

  let desktopClass = "lg:col-span-2";

  if (total % 3 === 1 && isLastCard) {
    desktopClass = "lg:col-span-6";
  } else if (
    total % 3 === 2 &&
    isInLastTwoCards
  ) {
    desktopClass = "lg:col-span-3";
  }

  return `col-span-6 ${tabletClass} ${desktopClass}`;
}


function TempleAdminDashboard() {
  const [userRole] = useState(getStoredUserRole);

  const isTempleMember =
    userRole === "temple_member";

  const [latestRequest, setLatestRequest] =
    useState<TempleRequestSummary | null>(null);

  const [requests, setRequests] =
    useState<TempleRequestSummary[]>([]);

  const [activeRequestFilter, setActiveRequestFilter] =
    useState<TempleRequestFilter>("all");

  const [expandedRequestId, setExpandedRequestId] =
    useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(
    !isTempleMember,
  );

  const [errorMessage, setErrorMessage] = useState("");

  const [temples, setTemples] =
    useState<MyTempleSummary[]>([]);

  const [workspaceSummary, setWorkspaceSummary] =
    useState<WorkspaceSummary | null>(null);

  const [isTemplesLoading, setIsTemplesLoading] =
    useState(true);

  const [templesErrorMessage, setTemplesErrorMessage] =
    useState("");

  const loadTempleRequestStatus = useCallback(
    async (signal?: AbortSignal) => {
      if (isTempleMember) {
        setLatestRequest(null);
        setRequests([]);
        setErrorMessage("");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiFetch(
          MY_TEMPLE_REQUESTS_URL,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal,
          },
        );

        const data = (await response
          .json()
          .catch(() => null)) as MyTempleRequestsResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message ||
              "Temple request status load avvaledhu.",
          );
        }

        const loadedRequests = Array.isArray(data.requests)
          ? data.requests
          : [];

        const hasUnknownStatus = loadedRequests.some(
          (request) =>
            !isTempleRequestStatus(request.status),
        );

        if (
          hasUnknownStatus ||
          (
            data.latest_request &&
            !isTempleRequestStatus(data.latest_request.status)
          )
        ) {
          throw new Error(
            "Backend nunchi unknown request status vachindhi.",
          );
        }

        const resolvedLatestRequest =
          data.latest_request ||
          loadedRequests[0] ||
          null;

        const resolvedRequests =
          loadedRequests.length > 0
            ? loadedRequests
            : resolvedLatestRequest
              ? [resolvedLatestRequest]
              : [];

        setLatestRequest(resolvedLatestRequest);
        setRequests(resolvedRequests);
        setActiveRequestFilter("all");
        setExpandedRequestId(null);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setLatestRequest(null);
        setRequests([]);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Temple request status load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [isTempleMember],
  );

  const loadMyTemples = useCallback(
    async (signal?: AbortSignal) => {
      setIsTemplesLoading(true);
      setTemplesErrorMessage("");

      try {
        const response = await apiFetch(
          MY_TEMPLES_URL,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
            signal,
          },
        );

        const data = (await response
          .json()
          .catch(() => null)) as MyTemplesResponse | null;

        if (!response.ok || !data?.success) {
          throw new Error(
            data?.message || "Temples load avvaledhu.",
          );
        }

        setTemples(
          Array.isArray(data.temples)
            ? data.temples
            : [],
        );

        setWorkspaceSummary(data.summary || null);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setTemples([]);
        setWorkspaceSummary(null);
        setTemplesErrorMessage(
          error instanceof Error
            ? error.message
            : "Temples load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsTemplesLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    if (isTempleMember) {
      return;
    }

    const controller = new AbortController();

    void loadTempleRequestStatus(controller.signal);

    return () => {
      controller.abort();
    };
  }, [
    isTempleMember,
    loadTempleRequestStatus,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    void loadMyTemples(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadMyTemples]);

  const requestCounts = useMemo(
    () => ({
      all: requests.length,
      pending: requests.filter(
        (request) => request.status === "pending",
      ).length,
      approved: requests.filter(
        (request) => request.status === "approved",
      ).length,
      rejected: requests.filter(
        (request) => request.status === "rejected",
      ).length,
    }),
    [requests],
  );

  const filteredRequests = useMemo(
    () =>
      activeRequestFilter === "all"
        ? requests
        : requests.filter(
            (request) =>
              request.status === activeRequestFilter,
          ),
    [
      activeRequestFilter,
      requests,
    ],
  );

  const verifiedTemplesCount = temples.filter(
    (temple) => temple.is_verified,
  ).length;

  const templeCountLabel = isTempleMember
    ? `${temples.length} assigned temple${
        temples.length === 1 ? "" : "s"
      }`
    : `${verifiedTemplesCount} verified temple${
        verifiedTemplesCount === 1 ? "" : "s"
      }`;

  const membersCount =
    typeof workspaceSummary?.total_members === "number"
      ? workspaceSummary.total_members
      : "—";

  const publishedUpdatesCount =
    typeof workspaceSummary?.published_updates === "number"
      ? workspaceSummary.published_updates
      : "—";

  const pendingRequestsCount =
    requestCounts.pending;

  let emptyStateTitle = "No approved temple yet";
  let emptyStateDescription =
    "Add your temple details for verification. Approved temples will appear here.";
  let showEmptyStateAction = true;
  let emptyStateActionLabel = "Add Temple";
  let emptyStateActionPath = "/temple-request";

  if (isTempleMember) {
    emptyStateTitle = "No temple assigned yet";
    emptyStateDescription =
      "A temple owner needs to add you as a member before a temple appears here.";
    showEmptyStateAction = false;
  } else if (latestRequest?.status === "pending") {
    emptyStateTitle = "Temple registration under review";
    emptyStateDescription =
      "Your request is being reviewed. Once approved, your temple will appear here.";
    showEmptyStateAction = false;
  } else if (latestRequest?.status === "approved") {
    emptyStateTitle = "Temple request approved";
    emptyStateDescription =
      "Your request was approved. Temple management details will appear here shortly.";
    showEmptyStateAction = false;
  } else if (latestRequest?.status === "rejected") {
    emptyStateTitle = "No approved temple yet";
    emptyStateDescription =
      "Review the rejected request below, correct the details, and submit it again.";
    showEmptyStateAction = false;
  }

  if (
    isTemplesLoading ||
    (!isTempleMember && isLoading)
  ) {
    emptyStateTitle = "Checking your temples";
    emptyStateDescription =
      isTempleMember
        ? "Please wait while we load your assigned temple details."
        : "Please wait while we load your approved temple details.";
    showEmptyStateAction = false;
  } else if (templesErrorMessage) {
    emptyStateTitle = "Temple information unavailable";
    emptyStateDescription =
      isTempleMember
        ? "Assigned temples load avvaledhu. Retry button use cheyyandi."
        : "Approved temples load avvaledhu. Retry button use cheyyandi.";
    showEmptyStateAction = false;
  }

  const renderOverviewMetric = (
    label: string,
    value: number | string,
    icon: "temple" | "pending" | "members" | "updates",
  ) => {
    const Icon =
      icon === "temple"
        ? Landmark
        : icon === "pending"
          ? Clock3
          : icon === "members"
            ? Users
            : Bell;

    return (
      <div className="flex min-h-32 flex-col items-center justify-center p-4 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-800">
          <Icon className="h-5 w-5" />
        </div>

        <p className="mt-3 text-xs font-medium text-gray-500">
          {label}
        </p>

        <p className="mt-1 text-2xl font-bold text-[#332018]">
          {value}
        </p>
      </div>
    );
  };

  return (
    <>
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">
            {isTempleMember
              ? "Temple Member Dashboard"
              : "Temple Admin Dashboard"}
          </p>

          <h1 className="mt-2 text-2xl font-bold leading-tight text-[#332018] sm:text-3xl">
            {isTempleMember
              ? "Temple workspace"
              : "Temple management"}
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">
            {isTempleMember
              ? "Access your assigned temples and permitted workspace features."
              : "Review registrations and manage your temple workspace."}
          </p>
        </div>

        {!isTempleMember && (
          <Link
            to="/temple-request"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-900 sm:w-auto"
          >
            <PlusCircle className="h-5 w-5" />
            Add Temple
          </Link>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#332018]">
              {isTempleMember
                ? "Assigned Temples"
                : "Your Temples"}
            </h2>

            {!isTemplesLoading &&
              !templesErrorMessage &&
              temples.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {templeCountLabel}
                </p>
              )}
          </div>
        </div>

        {isTemplesLoading && (
          <div
            aria-live="polite"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
              >
                <div className="flex gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-full bg-orange-100" />

                  <div className="flex-1">
                    <div className="h-4 w-36 rounded bg-orange-100" />
                    <div className="mt-3 h-3 w-24 rounded bg-orange-50" />
                    <div className="mt-2 h-3 w-full rounded bg-orange-50" />
                  </div>
                </div>

                <div className="mt-5 h-10 rounded-xl bg-orange-50" />
              </div>
            ))}
          </div>
        )}

        {!isTemplesLoading && templesErrorMessage && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />

                <div>
                  <h3 className="text-sm font-bold text-red-900">
                    {isTempleMember
                      ? "Assigned temples load avvaledhu"
                      : "Approved temples load avvaledhu"}
                  </h3>

                  <p className="mt-1 text-xs leading-5 text-red-700">
                    {templesErrorMessage}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void loadMyTemples()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        )}

        {!isTemplesLoading &&
          !templesErrorMessage &&
          temples.length > 0 && (
            <div className="grid grid-cols-6 gap-4">
              {temples.map((temple, index) => (
                <article
                  key={temple.id}
                  className={`${getTempleCardGridClass(
                    index,
                    temples.length,
                  )} flex h-full flex-col rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md`}
                >
                  <div className="flex min-w-0 flex-wrap items-start gap-4">
                    {temple.image ? (
                      <img
                        src={temple.image}
                        alt={temple.name}
                        className="h-12 w-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100">
                        <Landmark className="h-6 w-6 text-orange-800" />
                      </div>
                    )}

                    <div className="min-w-[10rem] flex-1">
                      <h3
                        className="line-clamp-2 min-h-10 break-words text-base font-bold leading-5 text-[#332018]"
                        title={temple.name}
                      >
                        {temple.name}
                      </h3>

                      <p
                        className="mt-1 truncate text-sm font-semibold text-gray-700"
                        title={
                          temple.main_deity ||
                          "Main deity not added"
                        }
                      >
                        {temple.main_deity ||
                          "Main deity not added"}
                      </p>

                      <p
                        className="mt-1 truncate text-xs leading-5 text-gray-500"
                        title={
                          getTempleLocation(temple) ||
                          "Location not available"
                        }
                      >
                        {getTempleLocation(temple) ||
                          "Location not available"}
                      </p>
                    </div>

                    <div className="ml-auto flex max-w-full shrink-0 flex-wrap justify-end gap-2">
                      {temple.is_verified && (
                        <span className="inline-flex items-center rounded-lg border border-green-200 bg-green-50 px-2.5 py-1 text-[11px] font-bold text-green-700">
                          Verified
                        </span>
                      )}

                      <span className="inline-flex items-center rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800">
                        {getMembershipRoleLabel(
                          temple.membership_role,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-orange-800 shadow-sm">
                        <Bell className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-gray-500">
                          Announcements
                        </p>

                        <p className="mt-0.5 text-lg font-bold leading-none text-[#332018]">
                          {getTempleActivityCount(
                            temple.announcements_count,
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/70 px-3 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-orange-800 shadow-sm">
                        <CalendarDays className="h-4.5 w-4.5" />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-[10px] font-semibold text-gray-500">
                          Events
                        </p>

                        <p className="mt-0.5 text-lg font-bold leading-none text-[#332018]">
                          {getTempleActivityCount(
                            temple.events_count,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-1 flex-col justify-end border-t border-orange-100 pt-4">
                    <Link
                      to={`/temples/${temple.id}/manage`}
                      className="inline-flex items-center justify-center rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-orange-900"
                    >
                      {isTempleMember
                        ? "Open Temple"
                        : "Manage Temple"}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}

        {!isTemplesLoading &&
          !templesErrorMessage &&
          temples.length === 0 && (
            <div className="rounded-2xl border border-dashed border-orange-200 bg-white/80 p-6 text-center shadow-sm sm:p-8">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <Landmark className="h-6 w-6 text-orange-800" />
              </div>

              <h3 className="mt-4 text-base font-bold text-[#332018]">
                {emptyStateTitle}
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
                {emptyStateDescription}
              </p>

              {showEmptyStateAction && (
                <Link
                  to={emptyStateActionPath}
                  className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-orange-700 px-5 py-2.5 text-sm font-bold text-orange-800 transition-colors hover:bg-orange-50"
                >
                  <PlusCircle className="h-5 w-5" />
                  {emptyStateActionLabel}
                </Link>
              )}
            </div>
          )}
      </section>

      {!isTempleMember && (
        <section className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
          <div className="min-w-0 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-[#332018]">
                Temple Registration Requests
              </h2>

              <div
                className="mt-4 flex max-w-full gap-1 overflow-x-auto border-b border-orange-100"
                role="tablist"
                aria-label="Temple request filters"
              >
                {requestFilters.map((filter) => {
                  const isActive =
                    activeRequestFilter === filter.value;

                  return (
                    <button
                      key={filter.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() =>
                        setActiveRequestFilter(filter.value)
                      }
                      className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${
                        isActive
                          ? "border-orange-700 text-orange-800"
                          : "border-transparent text-gray-500 hover:text-orange-800"
                      }`}
                    >
                      {filter.label}

                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] ${
                          isActive
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {requestCounts[filter.value]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {isLoading && (
              <div
                aria-live="polite"
                className="mt-4 animate-pulse rounded-xl border border-orange-100 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 shrink-0 rounded-full bg-orange-100" />

                  <div className="flex-1">
                    <div className="h-3 w-36 rounded bg-orange-100" />
                    <div className="mt-2 h-3 w-24 rounded bg-orange-50" />
                  </div>
                </div>
              </div>
            )}

            {!isLoading && errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />

                    <div>
                      <h3 className="text-sm font-bold text-red-900">
                        Request status load avvaledhu
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-red-700">
                        {errorMessage}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void loadTempleRequestStatus()
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-100"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                </div>
              </div>
            )}

            {!isLoading &&
              !errorMessage &&
              filteredRequests.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-orange-200 bg-orange-50/40 p-6 text-center">
                  <p className="text-sm font-bold text-[#332018]">
                    No {activeRequestFilter === "all"
                      ? ""
                      : `${activeRequestFilter} `}
                    requests found
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Requests matching this filter will appear here.
                  </p>
                </div>
              )}

            {!isLoading &&
              !errorMessage &&
              filteredRequests.length > 0 && (
                <div className="mt-4 space-y-3">
                  {filteredRequests.map((request) => {
                    const statusDetails =
                      requestStatusConfig[request.status];

                    const isExpanded =
                      expandedRequestId === request.id;

                    const rejectionReason =
                      request.status === "rejected"
                        ? request.rejection_reason.trim()
                        : "";

                    return (
                      <article
                        key={request.id}
                        className="rounded-xl border border-orange-100 bg-white p-3.5"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
                          <div className="flex min-w-0 items-start gap-3 xl:flex-1">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100">
                              <Landmark className="h-5 w-5 text-orange-800" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <h3
                                className="line-clamp-2 break-words text-sm font-bold leading-5 text-[#332018] [overflow-wrap:anywhere] sm:text-base"
                                title={request.temple_name}
                              >
                                {request.temple_name}
                              </h3>

                              <p className="mt-1 text-xs text-gray-500">
                                Submitted{" "}
                                {formatSubmittedDate(
                                  request.created_at,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-center">
                              <span
                                className={`inline-flex self-start items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold sm:self-auto ${statusDetails.badgeClass}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${statusDetails.dotClass}`}
                                />
                                {statusDetails.label}
                              </span>

                              <button
                                type="button"
                                aria-expanded={isExpanded}
                                onClick={() =>
                                  setExpandedRequestId(
                                    isExpanded
                                      ? null
                                      : request.id,
                                  )
                                }
                                className="inline-flex w-full items-center justify-center rounded-lg border border-orange-300 px-3 py-2 text-xs font-bold text-orange-800 transition-colors hover:bg-orange-50 sm:w-auto"
                              >
                                {isExpanded
                                  ? "Hide Details"
                                  : "View Details"}
                              </button>
                            </div>

                            {request.status === "rejected" &&
                              request.can_resubmit && (
                                <Link
                                  to={`/temple-request?resubmit=${request.id}`}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-orange-800 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-900 sm:w-auto"
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Correct & Resubmit
                                </Link>
                              )}

                            {request.status === "rejected" &&
                              !request.can_resubmit && (
                                <span className="inline-flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-600 sm:w-auto">
                                  Already Resubmitted
                                </span>
                              )}
                          </div>
                        </div>

                        {request.status === "rejected" && (
                          <div
                            role="note"
                            className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5"
                          >
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />

                            <p className="min-w-0 whitespace-pre-wrap break-words text-xs leading-5 text-red-800">
                              <span className="font-bold">
                                Reason for rejection:
                              </span>{" "}
                              {rejectionReason ||
                                "No rejection reason was provided. Please contact the administrator for more details."}
                            </p>
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-3 grid gap-2 border-t border-orange-100 pt-3 sm:grid-cols-2">
                            <div className="rounded-lg bg-orange-50 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Request ID
                              </p>

                              <p className="mt-1 text-xs font-bold text-[#332018]">
                                #{request.id}
                              </p>
                            </div>

                            <div className="rounded-lg bg-orange-50 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Request Type
                              </p>

                              <p className="mt-1 text-xs font-bold text-[#332018]">
                                {getRequestTypeLabel(
                                  request.request_type,
                                )}
                              </p>
                            </div>

                            <div className="rounded-lg bg-orange-50 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                Current Status
                              </p>

                              <p className="mt-1 text-xs font-bold text-[#332018]">
                                {statusDetails.label}
                              </p>
                            </div>

                            {request.resubmitted_from_id !==
                              null && (
                                <div className="rounded-lg bg-orange-50 p-3">
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                    Resubmitted From
                                  </p>

                                  <p className="mt-1 text-xs font-bold text-[#332018]">
                                    #
                                    {
                                      request.resubmitted_from_id
                                    }
                                  </p>
                                </div>
                              )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
          </div>

          <aside className="rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5 lg:sticky lg:top-24">
            <h2 className="text-lg font-bold text-[#332018]">
              Workspace Overview
            </h2>

            <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-xl border border-orange-100">
              <div className="border-b border-r border-orange-100">
                {renderOverviewMetric(
                  "Approved Temples",
                  isTemplesLoading
                    ? "…"
                    : verifiedTemplesCount,
                  "temple",
                )}
              </div>

              <div className="border-b border-orange-100">
                {renderOverviewMetric(
                  "Pending Requests",
                  isLoading
                    ? "…"
                    : pendingRequestsCount,
                  "pending",
                )}
              </div>

              <div className="border-r border-orange-100">
                {renderOverviewMetric(
                  "Members",
                  membersCount,
                  "members",
                )}
              </div>

              <div>
                {renderOverviewMetric(
                  "Published Updates",
                  publishedUpdatesCount,
                  "updates",
                )}
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Your workspace activity at a glance.
            </p>
          </aside>
        </section>
      )}

      {isTempleMember && (
        <section className="mt-6 rounded-2xl border border-orange-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-800">
              <ShieldCheck className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-[#332018]">
                Workspace Access
              </h2>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
                Your access is limited to assigned temples and the
                features permitted by your membership role.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-orange-50 p-4">
              <Landmark className="h-5 w-5 text-orange-800" />
              <p className="mt-3 text-xs font-medium text-gray-500">
                Assigned Temples
              </p>
              <p className="mt-1 text-xl font-bold text-[#332018]">
                {isTemplesLoading ? "…" : temples.length}
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <Bell className="h-5 w-5 text-orange-800" />
              <p className="mt-3 text-xs font-medium text-gray-500">
                Announcements
              </p>
              <p className="mt-1 text-sm font-bold text-[#332018]">
                Role based
              </p>
            </div>

            <div className="rounded-xl bg-orange-50 p-4">
              <Users className="h-5 w-5 text-orange-800" />
              <p className="mt-3 text-xs font-medium text-gray-500">
                Membership
              </p>
              <p className="mt-1 text-sm font-bold text-[#332018]">
                Active
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}


export default TempleAdminDashboard;
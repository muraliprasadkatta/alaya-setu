import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
  NavLink,
  Outlet,
  useParams,
} from "react-router";
import {
  AlertCircle,
  CircleCheckBig,
  Landmark,
  MapPin,
  Pencil,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import { apiFetch } from "../services/apiFetch";


export type MembershipRole = "owner" | "manager" | "editor";

export type VerifiedEditStatus =
  | "access_pending"
  | "edit_allowed"
  | "changes_pending"
  | "approved"
  | "rejected";

export type VerifiedEditRejectedStage =
  | ""
  | "access_request"
  | "submitted_changes";

export type VerifiedEditChangedValue =
  | string
  | number
  | null;

export type VerifiedEditChangedField = {
  old: VerifiedEditChangedValue;
  new: VerifiedEditChangedValue;
};

export type TempleVerifiedEditRequestData = {
  id: number;
  request_reason: string;
  status: VerifiedEditStatus;
  status_display: string;

  original_name: string;
  original_pincode: string;
  original_city: string;
  original_district: string;
  original_state: string;
  original_pincode_location: number | null;

  proposed_name: string;
  proposed_pincode: string;
  proposed_city: string;
  proposed_district: string;
  proposed_state: string;
  proposed_pincode_location: number | null;

  rejected_stage: VerifiedEditRejectedStage;
  rejected_stage_display: string;
  rejection_reason: string;

  access_reviewed_at: string | null;
  submitted_at: string | null;
  final_reviewed_at: string | null;
  created_at: string;
  updated_at: string;

  can_submit_changes: boolean;

  changed_fields: Record<
    string,
    VerifiedEditChangedField
  >;
};

export type TempleManagementData = {
  id: number;
  name: string;
  description: string;
  main_deity: string;
  image: string | null;
  address: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  latitude: string | null;
  longitude: string | null;
  opening_time: string | null;
  closing_time: string | null;
  is_verified: boolean;
  membership_role: MembershipRole;
  member_count: number;
  announcement_count: number;
  event_count: number;

  verified_edit_request:
    | TempleVerifiedEditRequestData
    | null;

  can_request_verified_edit: boolean;
  can_edit_verified_details: boolean;

  created_at: string;
  updated_at: string;
};

type TempleManagementResponse = {
  success: boolean;
  temple?: TempleManagementData;
  message?: string;
};

export type ManageTempleOutletContext = {
  temple: TempleManagementData;
  reloadTemple: () => Promise<void>;
};

type ManagementTab = {
  label: string;
  path: string;
  end?: boolean;
};


const TEMPLE_MANAGEMENT_URL =
  "http://127.0.0.1:8000/api/temples";

const managementTabs: ManagementTab[] = [
  {
    label: "Overview",
    path: "",
    end: true,
  },
  {
    label: "Members",
    path: "members",
  },
  {
    label: "Announcements",
    path: "announcements",
  },
  {
    label: "Events",
    path: "events",
  },
  {
    label: "Settings",
    path: "settings",
  },
];


function getMembershipRoleLabel(role: MembershipRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}


function getTempleLocation(temple: TempleManagementData) {
  const location = [
    temple.city,
    temple.district,
    temple.state,
  ]
    .filter(Boolean)
    .join(", ");

  if (!location) {
    return temple.pincode || "Location not available";
  }

  if (!temple.pincode) {
    return location;
  }

  return `${location} - ${temple.pincode}`;
}


function hasActiveSettingsRequest(
  status: VerifiedEditStatus | undefined,
) {
  return (
    status === "access_pending" ||
    status === "edit_allowed" ||
    status === "changes_pending" ||
    status === "rejected"
  );
}


function ManageTemple() {
  const { templeId } = useParams<{
    templeId: string;
  }>();

  const [temple, setTemple] =
    useState<TempleManagementData | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");


  const loadTemple = useCallback(
    async (signal?: AbortSignal) => {
      const parsedTempleId = Number(templeId);

      if (
        !templeId ||
        !Number.isInteger(parsedTempleId) ||
        parsedTempleId <= 0
      ) {
        setTemple(null);
        setErrorMessage("Valid temple details dorakaledhu.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");

      try {
        const response = await apiFetch(
          `${TEMPLE_MANAGEMENT_URL}/${parsedTempleId}/manage/`,
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
          .catch(() => null)) as
          | TempleManagementResponse
          | null;

        if (
          !response.ok ||
          !data?.success ||
          !data.temple
        ) {
          throw new Error(
            data?.message ||
              "Temple management details load avvaledhu.",
          );
        }

        setTemple(data.temple);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        setTemple(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Temple management details load avvaledhu.",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [templeId],
  );


  useEffect(() => {
    const controller = new AbortController();

    void loadTemple(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadTemple]);


  if (isLoading) {
    return (
      <div
        aria-live="polite"
        className="space-y-4"
      >
        <div className="h-6 w-36 animate-pulse rounded-md bg-orange-100" />

        <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-20 w-20 shrink-0 rounded-2xl bg-orange-100" />

            <div className="flex-1">
              <div className="h-6 w-60 max-w-full rounded bg-orange-100" />
              <div className="mt-3 h-4 w-40 rounded bg-gray-100" />
              <div className="mt-3 h-4 w-72 max-w-full rounded bg-gray-100" />
            </div>
          </div>
        </div>

        <div className="h-14 animate-pulse rounded-2xl border border-gray-200 bg-white shadow-sm" />
      </div>
    );
  }


  if (errorMessage || !temple) {
    return (
      <div>
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />

            <div>
              <h1 className="text-lg font-bold text-red-900">
                Temple details unavailable
              </h1>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {errorMessage ||
                  "Temple details load avvaledhu."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadTemple()}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
            {temple.image ? (
              <img
                src={temple.image}
                alt={temple.name}
                className="h-24 w-full rounded-2xl object-cover sm:h-20 sm:w-20 sm:shrink-0"
              />
            ) : (
              <div className="flex h-24 w-full items-center justify-center rounded-2xl bg-orange-100 sm:h-20 sm:w-20 sm:shrink-0">
                <Landmark className="h-10 w-10 text-orange-800" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-[#332018]">
                  {temple.name}
                </h1>

                {temple.is_verified && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold text-green-700">
                    <CircleCheckBig className="h-3.5 w-3.5" />
                    Verified
                  </span>
                )}

                <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {getMembershipRoleLabel(
                    temple.membership_role,
                  )}
                </span>
              </div>

              <p className="mt-1 text-sm font-medium text-gray-700">
                {temple.main_deity ||
                  "Main deity not added"}
              </p>

              <p className="mt-2 flex items-start gap-2 text-sm leading-5 text-gray-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" />
                <span>{getTempleLocation(temple)}</span>
              </p>
            </div>
          </div>

          {temple.membership_role === "owner" && (
            <Link
              to="settings"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-800 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-orange-900 sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              Edit Temple
            </Link>
          )}
        </div>
      </section>


      <nav
        aria-label="Temple management sections"
        className="overflow-x-auto rounded-2xl border border-gray-200 bg-white px-2 shadow-sm"
      >
        <div className="flex min-w-max items-center gap-1">
          {managementTabs.map((tab) => {
            const settingsNeedsAttention =
              hasActiveSettingsRequest(
                temple.verified_edit_request?.status,
              );

            const label =
              tab.label === "Members"
                ? `${tab.label} (${temple.member_count ?? 0})`
                : tab.label === "Announcements"
                  ? `${tab.label} (${temple.announcement_count ?? 0})`
                  : tab.label === "Events"
                    ? `${tab.label} (${temple.event_count ?? 0})`
                    : tab.label === "Settings" &&
                        settingsNeedsAttention
                      ? `${tab.label} (1)`
                      : tab.label;

            return (
              <NavLink
                key={tab.label}
                to={tab.path}
                end={tab.end}
                className={({ isActive }) =>
                  `relative px-5 py-3.5 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-orange-800 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-orange-700"
                      : "text-gray-600 hover:bg-orange-50 hover:text-orange-900"
                  }`
                }
              >
                {label}
              </NavLink>
            );
          })}
        </div>
      </nav>


      <Outlet
        context={{
          temple,
          reloadTemple: async () => {
            await loadTemple();
          },
        } satisfies ManageTempleOutletContext}
      />
    </div>
  );
}


export default ManageTemple;  
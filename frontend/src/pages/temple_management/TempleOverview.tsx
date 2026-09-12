import { Link, useOutletContext } from "react-router";
import {
  Clock3,
  FileText,
  Globe2,
  Landmark,
  MapPin,
  PlusCircle,
  Users,
} from "lucide-react";

import type {
  ManageTempleOutletContext,
  TempleManagementData,
} from "../ManageTemple";


function formatTime(value: string | null) {
  if (!value) {
    return null;
  }

  const [hoursText, minutesText] = value.split(":");

  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${String(minutes).padStart(
    2,
    "0",
  )} ${suffix}`;
}


function getTempleHours(temple: TempleManagementData) {
  const openingTime = formatTime(temple.opening_time);
  const closingTime = formatTime(temple.closing_time);

  if (openingTime && closingTime) {
    return `${openingTime} - ${closingTime}`;
  }

  if (openingTime) {
    return `Opens at ${openingTime}`;
  }

  if (closingTime) {
    return `Closes at ${closingTime}`;
  }

  return "Not configured";
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


function TempleOverview() {
  const { temple } =
    useOutletContext<ManageTempleOutletContext>();

  const templeHours = getTempleHours(temple);

  const canManageMembers =
    temple.membership_role === "owner";

  return (
    <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.85fr)]">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#332018]">
          Temple Information
        </h2>

        <div className="mt-3 divide-y divide-gray-100">
          <div className="grid gap-3 py-4 sm:grid-cols-[40px_120px_minmax(0,1fr)] sm:items-start">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <FileText className="h-4.5 w-4.5" />
            </div>

            <p className="text-sm font-semibold text-gray-700 sm:pt-2">
              Description
            </p>

            <p className="whitespace-pre-line text-sm leading-6 text-gray-600 sm:pt-1.5">
              {temple.description ||
                "Temple description not added."}
            </p>
          </div>

          <div className="grid gap-3 py-4 sm:grid-cols-[40px_120px_minmax(0,1fr)] sm:items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <Landmark className="h-4.5 w-4.5" />
            </div>

            <p className="text-sm font-semibold text-gray-700">
              Main Deity
            </p>

            <p className="text-sm leading-6 text-gray-600">
              {temple.main_deity || "Not added"}
            </p>
          </div>

          <div className="grid gap-3 py-4 sm:grid-cols-[40px_120px_minmax(0,1fr)] sm:items-start">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <MapPin className="h-4.5 w-4.5" />
            </div>

            <p className="text-sm font-semibold text-gray-700 sm:pt-2">
              Full Address
            </p>

            <p className="text-sm leading-6 text-gray-600 sm:pt-1.5">
              {temple.address ||
                "Address not available"}
            </p>
          </div>

          <div className="grid gap-3 py-4 sm:grid-cols-[40px_120px_minmax(0,1fr)] sm:items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <Globe2 className="h-4.5 w-4.5" />
            </div>

            <p className="text-sm font-semibold text-gray-700">
              Location
            </p>

            <p className="text-sm leading-6 text-gray-600">
              {getTempleLocation(temple)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <Clock3 className="h-5 w-5" />
            </div>

            <h2 className="text-lg font-bold text-[#332018]">
              Temple Hours
            </h2>
          </div>

          <p className="mt-4 text-sm font-medium text-gray-600">
            {templeHours}
          </p>

          <button
            type="button"
            disabled
            title="Temple hours editing will be connected later"
            className="mt-4 inline-flex cursor-not-allowed items-center gap-2 text-sm font-bold text-orange-800 opacity-70"
          >
            <PlusCircle className="h-4 w-4" />

            {templeHours === "Not configured"
              ? "Add hours"
              : "Edit hours"}
          </button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-700">
              <Users className="h-5 w-5" />
            </div>

            <h2 className="text-lg font-bold text-[#332018]">
              Team Access
            </h2>
          </div>

          <p className="mt-4 text-sm font-medium text-gray-600">
            {temple.member_count} member
            {temple.member_count === 1 ? "" : "s"}
          </p>

          {canManageMembers ? (
            <Link
              to="members"
              className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-800 transition hover:text-orange-950"
            >
              <Users className="h-4 w-4" />
              Manage members
            </Link>
          ) : (
            <span
              title="Only the temple owner can manage members"
              className="mt-4 inline-flex cursor-not-allowed items-center gap-2 text-sm font-bold text-gray-400"
            >
              <Users className="h-4 w-4" />
              Manage members
            </span>
          )}
        </div>
      </div>
    </section>
  );
}


export default TempleOverview;
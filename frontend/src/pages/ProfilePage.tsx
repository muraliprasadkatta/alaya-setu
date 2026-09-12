import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  CalendarDays,
  CircleAlert,
  LoaderCircle,
  Mail,
  Phone,
  RotateCcw,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { Link } from "react-router";

import {
  getUserProfile,
  ProfileApiError,
  updateUserProfile,
} from "../features/profile/profileApi";

import type {
  ProfileFieldErrors,
  UserProfile,
  UserProfileUpdatePayload,
} from "../features/profile/types";


const emptyForm: UserProfileUpdatePayload = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
};


function isAbortError(error: unknown) {
  return (
    error instanceof DOMException &&
    error.name === "AbortError"
  );
}


function createProfileForm(
  profile: UserProfile,
): UserProfileUpdatePayload {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    email: profile.email,
    phone_number:
      profile.phone_number || "",
  };
}


function getProfileInitials(
  profile: UserProfile,
) {
  const initials = [
    profile.first_name,
    profile.last_name,
  ]
    .filter(Boolean)
    .map((value) => value.charAt(0))
    .join("")
    .toUpperCase();

  return (
    initials ||
    profile.username
      .slice(0, 2)
      .toUpperCase()
  );
}


function formatJoinedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}


function updateStoredUser(
  profile: UserProfile,
) {
  let currentUser: Record<string, unknown> = {};

  try {
    const storedValue =
      localStorage.getItem("user");

    if (storedValue) {
      currentUser = JSON.parse(
        storedValue,
      ) as Record<string, unknown>;
    }
  } catch {
    currentUser = {};
  }

  localStorage.setItem(
    "user",
    JSON.stringify({
      ...currentUser,
      id: profile.id,
      username: profile.username,
      email: profile.email,
      full_name: profile.full_name,
      phone_number: profile.phone_number,
      role: profile.role,
    }),
  );

  window.dispatchEvent(
    new CustomEvent(
      "aalaya-setu:profile-updated",
      {
        detail: profile,
      },
    ),
  );
}


function getFieldError(
  errors: ProfileFieldErrors,
  field: keyof UserProfileUpdatePayload,
) {
  return errors[field]?.[0] || "";
}


function ProfilePage() {
  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [formData, setFormData] =
    useState<UserProfileUpdatePayload>(
      emptyForm,
    );

  const [fieldErrors, setFieldErrors] =
    useState<ProfileFieldErrors>({});

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [saveError, setSaveError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");


  const loadProfile = async (
    signal?: AbortSignal,
  ) => {
    setIsLoading(true);
    setLoadError("");

    try {
      const profileData =
        await getUserProfile(signal);

      setProfile(profileData);
      setFormData(
        createProfileForm(profileData),
      );
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      setLoadError(
        error instanceof Error
          ? error.message
          : "Profile details load avvaledhu.",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  };


  useEffect(() => {
    const controller =
      new AbortController();

    void loadProfile(
      controller.signal,
    );

    return () => {
      controller.abort();
    };
  }, []);


  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        setSuccessMessage("");
      },
      4_000,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [successMessage]);


  const hasChanges = useMemo(() => {
    if (!profile) {
      return false;
    }

    const originalForm =
      createProfileForm(profile);

    return (
      formData.first_name !==
        originalForm.first_name ||
      formData.last_name !==
        originalForm.last_name ||
      formData.email !==
        originalForm.email ||
      formData.phone_number !==
        originalForm.phone_number
    );
  }, [formData, profile]);


  const handleFieldChange = (
    field: keyof UserProfileUpdatePayload,
    value: string,
  ) => {
    setFormData(
      (currentForm) => ({
        ...currentForm,
        [field]: value,
      }),
    );

    setFieldErrors(
      (currentErrors) => ({
        ...currentErrors,
        [field]: undefined,
      }),
    );

    setSaveError("");
    setSuccessMessage("");
  };


  const handleReset = () => {
    if (!profile) {
      return;
    }

    setFormData(
      createProfileForm(profile),
    );

    setFieldErrors({});
    setSaveError("");
    setSuccessMessage("");
  };


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !profile ||
      !hasChanges ||
      isSaving
    ) {
      return;
    }

    setIsSaving(true);
    setFieldErrors({});
    setSaveError("");
    setSuccessMessage("");

    try {
      const result =
        await updateUserProfile(
          formData,
        );

      setProfile(result.profile);
      setFormData(
        createProfileForm(
          result.profile,
        ),
      );

      updateStoredUser(result.profile);

      setSuccessMessage(
        result.message ||
          "Profile updated successfully.",
      );
    } catch (error) {
      if (error instanceof ProfileApiError) {
        setFieldErrors(
          error.fieldErrors,
        );

        setSaveError(error.message);
      } else {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Profile update avvaledhu.",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };


  if (isLoading) {
    return (
      <section className="flex min-h-96 items-center justify-center rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="text-center">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-orange-700" />

          <p className="mt-3 text-sm font-medium text-gray-600">
            Loading your profile...
          </p>
        </div>
      </section>
    );
  }


  if (!profile || loadError) {
    return (
      <section className="flex min-h-96 flex-col items-center justify-center rounded-3xl border border-orange-100 bg-white px-5 text-center shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-700">
          <CircleAlert className="h-6 w-6" />
        </span>

        <h1 className="mt-4 text-xl font-bold text-gray-950">
          Profile unavailable
        </h1>

        <p className="mt-2 max-w-md text-sm leading-6 text-gray-600">
          {loadError ||
            "Profile details load avvaledhu."}
        </p>

        <button
          type="button"
          onClick={() => {
            void loadProfile();
          }}
          className="mt-5 rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-900"
        >
          Try again
        </button>
      </section>
    );
  }


  const initials =
    getProfileInitials(profile);

  const inputClass =
    "mt-2 w-full rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-sm text-gray-950 outline-none transition placeholder:text-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100";

  const errorInputClass =
    "border-red-300 focus:border-red-500 focus:ring-red-100";


  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/temple-admin-dashboard"
            aria-label="Back to Dashboard"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-900 transition hover:bg-orange-50"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-700">
              Account
            </p>

            <h1 className="mt-1 text-2xl font-bold text-gray-950">
              My Profile
            </h1>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p>{successMessage}</p>

          <button
            type="button"
            onClick={() =>
              setSuccessMessage("")
            }
            aria-label="Close success message"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border-b border-orange-100 bg-orange-50/60 p-6 lg:border-b-0 lg:border-r">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-orange-800 text-2xl font-bold text-white shadow-sm">
              {initials}
            </div>

            <h2 className="mt-5 text-xl font-bold text-gray-950">
              {profile.full_name}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              @{profile.username}
            </p>

            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-semibold text-orange-800">
              <ShieldCheck className="h-4 w-4" />
              {profile.role_display}
            </span>

            <div className="mt-6 border-t border-orange-100 pt-5">
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" />

                <div>
                  <p className="font-medium text-gray-900">
                    Member since
                  </p>

                  <p className="mt-1">
                    {formatJoinedDate(
                      profile.date_joined,
                    )}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <form
            onSubmit={handleSubmit}
            className="p-5 sm:p-7"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-800">
                <UserRound className="h-5 w-5" />
              </span>

              <div>
                <h2 className="text-lg font-bold text-gray-950">
                  Personal information
                </h2>

                <p className="mt-0.5 text-sm text-gray-500">
                  Update your account details.
                </p>
              </div>
            </div>

            {saveError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-800">
                First name

                <input
                  type="text"
                  value={formData.first_name}
                  onChange={(event) =>
                    handleFieldChange(
                      "first_name",
                      event.target.value,
                    )
                  }
                  autoComplete="given-name"
                  required
                  className={`${inputClass} ${
                    getFieldError(
                      fieldErrors,
                      "first_name",
                    )
                      ? errorInputClass
                      : ""
                  }`}
                />

                {getFieldError(
                  fieldErrors,
                  "first_name",
                ) && (
                  <span className="mt-1.5 block text-xs font-medium text-red-600">
                    {getFieldError(
                      fieldErrors,
                      "first_name",
                    )}
                  </span>
                )}
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Last name

                <input
                  type="text"
                  value={formData.last_name}
                  onChange={(event) =>
                    handleFieldChange(
                      "last_name",
                      event.target.value,
                    )
                  }
                  autoComplete="family-name"
                  className={`${inputClass} ${
                    getFieldError(
                      fieldErrors,
                      "last_name",
                    )
                      ? errorInputClass
                      : ""
                  }`}
                />
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Email address

                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      handleFieldChange(
                        "email",
                        event.target.value,
                      )
                    }
                    autoComplete="email"
                    className={`${inputClass} mt-0 pl-10 ${
                      getFieldError(
                        fieldErrors,
                        "email",
                      )
                        ? errorInputClass
                        : ""
                    }`}
                  />
                </div>

                {getFieldError(
                  fieldErrors,
                  "email",
                ) && (
                  <span className="mt-1.5 block text-xs font-medium text-red-600">
                    {getFieldError(
                      fieldErrors,
                      "email",
                    )}
                  </span>
                )}
              </label>

              <label className="text-sm font-semibold text-gray-800">
                Mobile number

                <div className="relative mt-2">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone_number}
                    onChange={(event) =>
                      handleFieldChange(
                        "phone_number",
                        event.target.value.replace(
                          /\D/g,
                          "",
                        ),
                      )
                    }
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    className={`${inputClass} mt-0 pl-10 ${
                      getFieldError(
                        fieldErrors,
                        "phone_number",
                      )
                        ? errorInputClass
                        : ""
                    }`}
                  />
                </div>

                {getFieldError(
                  fieldErrors,
                  "phone_number",
                ) && (
                  <span className="mt-1.5 block text-xs font-medium text-red-600">
                    {getFieldError(
                      fieldErrors,
                      "phone_number",
                    )}
                  </span>
                )}
              </label>
            </div>

            <div className="mt-6 grid gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Username
                </p>

                <p className="mt-1.5 text-sm font-semibold text-gray-900">
                  @{profile.username}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Account role
                </p>

                <p className="mt-1.5 text-sm font-semibold text-gray-900">
                  {profile.role_display}
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-gray-500">
              Username and account role cannot be
              changed from your profile.
            </p>

            <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={handleReset}
                disabled={
                  !hasChanges ||
                  isSaving
                }
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </button>

              <button
                type="submit"
                disabled={
                  !hasChanges ||
                  isSaving
                }
                className="inline-flex items-center gap-2 rounded-xl bg-orange-800 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {isSaving
                  ? "Saving..."
                  : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}


export default ProfilePage;
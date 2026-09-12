import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router";

import {
  clearAuthSession,
} from "../../services/apiFetch";

import {
  getUserProfile,
} from "./profileApi";

import type {
  UserProfile,
} from "./types";


type ProfileSummary = {
  username: string;
  fullName: string;
  role: string;
  roleDisplay: string;
};


const roleLabels: Record<string, string> = {
  devotee: "Devotee",
  pending_temple_admin:
    "Pending Temple Admin",
  temple_admin: "Temple Admin",
  temple_member: "Temple Member",
  super_admin: "Super Admin",
};


function createSummaryFromProfile(
  profile: UserProfile,
): ProfileSummary {
  return {
    username: profile.username,
    fullName:
      profile.full_name ||
      profile.username,
    role: profile.role,
    roleDisplay:
      profile.role_display ||
      roleLabels[profile.role] ||
      profile.role,
  };
}


function getStoredProfileSummary():
  | ProfileSummary
  | null {
  try {
    const storedUser =
      localStorage.getItem("user");

    if (!storedUser) {
      return null;
    }

    const user = JSON.parse(
      storedUser,
    ) as {
      username?: string;
      full_name?: string;
      role?: string;
    };

    if (!user.username) {
      return null;
    }

    const role = user.role || "";

    return {
      username: user.username,
      fullName:
        user.full_name ||
        user.username,
      role,
      roleDisplay:
        roleLabels[role] ||
        role ||
        "Account",
    };
  } catch {
    return null;
  }
}


function getInitials(
  profile: ProfileSummary | null,
) {
  if (!profile) {
    return "U";
  }

  const initials = profile.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) =>
      namePart.charAt(0),
    )
    .join("")
    .toUpperCase();

  return (
    initials ||
    profile.username
      .slice(0, 2)
      .toUpperCase()
  );
}


function ProfileMenu() {
  const navigate = useNavigate();
  const location = useLocation();

  const menuRef =
    useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] =
    useState(false);

  const [profile, setProfile] =
    useState<ProfileSummary | null>(
      getStoredProfileSummary,
    );


  useEffect(() => {
    const controller =
      new AbortController();

    void getUserProfile(
      controller.signal,
    )
      .then((profileData) => {
        setProfile(
          createSummaryFromProfile(
            profileData,
          ),
        );
      })
      .catch((error: unknown) => {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        // Stored login data remains as fallback.
      });

    return () => {
      controller.abort();
    };
  }, []);


  useEffect(() => {
    const handleProfileUpdated = (
      event: Event,
    ) => {
      const customEvent =
        event as CustomEvent<UserProfile>;

      if (!customEvent.detail) {
        return;
      }

      setProfile(
        createSummaryFromProfile(
          customEvent.detail,
        ),
      );
    };

    window.addEventListener(
      "aalaya-setu:profile-updated",
      handleProfileUpdated,
    );

    return () => {
      window.removeEventListener(
        "aalaya-setu:profile-updated",
        handleProfileUpdated,
      );
    };
  }, []);


  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);


  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (
      event: MouseEvent,
    ) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );

      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [isOpen]);


  const handleLogout = () => {
    setIsOpen(false);
    clearAuthSession();

    navigate(
      "/temple-admin-login",
      {
        replace: true,
      },
    );
  };


  const initials =
    getInitials(profile);

  const fullName =
    profile?.fullName ||
    profile?.username ||
    "Profile";

  const shortName =
    fullName.split(/\s+/)[0];


  return (
    <div
      ref={menuRef}
      className="relative"
    >
      <button
        type="button"
        onClick={() =>
          setIsOpen(
            (currentValue) =>
              !currentValue,
          )
        }
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex h-10 items-center gap-2 rounded-full border border-orange-200 bg-white p-1.5 text-orange-900 shadow-sm transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2 sm:pr-3"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-800 text-[11px] font-bold text-white">
          {initials}
        </span>

        <span className="hidden max-w-28 truncate text-sm font-semibold sm:block">
          {shortName}
        </span>

        <ChevronDown
          className={`hidden h-4 w-4 transition sm:block ${
            isOpen
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-12 z-[65] w-72 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl"
        >
          <div className="border-b border-gray-100 bg-orange-50/60 px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-800 text-sm font-bold text-white">
                {initials}
              </span>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-gray-950">
                  {fullName}
                </p>

                <p className="mt-0.5 truncate text-xs text-gray-500">
                  @{profile?.username ||
                    "account"}
                </p>
              </div>
            </div>

            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-orange-800">
              <ShieldCheck className="h-3.5 w-3.5" />

              {profile?.roleDisplay ||
                "Account"}
            </span>
          </div>

          <div className="p-2">
            <Link
              to="/profile"
              role="menuitem"
              onClick={() =>
                setIsOpen(false)
              }
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-orange-50 hover:text-orange-900"
            >
              <UserRound className="h-4.5 w-4.5" />
              My Profile
            </Link>

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              <LogOut className="h-4.5 w-4.5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


export default ProfileMenu;
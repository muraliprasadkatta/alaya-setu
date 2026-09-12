import { useState } from "react";
import {
  ArrowLeft,
  Landmark,
  LayoutDashboard,
  Menu,
  PlusCircle,
  X,
} from "lucide-react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";

import NotificationBell from "../../features/notifications/NotificationBell";
import ProfileMenu from "../../features/profile/ProfileMenu";


type StoredUser = {
  role?: string;
};


const navigationItems = [
  {
    label: "Dashboard",
    to: "/temple-admin-dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Add Temple",
    to: "/temple-request",
    icon: PlusCircle,
  },
];


const getStoredUserRole = () => {
  try {
    const storedUser = localStorage.getItem("user");

    if (!storedUser) {
      return "";
    }

    const user = JSON.parse(storedUser) as StoredUser;

    return user.role ?? "";
  } catch {
    return "";
  }
};


function TempleAdminDashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isMobileMenuOpen, setIsMobileMenuOpen] =
    useState(false);

  const [userRole] = useState(getStoredUserRole);

  const isTempleMember =
    userRole === "temple_member";

  const visibleNavigationItems =
    navigationItems.filter(
      ({ to }) =>
        !(
          isTempleMember &&
          to === "/temple-request"
        ),
    );

  const isTempleManagementPage =
    /^\/temples\/\d+\/manage(?:\/.*)?$/.test(
      location.pathname,
    );

  const handleBackToDashboard = () => {
    setIsMobileMenuOpen(false);

    navigate("/temple-admin-dashboard");
  };

  const desktopLinkClass = (isActive: boolean) =>
    isActive
      ? "inline-flex items-center gap-2 rounded-lg bg-orange-100 px-3 py-2 font-semibold text-orange-900"
      : "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-gray-600 transition hover:bg-orange-50 hover:text-orange-900";

  const mobileLinkClass = (isActive: boolean) =>
    isActive
      ? "flex items-center gap-3 rounded-xl bg-orange-100 px-4 py-3 font-semibold text-orange-900"
      : "flex items-center gap-3 rounded-xl px-4 py-3 text-gray-700 transition hover:bg-orange-50 hover:text-orange-900";

  return (
    <div className="min-h-screen bg-orange-50 text-gray-950">
      <header className="sticky top-0 z-50 border-b border-orange-100 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-1 sm:gap-2">
            {isTempleManagementPage && (
              <button
                type="button"
                onClick={handleBackToDashboard}
                aria-label="Back to Dashboard"
                title="Back to Dashboard"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-orange-900 transition hover:bg-orange-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 focus-visible:ring-offset-2"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}

            <Link
              to="/temple-admin-dashboard"
              className="flex min-w-0 items-center gap-2"
              onClick={() =>
                setIsMobileMenuOpen(false)
              }
            >
              <Landmark className="h-6 w-6 shrink-0 text-orange-800" />

              <span className="truncate whitespace-nowrap text-base font-bold text-orange-900 sm:text-lg">
                Aalaya Setu
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-1 text-sm md:flex">
            {visibleNavigationItems.map(
              ({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={
                    to ===
                    "/temple-admin-dashboard"
                  }
                  className={({ isActive }) =>
                    desktopLinkClass(isActive)
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              ),
            )}
          </nav>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell />

            <ProfileMenu />

            <button
              type="button"
              onClick={() =>
                setIsMobileMenuOpen(
                  (current) => !current,
                )
              }
              className="flex h-9 w-9 items-center justify-center rounded-full border border-orange-200 bg-white text-orange-900 shadow-sm md:hidden"
              aria-label={
                isMobileMenuOpen
                  ? "Close menu"
                  : "Open menu"
              }
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <nav className="border-t border-orange-100 bg-white px-4 py-3 shadow-sm md:hidden">
            <div className="mx-auto max-w-6xl space-y-1">
              {visibleNavigationItems.map(
                ({ label, to, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={
                      to ===
                      "/temple-admin-dashboard"
                    }
                    className={({ isActive }) =>
                      mobileLinkClass(isActive)
                    }
                    onClick={() =>
                      setIsMobileMenuOpen(false)
                    }
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </NavLink>
                ),
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}


export default TempleAdminDashboardLayout;
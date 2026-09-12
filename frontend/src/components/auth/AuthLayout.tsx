import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Landmark, ShieldCheck, Bell, Users } from "lucide-react";

type AuthLayoutProps = {
  activePage: "login" | "register";
  cardTitle: string;
  cardDescription: string;
  cardIcon: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
  cardSize?: "sm" | "lg";
};

function AuthLayout({
  activePage,
  cardTitle,
  cardDescription,
  cardIcon: CardIcon,
  children,
  footer,
  cardSize = "lg",
}: AuthLayoutProps) {
  const mobileAction =
    activePage === "register"
      ? { label: "Login", to: "/temple-admin-login" }
      : { label: "Register", to: "/admin-register" };

  const gridClass =
    cardSize === "sm"
      ? "md:grid-cols-[1fr_430px]"
      : "md:grid-cols-[1fr_520px]";

  /*
    Mobile compact:
    - px/py reduced for small screens
    - md values keep desktop/window view same
  */
  const cardPadding =
    cardSize === "sm"
      ? "px-4 py-5 sm:px-5 sm:py-6 md:px-8 md:py-8"
      : "px-4 py-5 sm:px-5 sm:py-6 md:px-9 md:py-7";

  return (
    <div className="relative min-h-screen overflow-x-clip text-gray-950">
      {/* Fixed background layer */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-left-top bg-no-repeat"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(255,247,237,0.2), rgba(255,255,255,0.9) 58%), url('/images/auth/temple-register-bg.webp')",
        }}
      />

      {/* Page content layer */}
      <div className="relative z-10 min-h-screen pt-12 md:pt-14">
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-orange-100 bg-white/90 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-3 sm:px-4 md:h-14 md:px-6">
            <Link to="/admin-register" className="flex items-center gap-1.5 md:gap-2">
              <Landmark className="h-5 w-5 text-orange-800 md:h-6 md:w-6" />

              <span className="whitespace-nowrap text-sm font-bold text-orange-900 sm:text-base md:text-lg">
                Aalaya Setu
              </span>
            </Link>

            <div className="hidden items-center gap-7 text-[13px] font-medium text-gray-700 md:flex">
              <Link to="/admin-register">Home</Link>
              <Link to="/about">About</Link>
              <Link to="/temples">Temples</Link>

              <span className="h-5 w-px bg-orange-200" />

              <Link
                to="/temple-admin-login"
                className={
                  activePage === "login"
                    ? "rounded-lg bg-orange-800 px-5 py-2 text-white shadow-sm"
                    : "rounded-lg border border-orange-700 px-5 py-2 text-orange-800"
                }
              >
                Login
              </Link>

              <Link
                to="/admin-register"
                className={
                  activePage === "register"
                    ? "rounded-lg bg-orange-800 px-5 py-2 text-white shadow-sm"
                    : "rounded-lg border border-orange-700 px-5 py-2 text-orange-800"
                }
              >
                Register
              </Link>
            </div>

            <Link
              to={mobileAction.to}
              className="rounded-full border border-orange-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-orange-900 shadow-sm md:hidden"
            >
              {mobileAction.label}
            </Link>
          </div>
        </nav>

        <main
          className={`mx-auto grid max-w-6xl gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5 md:min-h-[calc(100vh-56px)] md:items-center md:gap-12 md:px-6 md:py-6 ${gridClass}`}
        >
          <section className="pt-1 md:pt-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-orange-700 sm:text-[10px] md:text-[11px] md:tracking-[0.16em]">
              Temple management portal
            </p>

            <h2 className="mt-2 max-w-[92vw] text-[clamp(22px,6.8vw,30px)] font-bold leading-[1.08] text-[#332018] sm:max-w-sm md:mt-4 md:max-w-md md:text-[42px] md:leading-[1.12]">
              Manage your temple updates with your own account
            </h2>

            <div className="my-3 h-px w-16 bg-orange-300 md:my-5 md:w-24" />

            <p className="max-w-[92vw] text-[12px] leading-5 text-gray-700 sm:max-w-sm sm:text-[13px] md:max-w-md md:text-[14px] md:leading-6">
              Create your temple management account to submit temple details and
              start managing announcements, festivals, and special updates.
            </p>

            <div className="mt-8 hidden max-w-md grid-cols-3 gap-4 border-t border-orange-100 pt-6 md:grid">
              <div className="flex gap-3">
                <ShieldCheck className="h-8 w-8 shrink-0 rounded-full bg-white p-2 text-orange-800 shadow-sm" />
                <div>
                  <p className="text-xs font-bold">Secure</p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-600">
                    Data is safe
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users className="h-8 w-8 shrink-0 rounded-full bg-white p-2 text-orange-800 shadow-sm" />
                <div>
                  <p className="text-xs font-bold">Easy Access</p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-600">
                    Manage anytime
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Bell className="h-8 w-8 shrink-0 rounded-full bg-white p-2 text-orange-800 shadow-sm" />
                <div>
                  <p className="text-xs font-bold">Updates</p>
                  <p className="mt-1 text-[11px] leading-4 text-gray-600">
                    Stay connected
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            className={`rounded-2xl border border-orange-100 bg-white/95 ${cardPadding} shadow-xl backdrop-blur-md`}
          >
            <div className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 md:h-12 md:w-12">
                <CardIcon className="h-5 w-5 text-orange-800 md:h-6 md:w-6" />
              </div>

              <h3 className="mt-3 text-[18px] font-bold text-[#332018] md:mt-4 md:text-[22px]">
                {cardTitle}
              </h3>

              <div className="mx-auto mt-2 h-px w-16 bg-orange-300 md:mt-3 md:w-24" />

              <p className="mt-2 text-[12px] leading-5 text-gray-500 md:mt-3 md:text-[13px]">
                {cardDescription}
              </p>
            </div>

            {children}

            {footer}
          </section>
        </main>
      </div>
    </div>
  );
}

export default AuthLayout;

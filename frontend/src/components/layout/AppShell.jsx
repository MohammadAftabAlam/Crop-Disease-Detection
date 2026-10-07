import React, { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  BookOpen,
  History,
  House,
  LayoutDashboard,
  LogIn,
  LogOut,
  ScanLine,
  UserPlus,
  UserRound,
} from "lucide-react";
import useAuth from "../../hooks/useAuth";
import usePreferences from "../../hooks/usePreferences";
import { getInitials } from "../../utils/helpers";
import { cx } from "../ui";
import { Backdrop, LanguageToggle, Logo, ThemeToggle } from "./Controls";

const NAV = [
  { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard, auth: true },
  { to: "/detect", label: "nav.scan", icon: ScanLine, auth: true },
  // A single result belongs to the history section
  { to: "/history", label: "nav.history", icon: History, auth: true, also: ["/result"] },
  { to: "/diseases", label: "nav.library", icon: BookOpen },
  { to: "/profile", label: "nav.profile", icon: UserRound, auth: true },
];

const PUBLIC_NAV = [
  { to: "/", label: "nav.home", icon: House },
  { to: "/diseases", label: "nav.library", icon: BookOpen },
  { to: "/login", label: "nav.login", icon: LogIn },
];

const isActive = (item, pathname) =>
  [item.to, ...(item.also || [])].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

function Sidebar({ items, user, onLogout }) {
  const { pathname } = useLocation();
  const { t } = usePreferences();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface/70 px-4 py-6 backdrop-blur-xl lg:flex">
      <div className="px-2">
        <Logo />
      </div>

      <nav className="mt-10 flex flex-col gap-1" aria-label={t("nav.main")}>
        {items.map((item) => {
          const active = isActive(item, pathname);

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/25"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                >
                  <span className="absolute top-1/2 -left-4 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary glow" />
                </motion.span>
              )}
              <item.icon className={cx("relative size-5", active && "text-primary")} />
              <span className="relative">{t(item.label)}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-4">
        <div className="flex items-center justify-between px-1">
          <LanguageToggle layoutId="lang-sidebar" />
          <ThemeToggle />
        </div>

        {user ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 ring-1 ring-inset ring-border">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-fg">
              {getInitials(user.name) || "U"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-fg">{user.name}</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              aria-label={t("nav.logout")}
              title={t("nav.logout")}
              className="grid size-8 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Link
              to="/login"
              className="flex h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-fg glow"
            >
              <LogIn className="size-4" /> {t("nav.login")}
            </Link>
            <Link
              to="/register"
              className="flex h-10 items-center justify-center gap-2 rounded-xl text-sm font-semibold text-muted ring-1 ring-inset ring-border hover:text-fg"
            >
              <UserPlus className="size-4" /> {t("nav.register")}
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}

function MobileTopBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
      <Logo />
      <div className="flex items-center gap-2">
        <LanguageToggle layoutId="lang-mobile" />
        <ThemeToggle />
      </div>
    </header>
  );
}

function MobileTabBar({ items }) {
  const { pathname } = useLocation();
  const { t } = usePreferences();

  return (
    <nav
      aria-label={t("nav.main")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex max-w-md items-end justify-around">
        {items.map((item) => {
          const active = isActive(item, pathname);

          // The scan button stands out in the middle of the bar
          if (item.to === "/detect") {
            return (
              <Link key={item.to} to={item.to} className="-mt-7 flex flex-col items-center gap-1" aria-label={t(item.label)}>
                <span className={cx(
                  "grid size-14 place-items-center rounded-2xl bg-primary text-primary-fg glow transition-transform active:scale-95",
                  active && "ring-4 ring-primary/25"
                )}>
                  <item.icon className="size-6" />
                </span>
                <span className={cx("text-[11px] font-semibold", active ? "text-primary" : "text-muted")}>{t(item.label)}</span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex w-16 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-semibold transition-colors",
                active ? "text-primary" : "text-muted"
              )}
            >
              {active && (
                <motion.span layoutId="tab-active" className="absolute -top-2 h-0.5 w-8 rounded-full bg-primary glow" />
              )}
              <item.icon className="size-5" />
              {t(item.label)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Layout for the app pages: sidebar on desktop, top bar + bottom tabs on phones
function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebarItems = user ? NAV : NAV.filter((item) => !item.auth);
  const tabItems = user ? NAV : PUBLIC_NAV;

  return (
    <div className="relative isolate min-h-screen">
      <Backdrop />

      <Sidebar items={sidebarItems} user={user} onLogout={handleLogout} />
      <MobileTopBar />

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <MobileTabBar items={tabItems} />
    </div>
  );
}

export default AppShell;

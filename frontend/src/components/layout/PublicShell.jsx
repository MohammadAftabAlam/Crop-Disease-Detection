import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LayoutDashboard, LogIn, Menu, X } from "lucide-react";
import useAuth from "../../hooks/useAuth";
import usePreferences from "../../hooks/usePreferences";
import { PROJECT } from "../../content/project";
import { Button, cx } from "../ui";
import { Backdrop, LanguageToggle, Logo, ThemeToggle } from "./Controls";

// Sections of the landing page, plus the public disease library
const LINKS = [
  { to: "/#how", label: "landing.navHow" },
  { to: "/#explain", label: "landing.navExplain" },
  { to: "/#model", label: "landing.navModel" },
  { to: "/#faq", label: "landing.navFaq" },
  { to: "/diseases", label: "nav.library" },
];

function AuthButtons({ className, onNavigate }) {
  const { user } = useAuth();
  const { t } = usePreferences();

  if (user) {
    return (
      <Button as={Link} to="/dashboard" size="sm" icon={LayoutDashboard} onClick={onNavigate} className={className}>
        {t("landing.openApp")}
      </Button>
    );
  }

  return (
    <div className={cx("flex items-center gap-2", className)}>
      <Button as={Link} to="/login" size="sm" variant="ghost" icon={LogIn} onClick={onNavigate}>
        {t("nav.login")}
      </Button>
      <Button as={Link} to="/register" size="sm" onClick={onNavigate}>
        {t("landing.getStarted")}
      </Button>
    </div>
  );
}

function PublicNav() {
  const { t } = usePreferences();
  const { pathname } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cx(
        "sticky top-0 z-40 transition-colors duration-300",
        scrolled || open ? "border-b border-border bg-bg/80 backdrop-blur-xl" : "border-b border-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 lg:flex" aria-label={t("nav.main")}>
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:text-fg"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageToggle layoutId="lang-public" />
          <ThemeToggle />
          <AuthButtons className="ml-2" />
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-label={t(open ? "common.close" : "landing.menu")}
            className="grid size-9 place-items-center rounded-xl text-fg ring-1 ring-inset ring-border"
          >
            {open ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
            aria-label={t("nav.main")}
          >
            <div className="space-y-1 px-4 pt-2 pb-5">
              {LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-2.5 font-semibold text-fg hover:bg-surface-2"
                >
                  {t(link.label)}
                </Link>
              ))}
              <div className="flex items-center justify-between gap-3 pt-4">
                <LanguageToggle layoutId="lang-public-mobile" />
                <AuthButtons onNavigate={() => setOpen(false)} />
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function PublicFooter() {
  const { t } = usePreferences();

  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1.2fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">{t("landing.footerText")}</p>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold tracking-wider text-subtle uppercase">{t("landing.footerExplore")}</p>
          <ul className="space-y-2.5 text-sm">
            {LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-muted transition-colors hover:text-primary">{t(link.label)}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-4 text-xs font-bold tracking-wider text-subtle uppercase">{t("landing.footerProject")}</p>
          <ul className="space-y-2.5 text-sm text-muted">
            <li>{PROJECT.college}</li>
            <li>{PROJECT.department}</li>
            <li>{t("landing.batch", { batch: PROJECT.batch })}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-subtle sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} {PROJECT.name} · {PROJECT.team.join(", ")}</p>
          <p>{t("landing.footerDisclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}

// Layout for the landing page and the 404 page
function PublicShell() {
  const { pathname, hash } = useLocation();

  // React Router does not scroll to #anchors by itself
  useEffect(() => {
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [pathname, hash]);

  return (
    <div className="relative isolate flex min-h-screen flex-col">
      <Backdrop />
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <PublicFooter />
    </div>
  );
}

export default PublicShell;

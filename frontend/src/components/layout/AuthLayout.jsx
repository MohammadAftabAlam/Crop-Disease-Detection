import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CircleHelp, ScanSearch } from "lucide-react";
import usePreferences from "../../hooks/usePreferences";
import { DEMO } from "../../content/demo";
import { Badge } from "../ui";
import { Backdrop, LanguageToggle, Logo, ThemeToggle } from "./Controls";

// Brand panel: the sample photo fading into the model's real heat map
function Showcase() {
  const { t, cropName, diseaseName } = usePreferences();
  const reduceMotion = useReducedMotion();
  const [showHeat, setShowHeat] = useState(true);

  useEffect(() => {
    if (reduceMotion) {
      return undefined;
    }

    const timer = setInterval(() => setShowHeat((current) => !current), 3200);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const top = DEMO.candidates[0];

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-8 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-3 shadow-2xl">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl">
          <img src={DEMO.images.leafSmall} alt={t("landing.demoAlt")} className="absolute inset-0 size-full object-cover" />
          <AnimatePresence>
            {showHeat && (
              <motion.img
                key="heat"
                src={DEMO.images.heatmap}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8 }}
                className="absolute inset-0 size-full object-cover"
              />
            )}
          </AnimatePresence>
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <ScanSearch className="size-3.5" /> {t(showHeat ? "explain.heatmap" : "explain.photo")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3 px-2 pt-4 pb-1">
          <div className="min-w-0">
            <p className="truncate font-bold text-fg">{cropName(top.crop)} – {diseaseName(top.disease)}</p>
            <p className="text-xs text-muted">{t("landing.demoCaption")}</p>
          </div>
          <Badge tone="warning" icon={CircleHelp}>{t("status.ambiguous.short")}</Badge>
        </div>
      </div>
    </div>
  );
}

// Split screen for sign-in pages: brand panel on large screens, form on the right
function AuthLayout() {
  const { t } = usePreferences();
  const { pathname } = useLocation();

  return (
    <div className="relative isolate min-h-screen">
      <Backdrop />

      <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface/40 p-10 lg:flex">
          <Logo />
          <Showcase />
          <div>
            <p className="text-2xl font-extrabold tracking-tight text-fg">
              {t("auth.sideTitle")} <span className="text-gradient">{t("auth.sideHighlight")}</span>
            </p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{t("auth.sideText")}</p>
          </div>
        </aside>

        <div className="flex min-h-screen flex-col px-4 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="lg:hidden"><Logo /></div>
            <Link to="/" className="hidden items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-fg lg:inline-flex">
              <ArrowLeft className="size-4" /> {t("auth.backHome")}
            </Link>
            <div className="flex items-center gap-2">
              <LanguageToggle layoutId="lang-auth" />
              <ThemeToggle />
            </div>
          </div>

          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="m-auto w-full max-w-md py-10"
          >
            <Outlet />
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default AuthLayout;

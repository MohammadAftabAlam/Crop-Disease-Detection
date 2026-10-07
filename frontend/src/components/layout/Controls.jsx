import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Moon, Sprout, Sun } from "lucide-react";
import usePreferences from "../../hooks/usePreferences";
import { Segmented, cx } from "../ui";

// Logo and the theme / language switches, shared by every layout

export function Logo({ compact = false }) {
  return (
    <Link to="/" className="group flex items-center gap-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 transition-shadow group-hover:glow">
        <Sprout className="size-5" strokeWidth={2.4} />
      </span>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight text-fg">
          CropCare <span className="text-gradient">AI</span>
        </span>
      )}
    </Link>
  );
}

export function ThemeToggle({ className }) {
  const { theme, toggleTheme, t } = usePreferences();
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={t(theme === "dark" ? "prefs.lightMode" : "prefs.darkMode")}
      title={t(theme === "dark" ? "prefs.lightMode" : "prefs.darkMode")}
      className={cx(
        "grid size-9 place-items-center rounded-xl text-muted ring-1 ring-inset ring-border transition-colors hover:bg-surface-2 hover:text-fg",
        className
      )}
    >
      <motion.span key={theme} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
        <Icon className="size-4.5" />
      </motion.span>
    </button>
  );
}

export function LanguageToggle({ layoutId = "lang-toggle" }) {
  const { lang, setLang } = usePreferences();

  return (
    <Segmented
      layoutId={layoutId}
      value={lang}
      onChange={setLang}
      options={[
        { value: "en", label: "EN" },
        { value: "hi", label: "हि" },
      ]}
    />
  );
}

// Faint grid and two slow glows behind every page
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-grid" />
      <motion.div
        className="absolute -top-40 left-1/4 size-[36rem] rounded-full bg-primary/10 blur-3xl"
        animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -top-20 -right-40 size-[28rem] rounded-full bg-info/10 blur-3xl"
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 3 }}
      />
    </div>
  );
}

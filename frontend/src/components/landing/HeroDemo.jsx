import React, { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleHelp, Gauge, LoaderCircle, ScanSearch } from "lucide-react";
import ConfidenceBar from "../ConfidenceBar";
import { Badge, cx } from "../ui";
import usePreferences from "../../hooks/usePreferences";
import { DEMO } from "../../content/demo";

// scan -> heat map -> result, then again. Durations in ms.
const PHASES = [
  { name: "scan", duration: 2600 },
  { name: "heat", duration: 1600 },
  { name: "result", duration: 5200 },
];

// Looping mock scan in the hero, built from the model's real output on a sample photo
function HeroDemo() {
  const { t, cropName } = usePreferences();
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(reduceMotion ? 2 : 0);

  useEffect(() => {
    if (reduceMotion) {
      setPhase(2);
      return undefined;
    }

    const timer = setTimeout(() => setPhase((current) => (current + 1) % PHASES.length), PHASES[phase].duration);
    return () => clearTimeout(timer);
  }, [phase, reduceMotion]);

  const name = PHASES[phase].name;
  const showHeat = name !== "scan";
  const showResult = name === "result";

  return (
    <div className="relative mx-auto mb-24 w-full max-w-xl sm:mb-14 lg:mr-0">
      <div aria-hidden="true" className="absolute -inset-10 rounded-full bg-primary/15 blur-3xl" />

      <div className="relative rounded-3xl border border-border bg-surface/90 p-3 shadow-2xl backdrop-blur">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-surface-2">
          <img src={DEMO.images.leaf} alt={t("landing.demoAlt")} className="absolute inset-0 size-full object-cover" />

          <AnimatePresence>
            {showHeat && (
              <motion.img
                key="heat"
                src={DEMO.images.heatmap}
                alt=""
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0 size-full object-cover"
              />
            )}
          </AnimatePresence>

          {name === "scan" && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-primary/35 to-transparent"
              initial={{ top: "-25%" }}
              animate={{ top: "100%" }}
              transition={{ duration: 2.4, ease: "easeInOut" }}
            >
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary shadow-[0_0_14px_var(--primary)]" />
            </motion.div>
          )}

          {/* Caption inside the photo, where the floating result card never covers it */}
          <span className="absolute right-3 bottom-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            {t("landing.demoBadge")}
          </span>

          {["top-3 left-3 border-t-2 border-l-2", "top-3 right-3 border-t-2 border-r-2", "bottom-3 left-3 border-b-2 border-l-2"].map((corner) => (
            <span key={corner} aria-hidden="true" className={cx("absolute size-6 rounded-sm border-primary", corner)} />
          ))}
        </div>

        <div className="flex items-center gap-3 px-2 pt-3 pb-1 text-sm">
          <span className="flex items-center gap-2 font-semibold text-fg" aria-live="polite">
            {showResult ? (
              <ScanSearch className="size-4 text-primary" />
            ) : (
              <LoaderCircle className="size-4 animate-spin text-primary" />
            )}
            {t(`landing.demo_${name}`)}
          </span>
        </div>
      </div>

      {/* Result card */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", bounce: 0.25, duration: 0.6 }}
            className="absolute inset-x-4 -bottom-24 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur sm:inset-x-auto sm:-bottom-14 sm:-left-8 sm:w-80"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <Badge tone="warning" icon={CircleHelp}>{t("status.ambiguous.label")}</Badge>
              <span className="text-xs text-muted">{t("landing.demoNotSure")}</span>
            </div>
            <div className="space-y-3">
              {DEMO.candidates.map((candidate, index) => (
                <ConfidenceBar
                  key={candidate.crop + candidate.disease}
                  value={candidate.confidence}
                  tone={index === 0 ? "warning" : "neutral"}
                  size="sm"
                  label={`${cropName(candidate.crop)} – ${candidate.disease}`}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Severity chip */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            key="severity"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.25 }}
            className="absolute -top-5 -right-3 hidden items-center gap-2.5 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-xl backdrop-blur sm:flex"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-warning/10 ring-1 ring-warning/25">
              <Gauge className="size-4 text-warning" />
            </span>
            <div>
              <p className="text-xs text-muted">{t("result.severity")}</p>
              <p className="text-sm font-bold text-fg">
                {t(`severity.grade${DEMO.severity.grade}`)} · {DEMO.severity.percent}%
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default HeroDemo;

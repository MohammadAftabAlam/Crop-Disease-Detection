import React, { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Bug,
  CloudSun,
  ExternalLink,
  FlaskConical,
  Leaf,
  ListChecks,
  Microscope,
  ShieldCheck,
  Stethoscope,
  TriangleAlert,
  X,
} from "lucide-react";
import { Alert, Badge } from "./ui";
import usePreferences from "../hooks/usePreferences";
import { pathogenType } from "../utils/prediction";

const DESKTOP = "(min-width: 1024px)";

const useIsDesktop = () => {
  const [matches, setMatches] = useState(() => window.matchMedia(DESKTOP).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP);
    const update = () => setMatches(query.matches);

    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
};

function Section({ icon: Icon, title, items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
        <Icon className="size-4 text-primary" /> {title}
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

// Full library entry: side panel on desktop, bottom sheet on phones
function DiseaseDrawer({ disease, onClose }) {
  const { t, cropName, diseaseName } = usePreferences();
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKey = (event) => event.key === "Escape" && onClose();
    const overflow = document.body.style.overflow;

    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const type = pathogenType(disease.pathogen);
  const healthy = disease.diseaseName?.toLowerCase() === "healthy";
  const chemicals = disease.chemicalControl || [];
  const isDesktop = useIsDesktop();

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="disease-drawer-title">
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      <motion.div
        initial={isDesktop ? { x: "100%" } : { y: "100%" }}
        animate={{ x: 0, y: 0 }}
        exit={isDesktop ? { x: "100%" } : { y: "100%" }}
        transition={{ type: "spring", bounce: 0, duration: 0.45 }}
        className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col rounded-t-3xl border-t border-border bg-surface lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-full lg:max-w-xl lg:rounded-none lg:border-t-0 lg:border-l"
      >
        <span className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-surface-3 lg:hidden" />

        <div className="flex items-start justify-between gap-4 border-b border-border p-6">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge tone="success" icon={Leaf}>{cropName(disease.crop)}</Badge>
              {type && <Badge icon={Microscope}>{t(`library.type.${type}`)}</Badge>}
            </div>
            <h2 id="disease-drawer-title" className="text-2xl font-extrabold tracking-tight text-fg">
              {healthy ? t("library.healthyName", { crop: cropName(disease.crop) }) : diseaseName(disease.diseaseName)}
            </h2>
            {disease.pathogen && <p className="mt-1 text-sm text-muted italic">{disease.pathogen}</p>}
          </div>

          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-muted ring-1 ring-inset ring-border transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="size-4.5" />
          </button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto p-6">
          {disease.description && <p className="leading-relaxed text-fg">{disease.description}</p>}

          {disease.favourableConditions && (
            <Alert tone="info" icon={CloudSun} title={t("library.favourable")}>
              {disease.favourableConditions}
            </Alert>
          )}

          <Section icon={Stethoscope} title={t("library.symptoms")} items={disease.symptoms} />
          <Section icon={Bug} title={t("library.causes")} items={disease.causes} />
          <Section icon={ListChecks} title={t("library.management")} items={disease.remedies} />
          <Section icon={Leaf} title={t("advice.organic")} items={disease.organicControl} />

          {chemicals.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
                <FlaskConical className="size-4 text-primary" /> {t("advice.chemical")}
              </h3>
              <div className="space-y-3">
                {chemicals.map((chemical) => (
                  <div key={chemical.activeIngredient} className="rounded-xl bg-surface-2 p-4 ring-1 ring-inset ring-border">
                    <p className="font-semibold text-fg">{chemical.activeIngredient}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <dt className="text-xs text-subtle">{t("advice.dose")}</dt>
                        <dd className="text-fg">{chemical.dose || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-subtle">{t("advice.waiting")}</dt>
                        <dd className="text-fg">
                          {chemical.waitingPeriodDays != null ? t("advice.days", { n: chemical.waitingPeriodDays }) : "—"}
                        </dd>
                      </div>
                    </dl>
                    {chemical.note && <p className="mt-2 text-xs text-muted">{chemical.note}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!healthy && chemicals.length === 0 && (
            <Alert tone="warning" icon={TriangleAlert} title={t("library.noChemicalTitle")}>
              {t("library.noChemicalText")}
            </Alert>
          )}

          <Section icon={ShieldCheck} title={t("advice.prevention")} items={disease.prevention} />

          {disease.sources?.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-bold text-fg">{t("advice.sources")}</h3>
              <ul className="space-y-2">
                {disease.sources.map((source) => (
                  <li key={source.url + source.title}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-2 text-sm text-muted transition-colors hover:text-primary"
                    >
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0" /> {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default DiseaseDrawer;

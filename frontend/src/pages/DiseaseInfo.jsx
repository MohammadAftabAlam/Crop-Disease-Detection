import React, { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CircleAlert, CloudSun, Leaf, Microscope, Search, SearchX, Stethoscope } from "lucide-react";
import DiseaseDrawer from "../components/DiseaseDrawer";
import { Alert, Badge, Card, EmptyState, PageHeader, Skeleton, cx, fadeUp, stagger } from "../components/ui";
import useDiseases from "../hooks/useDiseases";
import { TranslationNote } from "../components/result/AdviceView";
import usePreferences from "../hooks/usePreferences";
import { pathogenType } from "../utils/prediction";

function DiseaseTile({ disease, onOpen }) {
  const { t, cropName, diseaseName } = usePreferences();
  const healthy = disease.diseaseName?.toLowerCase() === "healthy";
  const type = pathogenType(disease.pathogen);

  return (
    <motion.button
      variants={fadeUp}
      layout
      type="button"
      onClick={onOpen}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface/80 p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_var(--glow)]"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Badge tone={healthy ? "success" : "neutral"} icon={Leaf}>{cropName(disease.crop)}</Badge>
          {type && <Badge icon={Microscope}>{t(`library.type.${type}`)}</Badge>}
        </div>
        <ArrowUpRight className="size-5 shrink-0 text-subtle transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
      </div>

      <h3 className="mt-4 text-lg font-bold text-fg">
        {healthy ? t("library.healthyName", { crop: cropName(disease.crop) }) : diseaseName(disease.diseaseName)}
      </h3>
      {disease.pathogen && <p className="mt-0.5 truncate text-xs text-muted italic">{disease.pathogen}</p>}

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{disease.description}</p>

      <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-4 text-xs text-subtle">
        {disease.symptoms?.length > 0 && (
          <span className="flex items-center gap-1.5">
            <Stethoscope className="size-3.5" /> {t("library.symptomCount", { count: disease.symptoms.length })}
          </span>
        )}
        {disease.favourableConditions && (
          <span className="flex items-center gap-1.5">
            <CloudSun className="size-3.5" /> {t("library.weatherLinked")}
          </span>
        )}
      </div>
    </motion.button>
  );
}

function DiseaseInfo() {
  const { t, cropName, diseaseName } = usePreferences();
  const { diseases, loading, error, translation } = useDiseases();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query, setQuery] = useState("");
  const [showHealthy, setShowHealthy] = useState(false);

  // Crop filter and the open disease live in the URL, so results can link here
  const crop = searchParams.get("crop") || "all";
  const openCode = searchParams.get("disease");
  const openDisease = diseases.find((disease) => disease.code === openCode);

  const updateParam = useCallback(
    (key, value) => {
      setSearchParams(
        (params) => {
          const next = new URLSearchParams(params);
          value ? next.set(key, value) : next.delete(key);
          return next;
        },
        { replace: key === "crop" }
      );
    },
    [setSearchParams]
  );

  const closeDrawer = useCallback(() => updateParam("disease", null), [updateParam]);

  const crops = useMemo(() => {
    const counts = new Map();
    diseases.forEach((disease) => counts.set(disease.crop, (counts.get(disease.crop) || 0) + 1));
    return [...counts.entries()];
  }, [diseases]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();

    return diseases.filter((disease) => {
      if (crop !== "all" && disease.crop !== crop) {
        return false;
      }

      if (!showHealthy && disease.diseaseName?.toLowerCase() === "healthy") {
        return false;
      }

      return (
        !text ||
        [disease.crop, cropName(disease.crop), disease.diseaseName, disease.pathogen, disease.description, ...(disease.symptoms || [])]
          .some((value) => value?.toLowerCase().includes(text))
      );
    });
  }, [diseases, crop, showHealthy, query, cropName]);

  const chip = (value, label, count) => (
    <button
      key={value}
      type="button"
      onClick={() => updateParam("crop", value === "all" ? null : value)}
      aria-pressed={crop === value}
      className={cx(
        "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition-all",
        crop === value
          ? "bg-primary text-primary-fg ring-primary glow"
          : "bg-surface-2 text-muted ring-border hover:text-fg"
      )}
    >
      {label}
      <span className={cx("text-xs tabular", crop === value ? "text-primary-fg/70" : "text-subtle")}>{count}</span>
    </button>
  );

  return (
    <>
      <PageHeader
        eyebrow={t("library.eyebrow")}
        title={t("library.title")}
        description={t("library.description")}
      />

      <TranslationNote translation={translation} className="mb-4" />

      <Card className="mb-6 space-y-3 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">{t("library.search")}</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("library.search")}
              className="h-10 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2 px-1 text-sm text-muted select-none">
            <input
              type="checkbox"
              checked={showHealthy}
              onChange={(event) => setShowHealthy(event.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            {t("library.showHealthy")}
          </label>
        </div>

        {crops.length > 0 && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            {chip("all", t("library.allCrops"), diseases.length)}
            {crops.map(([value, count]) => chip(value, cropName(value), count))}
          </div>
        )}
      </Card>

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Alert tone="danger" icon={CircleAlert} title={t("library.loadFailed")}>{error}</Alert>
      ) : filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={t("library.noMatch")} description={t("library.noMatchText")} />
      ) : (
        <motion.div
          key={`${crop}-${showHealthy}`}
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {filtered.map((disease) => (
            <DiseaseTile key={disease.code} disease={disease} onOpen={() => updateParam("disease", disease.code)} />
          ))}
        </motion.div>
      )}

      <AnimatePresence>
        {openDisease && <DiseaseDrawer key={openDisease.code} disease={openDisease} onClose={closeDrawer} />}
      </AnimatePresence>
    </>
  );
}

export default DiseaseInfo;

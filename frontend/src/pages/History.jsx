import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, FolderOpen, Gauge, Images, MessageSquareCheck, ScanLine, Search, SearchX } from "lucide-react";
import AuthImage from "../components/AuthImage";
import ConfidenceBar from "../components/ConfidenceBar";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Segmented, Skeleton, TONES, cx, fadeUp, stagger } from "../components/ui";
import { getPredictionHistory } from "../services/predictionService";
import usePreferences from "../hooks/usePreferences";
import { SEVERITY_TONE, STATUSES, formatDate, predictionTitle, statusInfo } from "../utils/prediction";

function HistoryCard({ prediction }) {
  const { t, cropName, locale, diseaseName } = usePreferences();
  const status = statusInfo(prediction.status);
  const tone = prediction.isHealthy ? "success" : status.tone;
  const photos = prediction.imageUrls || [];
  const diagnosed = !["rejected", "unknown"].includes(prediction.status);

  return (
    <motion.div variants={fadeUp} layout>
      <Link
        to={`/result/${prediction.id}`}
        className="group block h-full overflow-hidden rounded-2xl border border-border bg-surface/80 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_12px_40px_-12px_var(--glow)]"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-surface-2">
          {photos[0] && (
            <AuthImage
              src={photos[0]}
              alt=""
              className="size-full transition-transform duration-500 group-hover:scale-105"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          <div className="absolute top-3 left-3">
            <Badge tone={tone} icon={status.icon} className="bg-surface/90 backdrop-blur">
              {prediction.isHealthy && prediction.status === "confident" ? t("status.healthy") : t(`status.${prediction.status}.label`)}
            </Badge>
          </div>

          <div className="absolute right-3 bottom-3 flex gap-1.5">
            {prediction.feedback && (
              <span className="grid size-7 place-items-center rounded-full bg-black/60 text-white backdrop-blur" title={t("history.feedbackGiven")}>
                <MessageSquareCheck className="size-3.5" />
              </span>
            )}
            {photos.length > 1 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 text-xs font-semibold text-white backdrop-blur">
                <Images className="size-3.5" /> {photos.length}
              </span>
            )}
          </div>
        </div>

        <div className="p-4">
          {prediction.crop && diagnosed && (
            <p className="text-xs font-bold tracking-wider text-primary uppercase">{cropName(prediction.crop)}</p>
          )}
          <h3 className="mt-1 truncate text-base font-bold text-fg">{predictionTitle(prediction, t, diseaseName)}</h3>
          <p className="mt-0.5 text-xs text-muted">{formatDate(prediction.createdAt, locale)}</p>

          {diagnosed && prediction.confidence != null && (
            <ConfidenceBar
              value={prediction.confidence}
              tone={tone}
              size="sm"
              label={t("result.confidence")}
              className="mt-4"
            />
          )}

          {prediction.severity && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <Gauge className="size-3.5" />
              {t("history.severity", {
                label: t(`severity.grade${prediction.severity.grade}`),
                percent: Number(prediction.severity.percent).toFixed(0),
              })}
              <span className={cx("ml-auto size-2 rounded-full", TONES[SEVERITY_TONE[prediction.severity.grade]].fill)} />
            </p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

function History() {
  const { t, cropName, diseaseName } = usePreferences();

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [crop, setCrop] = useState("all");

  useEffect(() => {
    getPredictionHistory()
      .then((data) => setHistory(data.predictions || []))
      .catch((err) => setError(err.response?.data?.message || t("history.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const crops = useMemo(
    () => [...new Set(history.map((item) => item.crop).filter(Boolean))].sort(),
    [history]
  );

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();

    return history.filter((item) => {
      if (status !== "all" && item.status !== status) {
        return false;
      }

      if (crop !== "all" && item.crop !== crop) {
        return false;
      }

      return (
        !text ||
        [item.crop, item.disease, cropName(item.crop)].some((value) => value?.toLowerCase().includes(text))
      );
    });
  }, [history, query, status, crop, cropName]);

  const header = (
    <PageHeader
      eyebrow={t("history.eyebrow")}
      title={t("history.title")}
      description={loading ? t("history.description") : t("history.count", { count: history.length })}
      actions={<Button as={Link} to="/detect" icon={ScanLine}>{t("result.newScan")}</Button>}
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((key) => (
            <Skeleton key={key} className="h-72 rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        {header}
        <Alert tone="danger" icon={CircleAlert} title={t("history.loadFailed")}>{error}</Alert>
      </>
    );
  }

  if (history.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          icon={FolderOpen}
          title={t("history.emptyTitle")}
          description={t("history.emptyText")}
          action={<Button as={Link} to="/detect" icon={ScanLine}>{t("history.startScan")}</Button>}
        />
      </>
    );
  }

  return (
    <>
      {header}

      {/* One filter row for the whole list */}
      <Card className="mb-6 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{t("history.search")}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("history.search")}
            className="h-10 w-full rounded-xl bg-surface-2 pr-3 pl-9 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
          />
        </label>

        <div className="-mx-3 overflow-x-auto px-3 lg:mx-0 lg:px-0">
          <Segmented
            layoutId="history-status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: t("history.all") },
              ...STATUSES.map((value) => ({ value, label: t(`status.${value}.short`) })),
            ]}
          />
        </div>

        {crops.length > 1 && (
          <select
            value={crop}
            onChange={(event) => setCrop(event.target.value)}
            aria-label={t("history.crop")}
            className="h-10 rounded-xl bg-surface-2 px-3 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
          >
            <option value="all">{t("history.allCrops")}</option>
            {crops.map((value) => (
              <option key={value} value={value}>{cropName(value)}</option>
            ))}
          </select>
        )}
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={SearchX} title={t("history.noMatch")} description={t("history.noMatchText")} />
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          <AnimatePresence>
            {filtered.map((item) => (
              <HistoryCard key={item.id} prediction={item} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
}

export default History;

import React, { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Calendar,
  CloudSun,
  FileSearch,
  Gauge,
  Images,
  LayoutList,
  MessageSquareHeart,
  ScanLine,
  ScanSearch,
  Stethoscope,
  Target,
} from "lucide-react";
import AuthImage from "../components/AuthImage";
import ConfidenceBar from "../components/ConfidenceBar";
import SeverityMeter from "../components/SeverityMeter";
import Tabs from "../components/Tabs";
import AdviceView from "../components/result/AdviceView";
import ExplanationView from "../components/result/ExplanationView";
import FeedbackForm from "../components/result/FeedbackForm";
import { Alert, Badge, Button, Card, EmptyState, SectionTitle, Skeleton, cx, fadeUp, stagger } from "../components/ui";
import { getPredictionById } from "../services/predictionService";
import usePreferences from "../hooks/usePreferences";
import { RISK_TONE, formatDate, statusInfo } from "../utils/prediction";

function resultTitle(prediction, t) {
  switch (prediction.status) {
    case "rejected":
      return t("result.rejectedTitle");
    case "unknown":
      return t("result.unknownTitle");
    case "ambiguous":
      return t("result.ambiguousTitle", { disease: prediction.disease });
    default:
      return prediction.isHealthy ? t("result.healthyTitle") : prediction.disease;
  }
}

function Metric({ icon: Icon, label, children }) {
  return (
    <div className="rounded-xl bg-surface-2/70 p-4 ring-1 ring-inset ring-border">
      <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-wider text-muted uppercase">
        <Icon className="size-3.5" /> {label}
      </p>
      {children}
    </div>
  );
}

function Summary({ prediction }) {
  const { t, cropName, locale } = usePreferences();
  const status = statusInfo(prediction.status);
  const tone = prediction.isHealthy ? "success" : status.tone;
  const photos = prediction.imageUrls || [];
  const diagnosed = prediction.status !== "rejected";

  return (
    <Card className="overflow-hidden">
      <div className="grid md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="relative aspect-[4/3] bg-surface-2 md:aspect-auto md:min-h-full">
          {photos[0] && <AuthImage src={photos[0]} alt={t("explain.photoAlt", { n: 1 })} className="absolute inset-0 size-full" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:to-surface/30" />
          {photos.length > 1 && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              <Images className="size-3.5" /> {t("result.photos", { count: photos.length })}
            </span>
          )}
        </div>

        <div className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={tone} icon={status.icon}>
              {prediction.isHealthy && prediction.status === "confident" ? t("status.healthy") : t(`status.${prediction.status}.label`)}
            </Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              <Calendar className="size-3.5" /> {formatDate(prediction.createdAt, locale)}
            </span>
          </div>

          {prediction.crop && diagnosed && (
            <p className="mt-5 text-xs font-bold tracking-[0.18em] text-primary uppercase">{cropName(prediction.crop)}</p>
          )}
          <h1 className={cx("text-3xl font-extrabold tracking-tight text-fg sm:text-4xl", !(prediction.crop && diagnosed) && "mt-5")}>
            {resultTitle(prediction, t)}
          </h1>
          {prediction.message && <p className="mt-2 max-w-2xl text-muted">{prediction.message}</p>}

          {diagnosed && (
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric icon={Target} label={t("result.confidence")}>
                <ConfidenceBar value={prediction.confidence} tone={tone === "neutral" ? "neutral" : tone} label={t("result.topMatch")} />
              </Metric>

              <Metric icon={Gauge} label={t("result.severity")}>
                {prediction.severity ? (
                  <SeverityMeter severity={prediction.severity} />
                ) : (
                  <p className="text-sm text-muted">{t(prediction.isHealthy ? "result.noSeverityHealthy" : "result.noSeverity")}</p>
                )}
              </Metric>

              <Metric icon={CloudSun} label={t("result.weather")}>
                {prediction.weatherRisk ? (
                  <div>
                    <Badge tone={RISK_TONE[prediction.weatherRisk.level]}>{t(`risk.${prediction.weatherRisk.level}`)}</Badge>
                    <p className="mt-2 text-xs text-muted">
                      {t("result.favourableHours", { hours: prediction.weatherRisk.favourableHours })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("result.noWeather")}</p>
                )}
              </Metric>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Overview({ prediction, onShowTab }) {
  const { t, cropName } = usePreferences();
  const tone = prediction.isHealthy ? "success" : statusInfo(prediction.status).tone;
  const candidates = prediction.candidates || [];
  const rejected = prediction.status === "rejected";

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-5 lg:grid-cols-2">
      <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
        <SectionTitle icon={FileSearch}>{t("result.meaning")}</SectionTitle>
        <p className="text-sm leading-relaxed text-muted">{t(`status.${prediction.status}.explain`)}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          {rejected || prediction.status === "unknown" ? (
            <Button as={Link} to="/detect" icon={ScanLine}>{t("result.scanAgain")}</Button>
          ) : (
            <Button variant="secondary" icon={Stethoscope} onClick={() => onShowTab("treatment")}>
              {t("result.seeTreatment")}
            </Button>
          )}
          {prediction.explanation && (
            <Button variant="ghost" icon={ScanSearch} onClick={() => onShowTab("explain")}>
              {t("result.seeWhy")}
            </Button>
          )}
        </div>
      </Card>

      {candidates.length > 0 && (
        <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
          <SectionTitle icon={LayoutList}>{t("result.candidates")}</SectionTitle>
          <div className="space-y-4">
            {candidates.map((candidate, index) => (
              <ConfidenceBar
                key={candidate.classId}
                value={candidate.confidence}
                // Highlight the top match, grey the rest
                tone={index === 0 ? tone : "neutral"}
                label={`${cropName(candidate.crop)} – ${candidate.disease}`}
              />
            ))}
          </div>
          {prediction.status === "ambiguous" && (
            <p className="mt-4 text-xs leading-relaxed text-muted">{t("result.ambiguousNote")}</p>
          )}
        </Card>
      )}

      {prediction.weatherRisk && (
        <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
          <SectionTitle icon={CloudSun}>{t("result.weatherTitle")}</SectionTitle>
          <ConfidenceBar
            // The backend checks the next 72 hours of forecast (WeatherClient.next72Hours)
            value={(prediction.weatherRisk.favourableHours / 72) * 100}
            tone={RISK_TONE[prediction.weatherRisk.level]}
            label={t("result.favourableHours", { hours: prediction.weatherRisk.favourableHours })}
            showValue={false}
          />
          {prediction.weatherRisk.conditions && (
            <p className="mt-3 text-sm text-muted">
              {t("result.conditions", { conditions: prediction.weatherRisk.conditions })}
            </p>
          )}
        </Card>
      )}

      {prediction.severity && (
        <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
          <SectionTitle icon={Gauge}>{t("result.severityTitle")}</SectionTitle>
          <SeverityMeter severity={prediction.severity} />
          <p className="mt-3 text-sm text-muted">{t("result.severityNote")}</p>
        </Card>
      )}
    </motion.div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-72 w-full rounded-2xl" />
      <Skeleton className="h-11 w-full max-w-md" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

function Result() {
  const { id } = useParams();
  const location = useLocation();
  const { t } = usePreferences();

  // Right after a scan the result (with its Grad-CAM images) comes with the navigation
  const fromScan = location.state?.prediction;
  const [prediction, setPrediction] = useState(
    fromScan && String(fromScan.id) === id ? fromScan : null
  );
  const [error, setError] = useState("");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (prediction && String(prediction.id) === id) {
      return undefined;
    }

    let active = true;

    getPredictionById(id)
      .then((data) => active && setPrediction(data.prediction))
      .catch((err) => active && setError(err.response?.data?.message || t("result.loadFailed")));

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The feedback response has no Grad-CAM images; keep the ones we have
  const handleFeedbackSaved = (updated) => {
    setPrediction((current) => ({ ...updated, explanation: current?.explanation }));
  };

  const backLink = (
    <Link to="/history" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-fg">
      <ArrowLeft className="size-4" /> {t("result.back")}
    </Link>
  );

  if (error) {
    return (
      <>
        {backLink}
        <EmptyState
          icon={FileSearch}
          title={t("result.notFound")}
          description={error}
          action={<Button as={Link} to="/detect" icon={ScanLine}>{t("result.newScan")}</Button>}
        />
      </>
    );
  }

  if (!prediction) {
    return <ResultSkeleton />;
  }

  const tabs = [
    { value: "overview", label: t("result.tabOverview"), icon: LayoutList },
    { value: "explain", label: t("result.tabExplain"), icon: ScanSearch },
    { value: "treatment", label: t("result.tabTreatment"), icon: Stethoscope },
    { value: "feedback", label: t("result.tabFeedback"), icon: MessageSquareHeart },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {backLink}
        <Button as={Link} to="/detect" size="sm" variant="secondary" icon={ScanLine} className="mb-5">
          {t("result.newScan")}
        </Button>
      </div>

      <Summary prediction={prediction} />

      {prediction.status === "ambiguous" && (
        <Alert tone="warning" icon={statusInfo("ambiguous").icon} title={t("result.ambiguousWarning")} className="mt-5">
          {t("result.ambiguousWarningText")}
        </Alert>
      )}

      <div className="mt-8">
        <Tabs tabs={tabs} value={tab} onChange={setTab} layoutId="result-tab" idPrefix="result-tab" />

        <div id="result-tab-panel" role="tabpanel" aria-labelledby={`result-tab-${tab}`} className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "overview" && <Overview prediction={prediction} onShowTab={setTab} />}
              {tab === "explain" && <ExplanationView prediction={prediction} />}
              {tab === "treatment" && (
                <AdviceView
                  advice={prediction.advice}
                  classId={prediction.classId}
                  showLibraryLink={prediction.status === "confident" && !prediction.isHealthy}
                />
              )}
              {tab === "feedback" && <FeedbackForm prediction={prediction} onSaved={handleFeedbackSaved} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

export default Result;

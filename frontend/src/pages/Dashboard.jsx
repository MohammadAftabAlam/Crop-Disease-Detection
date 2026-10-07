import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BrainCircuit,
  ChartColumn,
  CircleAlert,
  CloudSun,
  Gauge,
  History as HistoryIcon,
  Leaf,
  LoaderCircle,
  MapPin,
  PieChart,
  ScanLine,
  ShieldCheck,
  Sprout,
  TriangleAlert,
} from "lucide-react";
import AuthImage from "../components/AuthImage";
import ConfidenceBar from "../components/ConfidenceBar";
import { Alert, Badge, Button, Card, EmptyState, SectionTitle, Skeleton, TONES, cx, fadeUp, stagger } from "../components/ui";
import { getPredictionHistory } from "../services/predictionService";
import { getCurrentLocation, getWeatherRisk } from "../services/weatherService";
import useAuth from "../hooks/useAuth";
import useDiseases from "../hooks/useDiseases";
import useModelInfo from "../hooks/useModelInfo";
import usePreferences from "../hooks/usePreferences";
import { SUPPORTED_CROPS } from "../utils/constants";
import {
  RISK_TONE,
  STATUSES,
  diseaseNameFromCode,
  formatDate,
  formatPercent,
  isDiseased,
  predictionTitle,
  statusInfo,
  testAccuracy,
} from "../utils/prediction";

const greetingKey = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "dashboard.morning" : hour < 17 ? "dashboard.afternoon" : "dashboard.evening";
};

function Hero({ name }) {
  const { t } = usePreferences();

  return (
    <Card as={motion.div} variants={fadeUp} className="relative overflow-hidden p-6 sm:p-8">
      {/* Decorative scanner rings */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 -right-10 hidden -translate-y-1/2 sm:block">
        {[0, 1, 2].map((ring) => (
          <motion.span
            key={ring}
            className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30"
            style={{ width: 140 + ring * 70, height: 140 + ring * 70 }}
            animate={{ opacity: [0.15, 0.6, 0.15], scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: ring * 0.5 }}
          />
        ))}
        <div className="relative grid size-28 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 glow">
          <Sprout className="size-12" />
        </div>
      </div>

      <div className="relative max-w-lg">
        <p className="text-sm font-semibold text-primary">{t(greetingKey(), { name })}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
          {t("dashboard.heroTitle")} <span className="text-gradient">{t("dashboard.heroHighlight")}</span>
        </h1>
        <p className="mt-3 text-muted">{t("dashboard.heroText")}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button as={Link} to="/detect" size="lg" icon={ScanLine}>{t("dashboard.scanNow")}</Button>
          <Button as={Link} to="/diseases" size="lg" variant="secondary">{t("dashboard.browseLibrary")}</Button>
        </div>
      </div>
    </Card>
  );
}

// Stat tile: label, value (proportional figures), optional icon
function StatTile({ icon: Icon, label, value, tone = "success", loading }) {
  return (
    <Card as={motion.div} variants={fadeUp} className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={cx("grid size-8 place-items-center rounded-lg ring-1 ring-inset", TONES[tone].soft)}>
          <Icon className={cx("size-4", TONES[tone].text)} />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-9 w-16" />
      ) : (
        <p className="mt-2 text-4xl font-bold tracking-tight text-fg">{value.toLocaleString()}</p>
      )}
    </Card>
  );
}

// Part-to-whole by status: one stacked bar (2px gaps) + a legend with icons and counts
function StatusBreakdown({ predictions }) {
  const { t } = usePreferences();
  const total = predictions.length;

  const counts = STATUSES.map((status) => ({
    status,
    count: predictions.filter((item) => item.status === status).length,
  })).filter((item) => item.count > 0);

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
      <SectionTitle icon={PieChart}>{t("dashboard.statusTitle")}</SectionTitle>

      <div className="flex h-3 gap-0.5">
        {counts.map(({ status, count }) => (
          <div
            key={status}
            className="group relative h-full first:rounded-l-[4px] last:rounded-r-[4px]"
            style={{ width: `${(count / total) * 100}%` }}
          >
            <motion.div
              className={cx("h-full rounded-[inherit]", TONES[statusInfo(status).tone].fill)}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              style={{ originX: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-fg px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-bg opacity-0 transition-opacity group-hover:opacity-100">
              {t(`status.${status}.short`)}: {count}
            </span>
          </div>
        ))}
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3">
        {STATUSES.map((status) => {
          const info = statusInfo(status);
          const count = predictions.filter((item) => item.status === status).length;

          return (
            <li key={status} className="flex items-center gap-2 text-sm">
              <info.icon className={cx("size-4 shrink-0", TONES[info.tone].text)} />
              <span className="truncate text-muted">{t(`status.${status}.short`)}</span>
              <span className="ml-auto font-semibold text-fg tabular">{count}</span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// Single series: one colour, value at the bar tip
function TopDiseases({ predictions }) {
  const { t, cropName } = usePreferences();

  const rows = useMemo(() => {
    const counts = new Map();

    predictions.filter(isDiseased).forEach((item) => {
      const key = `${item.crop}|${item.disease}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()]
      .map(([key, count]) => {
        const [crop, disease] = key.split("|");
        return { crop, disease, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [predictions]);

  const max = rows[0]?.count || 1;

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
      <SectionTitle icon={ChartColumn}>{t("dashboard.topTitle")}</SectionTitle>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t("dashboard.topEmpty")}</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={`${row.crop}-${row.disease}`} className="group">
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-fg">
                  {row.disease} <span className="text-muted">· {cropName(row.crop)}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 flex-1">
                  <motion.div
                    className="h-full rounded-r-[4px] bg-primary transition-opacity group-hover:opacity-80"
                    initial={{ width: 0 }}
                    animate={{ width: `${(row.count / max) * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.2 }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-semibold text-fg tabular">{row.count}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentScans({ predictions }) {
  const { t, cropName, locale } = usePreferences();
  const recent = predictions.slice(0, 5);

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
      <SectionTitle
        icon={HistoryIcon}
        action={
          predictions.length > 0 && (
            <Link to="/history" className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
              {t("dashboard.viewAll")} <ArrowRight className="size-4" />
            </Link>
          )
        }
      >
        {t("dashboard.recentTitle")}
      </SectionTitle>

      {recent.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title={t("dashboard.noScansTitle")}
          description={t("dashboard.noScansText")}
          action={<Button as={Link} to="/detect" icon={ScanLine}>{t("history.startScan")}</Button>}
          className="py-10"
        />
      ) : (
        <ul className="-mx-2">
          {recent.map((item) => {
            const info = statusInfo(item.status);
            const tone = item.isHealthy ? "success" : info.tone;

            return (
              <li key={item.id}>
                <Link
                  to={`/result/${item.id}`}
                  className="flex items-center gap-4 rounded-xl p-2 transition-colors hover:bg-surface-2"
                >
                  {item.imageUrls?.[0] ? (
                    <AuthImage src={item.imageUrls[0]} alt="" className="size-12 shrink-0 rounded-lg" />
                  ) : (
                    <div className="size-12 shrink-0 rounded-lg bg-surface-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-fg">{predictionTitle(item, t)}</p>
                    <p className="truncate text-xs text-muted">
                      {item.crop ? `${cropName(item.crop)} · ` : ""}
                      {formatDate(item.createdAt, locale)}
                    </p>
                  </div>
                  <Badge tone={tone} icon={info.icon} className="hidden sm:inline-flex">
                    {item.isHealthy && item.status === "confident" ? t("status.healthy") : t(`status.${item.status}.short`)}
                  </Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// Honest model numbers: lab photos vs real field photos
function ModelCard() {
  const { t, cropName, locale } = usePreferences();
  const modelInfo = useModelInfo();

  const lab = testAccuracy(modelInfo, "plantvillage_test");
  const field = testAccuracy(modelInfo, "plantdoc_test");
  // The backend answers { success: false } when the AI service is down
  const offline = !modelInfo?.modelLoaded;

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
      <SectionTitle
        icon={BrainCircuit}
        action={
          <Badge tone={offline ? "danger" : "success"} icon={offline ? CircleAlert : ShieldCheck}>
            {t(offline ? "dashboard.modelOffline" : "dashboard.modelOnline")}
          </Badge>
        }
      >
        {t("dashboard.modelTitle")}
      </SectionTitle>

      {offline ? (
        <p className="text-sm text-muted">{t("dashboard.modelOfflineText")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-inset ring-border">
              <p className="text-xs text-muted">{t("dashboard.labAccuracy")}</p>
              <p className="mt-1 text-3xl font-bold text-fg">{formatPercent(lab)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-inset ring-border">
              <p className="text-xs text-muted">{t("dashboard.fieldAccuracy")}</p>
              <p className="mt-1 text-3xl font-bold text-fg">{formatPercent(field)}</p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t("dashboard.accuracyNote")}</p>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-subtle">{t("dashboard.architecture")}</dt>
              <dd className="font-semibold text-fg">{modelInfo.architecture || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">{t("dashboard.classes")}</dt>
              <dd className="font-semibold text-fg">{modelInfo.classes?.length ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">{t("dashboard.trained")}</dt>
              <dd className="font-semibold text-fg">{modelInfo.createdAt ? formatDate(modelInfo.createdAt, locale, false) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">{t("dashboard.gate")}</dt>
              <dd className="font-semibold text-fg">{modelInfo.gate || "—"}</dd>
            </div>
          </dl>

          {modelInfo.crops?.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {modelInfo.crops.map((crop) => (
                <Badge key={crop} icon={Leaf}>{cropName(crop)}</Badge>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// Disease risk near the farmer for the next 3 days (Open-Meteo forecast)
function WeatherWidget() {
  const { t, cropName } = usePreferences();
  const modelInfo = useModelInfo();
  const { diseases } = useDiseases();
  const crops = modelInfo?.crops?.length ? modelInfo.crops : SUPPORTED_CROPS;

  const [crop, setCrop] = useState(crops[0]);
  const [state, setState] = useState({ status: "idle", risks: [], error: "" });

  const nameFor = (code) => diseases.find((disease) => disease.code === code)?.diseaseName || diseaseNameFromCode(code);

  const check = async () => {
    setState({ status: "loading", risks: [], error: "" });

    try {
      const { lat, lon } = await getCurrentLocation();
      const data = await getWeatherRisk(crop.toLowerCase(), lat, lon);
      setState({ status: "done", risks: data.risks || [], error: "" });
    } catch (err) {
      const reason = err.message === "denied" ? t("scan.locationDenied")
        : err.message === "unavailable" || err.message === "unsupported" ? t("scan.locationError")
        : err.response?.data?.message || t("dashboard.weatherFailed");
      setState({ status: "error", risks: [], error: reason });
    }
  };

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
      <SectionTitle icon={CloudSun}>{t("dashboard.weatherTitle")}</SectionTitle>
      <p className="-mt-2 mb-4 text-sm text-muted">{t("dashboard.weatherText")}</p>

      <div className="flex gap-2">
        <select
          value={crop}
          onChange={(event) => {
            setCrop(event.target.value);
            setState({ status: "idle", risks: [], error: "" });
          }}
          aria-label={t("history.crop")}
          className="h-10 flex-1 rounded-xl bg-surface-2 px-3 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
        >
          {crops.map((value) => (
            <option key={value} value={value}>{cropName(value)}</option>
          ))}
        </select>
        <Button size="sm" icon={MapPin} loading={state.status === "loading"} onClick={check} className="h-10">
          {t("dashboard.checkRisk")}
        </Button>
      </div>

      <div className="mt-5">
        {state.status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <LoaderCircle className="size-4 animate-spin text-primary" /> {t("dashboard.weatherLoading")}
          </p>
        )}

        {state.status === "error" && <Alert tone="danger" icon={CircleAlert}>{state.error}</Alert>}

        {state.status === "done" && (
          <motion.ul variants={stagger} initial="hidden" animate="show" className="space-y-4">
            {state.risks.map((risk) => (
              <motion.li key={risk.code} variants={fadeUp}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-fg">{nameFor(risk.code)}</span>
                  <Badge tone={RISK_TONE[risk.level]} icon={risk.level === "HIGH" ? TriangleAlert : risk.level === "MEDIUM" ? Gauge : ShieldCheck}>
                    {t(`risk.${risk.level}`)}
                  </Badge>
                </div>
                <ConfidenceBar
                  value={(risk.favourableHours / (risk.forecastHours || 72)) * 100}
                  tone={RISK_TONE[risk.level]}
                  size="sm"
                  showValue={false}
                />
                <p className="mt-1 text-xs text-muted">
                  {t("dashboard.riskHours", { hours: risk.favourableHours, total: risk.forecastHours || 72 })}
                </p>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </div>
    </Card>
  );
}

function Dashboard() {
  const { user } = useAuth();
  const { t } = usePreferences();

  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getPredictionHistory()
      .then((data) => setPredictions(data.predictions || []))
      .catch((err) => setError(err.response?.data?.message || t("history.loadFailed")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => ({
    total: predictions.length,
    diseased: predictions.filter(isDiseased).length,
    healthy: predictions.filter((item) => item.status === "confident" && item.isHealthy).length,
    severe: predictions.filter((item) => (item.severity?.grade ?? 0) >= 3).length,
  }), [predictions]);

  const firstName = user?.name?.split(" ")[0] || "";

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <Hero name={firstName} />

      {error && <Alert tone="danger" icon={CircleAlert} title={t("history.loadFailed")}>{error}</Alert>}

      <motion.div variants={stagger} className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile icon={ScanLine} label={t("dashboard.statTotal")} value={stats.total} tone="info" loading={loading} />
        <StatTile icon={TriangleAlert} label={t("dashboard.statDiseased")} value={stats.diseased} tone="warning" loading={loading} />
        <StatTile icon={Leaf} label={t("dashboard.statHealthy")} value={stats.healthy} tone="success" loading={loading} />
        <StatTile icon={Gauge} label={t("dashboard.statSevere")} value={stats.severe} tone="danger" loading={loading} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {loading ? <Skeleton className="h-96 rounded-2xl" /> : <RecentScans predictions={predictions} />}
        </div>
        <div className="space-y-6 lg:col-span-2">
          {loading ? (
            <Skeleton className="h-96 rounded-2xl" />
          ) : (
            predictions.length > 0 && (
              <>
                <StatusBreakdown predictions={predictions} />
                <TopDiseases predictions={predictions} />
              </>
            )
          )}
          {!loading && predictions.length === 0 && <WeatherWidget />}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {predictions.length > 0 && <WeatherWidget />}
        <ModelCard />
      </div>
    </motion.div>
  );
}

export default Dashboard;

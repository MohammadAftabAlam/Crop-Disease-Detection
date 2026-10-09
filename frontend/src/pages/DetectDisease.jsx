import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  CloudSun,
  Lightbulb,
  LoaderCircle,
  MapPin,
  ScanLine,
  Sparkles,
  WifiOff,
} from "lucide-react";
import ImageUploader from "../components/ImageUploader";
import OfflineModeCard from "../components/OfflineModeCard";
import { useOfflineModel, useOnlineStatus } from "../hooks/useOffline";
import { diagnoseOffline } from "../offline/model";
import { addPendingScan } from "../offline/queue";
import { Alert, Badge, Button, Card, PageHeader, SectionTitle, cx, fadeUp, stagger } from "../components/ui";
import { predictDisease } from "../services/predictionService";
import { getCurrentLocation } from "../services/weatherService";
import useModelInfo from "../hooks/useModelInfo";
import usePreferences from "../hooks/usePreferences";
import { SUPPORTED_CROPS } from "../utils/constants";

const SCAN_STEPS = ["scan.step1", "scan.step2", "scan.step3", "scan.step4", "scan.step5"];

// Shown over the upload card while the AI service works
function ScanningOverlay({ files }) {
  const { t } = usePreferences();
  const [step, setStep] = useState(0);

  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!files[0]) {
      return undefined;
    }

    const url = URL.createObjectURL(files[0]);
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [files]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep((current) => Math.min(current + 1, SCAN_STEPS.length - 1));
    }, 1400);

    return () => clearInterval(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 rounded-2xl bg-surface/95 p-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div className="relative size-44 overflow-hidden rounded-2xl ring-1 ring-primary/40 glow sm:size-52">
        {preview && <img src={preview} alt="" className="size-full object-cover" />}
        <div className="absolute inset-0 bg-primary/10" />

        {/* Sweeping scan line */}
        <motion.div
          className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/40 to-transparent"
          animate={{ top: ["-20%", "100%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatType: "reverse" }}
        >
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary shadow-[0_0_12px_var(--primary)]" />
        </motion.div>

        {/* Corner brackets */}
        {["top-2 left-2 border-t-2 border-l-2", "top-2 right-2 border-t-2 border-r-2", "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-r-2 border-b-2"].map((corner) => (
          <span key={corner} className={cx("absolute size-5 rounded-sm border-primary", corner)} />
        ))}
      </div>

      <div className="w-full max-w-xs text-center">
        <p className="text-lg font-bold text-fg">{t("scan.analyzing")}</p>

        <div className="mt-4 space-y-2 text-left">
          {SCAN_STEPS.map((key, index) => (
            <div
              key={key}
              className={cx(
                "flex items-center gap-2.5 text-sm transition-colors",
                index < step ? "text-muted" : index === step ? "font-semibold text-fg" : "text-subtle"
              )}
            >
              {index < step ? (
                <CircleCheck className="size-4 text-primary" />
              ) : index === step ? (
                <LoaderCircle className="size-4 animate-spin text-primary" />
              ) : (
                <span className="size-4 rounded-full ring-1 ring-inset ring-border" />
              )}
              {t(key)}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// Optional: which crop the photos show (limits the answer to that crop's diseases)
function CropPicker({ crops, value, onChange }) {
  const { t, cropName } = usePreferences();
  const options = [{ value: "", label: t("scan.anyCrop") }, ...crops.map((c) => ({ value: c.toLowerCase(), label: cropName(c) }))];

  return (
    <div className="rounded-xl bg-surface-2 p-4 ring-1 ring-inset ring-border">
      <p className="font-semibold text-fg">{t("scan.cropTitle")}</p>
      <p className="mt-0.5 text-sm text-muted">{t("scan.cropHint")}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={t("scan.cropTitle")}>
        {options.map((option) => (
          <button
            key={option.value || "any"}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cx(
              "rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition-colors",
              value === option.value ? "bg-primary text-primary-fg ring-primary" : "text-muted ring-border hover:text-fg"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Opt-in: adds the weather risk for the detected disease
function LocationOption({ location, onChange }) {
  const { t } = usePreferences();
  const [status, setStatus] = useState(location ? "ready" : "off");

  const enabled = status === "ready" || status === "locating";

  const toggle = async () => {
    if (enabled) {
      setStatus("off");
      onChange(null);
      return;
    }

    setStatus("locating");

    try {
      onChange(await getCurrentLocation());
      setStatus("ready");
    } catch (error) {
      onChange(null);
      setStatus(error.message === "denied" ? "denied" : "error");
    }
  };

  return (
    <div className="flex items-start gap-4 rounded-xl bg-surface-2 p-4 ring-1 ring-inset ring-border">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-info/10 text-info ring-1 ring-info/25">
        <CloudSun className="size-5" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-fg">{t("scan.weatherTitle")}</p>
        <p className="mt-0.5 text-sm text-muted">{t("scan.weatherText")}</p>

        {status === "ready" && location && (
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <MapPin className="size-3.5 text-primary" />
            {t("scan.locationSet", { lat: location.lat, lon: location.lon })}
          </p>
        )}
        {status === "denied" && <p className="mt-2 text-xs font-medium text-danger">{t("scan.locationDenied")}</p>}
        {status === "error" && <p className="mt-2 text-xs font-medium text-danger">{t("scan.locationError")}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={t("scan.weatherTitle")}
        onClick={toggle}
        className={cx(
          "relative mt-1 h-6 w-11 shrink-0 rounded-full transition-colors",
          enabled ? "bg-primary" : "bg-surface-3 ring-1 ring-inset ring-border"
        )}
      >
        <motion.span
          layout
          className={cx(
            "absolute top-1 grid size-4 place-items-center rounded-full bg-white shadow",
            enabled ? "right-1" : "left-1"
          )}
        >
          {status === "locating" && <LoaderCircle className="size-3 animate-spin text-primary-strong" />}
        </motion.span>
      </button>
    </div>
  );
}

function PhotoTips() {
  const { t, cropName } = usePreferences();
  const modelInfo = useModelInfo();
  const crops = modelInfo?.crops?.length ? modelInfo.crops : SUPPORTED_CROPS;

  const good = ["tips.good1", "tips.good2", "tips.good3", "tips.good4"];
  const bad = ["tips.bad1", "tips.bad2", "tips.bad3"];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <Card as={motion.div} variants={fadeUp} className="p-5">
        <SectionTitle icon={Lightbulb}>{t("tips.title")}</SectionTitle>

        <ul className="space-y-2.5">
          {good.map((key) => (
            <li key={key} className="flex gap-2.5 text-sm text-fg">
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
              {t(key)}
            </li>
          ))}
        </ul>

        <p className="mt-5 mb-2.5 text-xs font-bold tracking-wider text-muted uppercase">{t("tips.avoid")}</p>
        <ul className="space-y-2.5">
          {bad.map((key) => (
            <li key={key} className="flex gap-2.5 text-sm text-muted">
              <CircleX className="mt-0.5 size-4 shrink-0 text-danger" />
              {t(key)}
            </li>
          ))}
        </ul>
      </Card>

      <motion.div variants={fadeUp}>
        <OfflineModeCard compact />
      </motion.div>

      <Card as={motion.div} variants={fadeUp} className="p-5">
        <SectionTitle icon={Sparkles}>{t("tips.supported")}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {crops.map((crop) => (
            <Badge key={crop}>{cropName(crop)}</Badge>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">{t("tips.supportedNote")}</p>
      </Card>
    </motion.div>
  );
}

function DetectDisease() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const modelInfo = useModelInfo();
  const online = useOnlineStatus();
  const { ready: offlineReady } = useOfflineModel();

  const [files, setFiles] = useState([]);
  const [location, setLocation] = useState(null);
  const [crop, setCrop] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleImagesChange = (nextFiles) => {
    setFiles(nextFiles);
    setError("");
  };

  // No internet (or the server is unreachable): check on the phone if the offline model is
  // downloaded, and save the photos so they get the full analysis later
  const runOffline = async () => {
    let result = null;
    if (offlineReady) {
      try {
        result = await diagnoseOffline(files, crop || null);
      } catch {
        result = null;
      }
    }
    const scanId = await addPendingScan({ files, location, result });
    navigate("/offline-result", { state: { result, scanId } });
  };

  const handleDetection = async () => {
    if (files.length === 0) {
      setError(t("scan.noPhoto"));
      return;
    }

    setLoading(true);
    setError("");

    if (!online) {
      await runOffline();
      return;
    }

    try {
      const { prediction, translation } = await predictDisease(files, {
        lat: location?.lat,
        lon: location?.lon,
        explain: true,
        crop: crop || undefined,
      });

      // Grad-CAM images are not stored, so the result travels with the navigation
      navigate(`/result/${prediction.id}`, { state: { prediction, translation } });
    } catch (err) {
      if (!err.response) {
        // Network error: the server cannot be reached
        await runOffline();
        return;
      }
      setError(err.response?.data?.message || t("scan.failed"));
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={t("scan.eyebrow")} title={t("scan.title")} description={t("scan.description")} />

      {!online && (
        <Alert tone="info" icon={WifiOff} title={t("offline.youAreOffline")} className="mb-6">
          {offlineReady ? t("offline.offlineScanHint") : t("offline.noModelHint")}
        </Alert>
      )}

      {online && modelInfo && !modelInfo.modelLoaded && (
        <Alert tone="warning" icon={CircleAlert} title={t("scan.modelOffline")} className="mb-6">
          {t("scan.modelOfflineText")}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="relative p-5 sm:p-6">
          <ImageUploader onImagesChange={handleImagesChange} />

          <div className="mt-6 space-y-4">
            <CropPicker crops={modelInfo?.crops?.length ? modelInfo.crops : SUPPORTED_CROPS} value={crop} onChange={setCrop} />
            <LocationOption location={location} onChange={setLocation} />
          </div>

          {error && (
            <Alert tone="danger" icon={CircleAlert} title={t("scan.errorTitle")} className="mt-5">
              {error}
            </Alert>
          )}

          <Button
            size="lg"
            icon={ScanLine}
            onClick={handleDetection}
            disabled={files.length === 0 || loading}
            className="mt-6 w-full"
          >
            {!online
              ? t(offlineReady ? "offline.checkOffline" : "offline.saveForLater")
              : files.length > 1 ? t("scan.analyzeMany", { count: files.length }) : t("scan.analyze")}
          </Button>

          <AnimatePresence>{loading && <ScanningOverlay files={files} />}</AnimatePresence>
        </Card>

        <PhotoTips />
      </div>
    </>
  );
}

export default DetectDisease;

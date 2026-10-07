import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  CloudUpload,
  FileSearch,
  Gauge,
  LayoutList,
  ListChecks,
  ScanLine,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react";
import ConfidenceBar from "../components/ConfidenceBar";
import { Alert, Badge, Button, Card, EmptyState, SectionTitle, fadeUp, stagger } from "../components/ui";
import usePreferences from "../hooks/usePreferences";
import useDiseases from "../hooks/useDiseases";
import { useOnlineStatus } from "../hooks/useOffline";
import { listPendingScans, removePendingScan, toFiles } from "../offline/queue";
import { predictDisease } from "../services/predictionService";
import { predictionMessage, predictionTitle, statusInfo } from "../utils/prediction";

function Photos({ scanId }) {
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    let created = [];
    listPendingScans().then((scans) => {
      const scan = scans.find((s) => s.id === scanId);
      created = (scan?.files || []).map((f) => URL.createObjectURL(f.blob));
      setUrls(created);
    });
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, [scanId]);

  if (urls.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((url, i) => (
        <img key={url} src={url} alt={`${i + 1}`} className="aspect-square w-full rounded-lg object-cover ring-1 ring-border" />
      ))}
    </div>
  );
}

function OfflineResult() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const preferences = usePreferences();
  const { t, cropName, diseaseName } = preferences;
  const online = useOnlineStatus();
  const { diseases } = useDiseases();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const result = state?.result;
  const scanId = state?.scanId;

  const disease = useMemo(
    () => (result?.classId ? diseases.find((d) => d.code === result.classId) : null),
    [diseases, result]
  );

  if (!scanId) {
    return (
      <EmptyState icon={FileSearch} title={t("offline.missing")}
        action={<Button as={Link} to="/detect" icon={ScanLine}>{t("result.newScan")}</Button>} />
    );
  }

  const sendNow = async () => {
    setSending(true);
    setError("");
    try {
      const scan = (await listPendingScans()).find((s) => s.id === scanId);
      const { prediction, translation } = await predictDisease(toFiles(scan), { lat: scan.lat, lon: scan.lon, explain: true });
      await removePendingScan(scanId);
      navigate(`/result/${prediction.id}`, { state: { prediction, translation }, replace: true });
    } catch (err) {
      setError(err.response?.data?.message || t("scan.failed"));
      setSending(false);
    }
  };

  const status = result ? statusInfo(result.status) : null;
  const tone = result?.isHealthy ? "success" : status?.tone;
  const treat = result?.status === "confident" && !result.isHealthy;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info" icon={WifiOff}>{t("offline.badge")}</Badge>
          {result && (
            <Badge tone={tone} icon={status.icon}>
              {result.isHealthy && result.status === "confident" ? t("status.healthy") : t(`status.${result.status}.label`)}
            </Badge>
          )}
        </div>

        {result ? (
          <>
            {result.crop && result.status !== "rejected" && (
              <p className="mt-5 text-xs font-bold tracking-[0.18em] text-primary uppercase">{cropName(result.crop)}</p>
            )}
            <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
              {result.status === "ambiguous"
                ? t("result.ambiguousTitle", { disease: diseaseName(result.disease) })
                : predictionTitle(result, t, diseaseName)}
            </h1>
            <p className="mt-2 max-w-2xl text-muted">{predictionMessage(result, preferences, result.crops || [])}</p>
          </>
        ) : (
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-fg">{t("offline.savedTitle")}</h1>
        )}

        <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_240px]">
          <div>
            {result?.candidates?.length > 0 && (
              <>
                <SectionTitle icon={LayoutList}>{t("result.candidates")}</SectionTitle>
                <div className="space-y-4">
                  {result.candidates.map((c, index) => (
                    <ConfidenceBar key={c.classId} value={c.confidence} tone={index === 0 ? tone : "neutral"}
                      label={`${cropName(c.crop)} – ${diseaseName(c.disease)}`} />
                  ))}
                </div>
              </>
            )}
            <p className="mt-4 text-xs text-subtle">{result?.model && t("offline.deviceModel", { model: result.model.architecture })}</p>
          </div>
          <Photos scanId={scanId} />
        </div>
      </Card>

      <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
        <SectionTitle icon={CloudUpload}>{t("offline.savedTitle")}</SectionTitle>
        <p className="text-sm text-muted">{online ? t("offline.savedText") : t("offline.savedOnly")}</p>
        <p className="mt-3 flex items-center gap-2 text-xs text-subtle">
          <Gauge className="size-3.5" /> {t("offline.notIncluded")}: {t("result.severity")}, {t("result.tabExplain")}, {t("result.weather")}
        </p>
        {error && <Alert tone="danger" className="mt-4">{error}</Alert>}
        {online && (
          <Button icon={CloudUpload} onClick={sendNow} loading={sending} className="mt-4">{t("offline.sendNow")}</Button>
        )}
      </Card>

      {result && result.status !== "rejected" && (
        <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
          {treat && disease ? (
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <SectionTitle icon={ListChecks}>{t("advice.now")}</SectionTitle>
                <ul className="space-y-2 text-sm text-fg">{disease.remedies.map((r) => <li key={r}>• {r}</li>)}</ul>
              </div>
              <div>
                <SectionTitle icon={ShieldCheck}>{t("advice.prevention")}</SectionTitle>
                <ul className="space-y-2 text-sm text-fg">{disease.prevention.map((p) => <li key={p}>• {p}</li>)}</ul>
              </div>
              <p className="text-xs text-subtle md:col-span-2">{t("offline.fromLibrary")}</p>
            </div>
          ) : treat ? (
            <p className="text-sm text-muted">{t("offline.noLibrary")}</p>
          ) : (
            <Alert tone="warning" icon={TriangleAlert}>{t("offline.doNotTreat")}</Alert>
          )}
        </Card>
      )}
    </motion.div>
  );
}

export default OfflineResult;

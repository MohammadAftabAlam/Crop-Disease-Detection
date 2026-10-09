import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CloudUpload, WifiOff } from "lucide-react";
import { Alert, Button } from "./ui";
import usePreferences from "../hooks/usePreferences";
import { useOnlineStatus, usePendingScans } from "../hooks/useOffline";
import { removePendingScan, toFiles } from "../offline/queue";
import { predictDisease } from "../services/predictionService";

// Scans saved while offline: a reminder when offline, an "Analyse now" button once online
function PendingScansBanner() {
  const { t } = usePreferences();
  const online = useOnlineStatus();
  const { scans } = usePendingScans();
  const navigate = useNavigate();
  const [done, setDone] = useState(null);
  const [error, setError] = useState("");

  if (scans.length === 0) {
    return null;
  }

  // Sent one by one; each successful upload leaves the queue, so a failure can be retried
  const analyse = async () => {
    setError("");
    setDone(0);
    let last = null;
    for (const scan of scans) {
      try {
        const { prediction } = await predictDisease(toFiles(scan), { lat: scan.lat, lon: scan.lon, explain: false });
        await removePendingScan(scan.id);
        last = prediction;
        setDone((n) => n + 1);
      } catch (err) {
        setError(err.response?.data?.message || t("scan.failed"));
        break;
      }
    }
    setDone(null);
    if (last) {
      navigate(scans.length === 1 ? `/result/${last.id}` : "/history");
    }
  };

  if (!online) {
    return (
      <Alert tone="info" icon={WifiOff} className="mb-6">
        {t("offline.pendingOffline", { count: scans.length })}
      </Alert>
    );
  }

  return (
    <Alert tone="info" icon={CloudUpload} className="mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>{t("offline.pendingOnline", { count: scans.length })}</span>
        <Button size="sm" icon={CloudUpload} onClick={analyse} loading={done !== null}>
          {done !== null ? t("offline.analysing", { done, count: scans.length }) : t("offline.analyseNow")}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </Alert>
  );
}

export default PendingScansBanner;

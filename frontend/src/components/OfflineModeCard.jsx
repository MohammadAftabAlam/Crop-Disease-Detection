import React, { useState } from "react";
import { CircleAlert, CircleCheck, CloudDownload, Trash2, WifiOff } from "lucide-react";
import { Alert, Badge, Button, Card, SectionTitle, cx } from "./ui";
import usePreferences from "../hooks/usePreferences";
import { useOfflineModel, useOnlineStatus } from "../hooks/useOffline";
import { prepareOffline, removeOffline } from "../offline/model";

// Download / remove the on-device model. compact = a smaller version for the scan page.
function OfflineModeCard({ compact = false, className }) {
  const { t } = usePreferences();
  const online = useOnlineStatus();
  const { ready, version, refresh } = useOfflineModel();
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const download = async () => {
    setError("");
    setProgress(0);
    try {
      await prepareOffline(setProgress);
      refresh();
    } catch {
      setError(t("offline.failed"));
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    await removeOffline();
    refresh();
  };

  const busy = progress !== null;

  return (
    <Card className={cx(compact ? "p-4" : "p-5 sm:p-6", className)}>
      <SectionTitle
        icon={WifiOff}
        action={
          <Badge tone={ready ? "success" : "neutral"} icon={ready ? CircleCheck : undefined}>
            {ready ? t("offline.ready") : t("offline.notReady")}
          </Badge>
        }
      >
        {t("offline.title")}
      </SectionTitle>

      {!compact && <p className="text-sm leading-relaxed text-muted">{t("offline.description")}</p>}
      <p className={cx("text-xs leading-relaxed text-subtle", !compact && "mt-2")}>{t("offline.limits")}</p>

      {busy && (
        <div className="mt-4" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">{t("offline.downloading", { percent: Math.round(progress * 100) })}</p>
        </div>
      )}

      {error && <Alert tone="danger" icon={CircleAlert} className="mt-4">{error}</Alert>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {!ready && (
          <Button icon={CloudDownload} onClick={download} loading={busy} disabled={!online || busy} size={compact ? "sm" : "md"}>
            {t("offline.download")}
          </Button>
        )}
        {ready && !compact && (
          <Button variant="ghost" icon={Trash2} onClick={remove} size="sm">
            {t("offline.remove")}
          </Button>
        )}
        {ready && version && <span className="text-xs text-subtle">v{version}</span>}
      </div>
    </Card>
  );
}

export default OfflineModeCard;

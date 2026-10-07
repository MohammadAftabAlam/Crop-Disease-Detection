import { useCallback, useEffect, useState } from "react";
import { listPendingScans, onQueueChange } from "../offline/queue";
import { offlineVersion } from "../offline/model";

// Browser connectivity
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  return online;
}

// Scans waiting in the offline queue
export function usePendingScans() {
  const [scans, setScans] = useState([]);

  const refresh = useCallback(() => {
    listPendingScans().then(setScans).catch(() => setScans([]));
  }, []);

  useEffect(() => {
    refresh();
    return onQueueChange(refresh);
  }, [refresh]);

  return { scans, refresh };
}

// Whether the offline model has been downloaded on this device (version string or null)
export function useOfflineModel() {
  const [version, setVersion] = useState(offlineVersion);
  const refresh = useCallback(() => setVersion(offlineVersion()), []);
  return { version, ready: Boolean(version), refresh };
}

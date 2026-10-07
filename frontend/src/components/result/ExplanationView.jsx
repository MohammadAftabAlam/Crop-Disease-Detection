import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Image as ImageIcon, Info, ScanSearch } from "lucide-react";
import AuthImage from "../AuthImage";
import { Alert, Card, Segmented, cx } from "../ui";
import usePreferences from "../../hooks/usePreferences";

// The uploaded photos, plus the Grad-CAM heat map and lesion overlay.
// The overlays are only returned right after a scan; they are not stored.
function ExplanationView({ prediction }) {
  const { t } = usePreferences();
  const explanation = prediction.explanation;
  const photos = prediction.imageUrls || [];

  const [view, setView] = useState(explanation ? "heatmap" : "photo");
  const [photoIndex, setPhotoIndex] = useState(explanation?.imageIndex ?? 0);

  const views = [
    { value: "photo", label: t("explain.photo"), icon: ImageIcon },
    ...(explanation?.heatmap ? [{ value: "heatmap", label: t("explain.heatmap"), icon: Flame }] : []),
    ...(explanation?.lesions ? [{ value: "lesions", label: t("explain.lesions"), icon: ScanSearch }] : []),
  ];

  const showPhoto = (index) => {
    setPhotoIndex(index);
    setView("photo");
  };

  const changeView = (next) => {
    setView(next);

    // The overlays were made from one particular photo
    if (next !== "photo" && explanation) {
      setPhotoIndex(explanation.imageIndex ?? 0);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden p-4 sm:p-5">
        {views.length > 1 && (
          <Segmented options={views} value={view} onChange={changeView} layoutId="explain-view" className="mb-4" />
        )}

        <div className="relative aspect-square max-h-[560px] w-full overflow-hidden rounded-xl bg-surface-2 sm:aspect-[4/3]">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${view}-${photoIndex}`}
              initial={{ opacity: 0, scale: 1.02 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0"
            >
              {view === "photo" && photos[photoIndex] ? (
                <AuthImage src={photos[photoIndex]} alt={t("explain.photoAlt", { n: photoIndex + 1 })} className="size-full object-contain" />
              ) : view === "heatmap" ? (
                <img src={explanation.heatmap} alt={t("explain.heatmapAlt")} className="size-full object-contain" />
              ) : view === "lesions" ? (
                <img src={explanation.lesions} alt={t("explain.lesionsAlt")} className="size-full object-contain" />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {view === "heatmap" && (
          <div className="mt-4 flex items-center gap-3 text-xs text-muted">
            <span>{t("explain.less")}</span>
            {/* Same jet colour map the AI service draws with */}
            <span className="h-2 flex-1 rounded-full bg-[linear-gradient(90deg,#00008f,#0000ff,#00ffff,#ffff00,#ff0000,#800000)]" />
            <span>{t("explain.more")}</span>
          </div>
        )}

        {view === "lesions" && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <span className="size-3 rounded-sm bg-[#dc2626]" />
            {t("explain.lesionLegend")}
          </div>
        )}
      </Card>

      <div className="space-y-5">
        <Card className="p-5">
          <p className="mb-2 flex items-center gap-2 font-bold text-fg">
            <Info className="size-4.5 text-primary" />
            {t(`explain.${view}Title`)}
          </p>
          <p className="text-sm leading-relaxed text-muted">{t(`explain.${view}Text`)}</p>
        </Card>

        {!explanation && prediction.status !== "rejected" && (
          <Alert tone="info" icon={Info}>{t("explain.notStored")}</Alert>
        )}

        {photos.length > 0 && (
          <Card className="p-5">
            <p className="mb-3 text-sm font-bold text-fg">{t("explain.photos", { count: photos.length })}</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((url, index) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => showPhoto(index)}
                  aria-label={t("explain.photoAlt", { n: index + 1 })}
                  className={cx(
                    "aspect-square overflow-hidden rounded-lg ring-2 transition-all",
                    view === "photo" && photoIndex === index ? "ring-primary" : "ring-transparent hover:ring-border"
                  )}
                >
                  <AuthImage src={url} alt="" className="size-full" />
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export default ExplanationView;

import React, { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Image as ImageIcon, Info, ScanSearch } from "lucide-react";
import AuthImage from "../AuthImage";
import { Alert, Card, Segmented, cx } from "../ui";
import usePreferences from "../../hooks/usePreferences";

// The uploaded photos, plus a Grad-CAM heat map and lesion overlay for each photo that was used.
// The overlays are only returned right after a scan; they are not stored.
function ExplanationView({ prediction }) {
  const { t } = usePreferences();
  const explanation = prediction.explanation;
  const photos = prediction.imageUrls || [];

  // One entry per photo that was used (older responses only had the first photo's overlays)
  const overlays = explanation
    ? explanation.images || [{ imageIndex: explanation.imageIndex ?? 0, heatmap: explanation.heatmap, lesions: explanation.lesions }]
    : [];
  const overlayFor = (index) => overlays.find((overlay) => overlay.imageIndex === index);

  const [view, setView] = useState(explanation ? "heatmap" : "photo");
  const [photoIndex, setPhotoIndex] = useState(explanation?.imageIndex ?? 0);
  const current = overlayFor(photoIndex);

  const views = [
    { value: "photo", label: t("explain.photo"), icon: ImageIcon },
    ...(overlays.some((overlay) => overlay.heatmap) ? [{ value: "heatmap", label: t("explain.heatmap"), icon: Flame }] : []),
    ...(overlays.some((overlay) => overlay.lesions) ? [{ value: "lesions", label: t("explain.lesions"), icon: ScanSearch }] : []),
  ];

  // Switching photos keeps the chosen view (photo / heat map / lesions)
  const showPhoto = (index) => setPhotoIndex(index);
  const changeView = (next) => setView(next);
  const overlayImage = view === "heatmap" ? current?.heatmap : view === "lesions" ? current?.lesions : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
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
              {overlayImage ? (
                <img
                  src={overlayImage}
                  alt={t(view === "heatmap" ? "explain.heatmapAlt" : "explain.lesionsAlt")}
                  className="size-full object-contain"
                />
              ) : photos[photoIndex] ? (
                <AuthImage src={photos[photoIndex]} alt={t("explain.photoAlt", { n: photoIndex + 1 })} className="size-full object-contain" />
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        {photos.length > 1 && (
          <p className="mt-3 text-sm font-semibold text-fg tabular">
            {t("result.photoLabel", { n: photoIndex + 1 })}
          </p>
        )}
        {view !== "photo" && !overlayImage && (
          <p className="mt-2 text-sm text-muted">{t(current ? "explain.noLesionsHere" : "explain.noOverlay")}</p>
        )}

        {view === "heatmap" && overlayImage && (
          <div className="mt-4 flex items-center gap-3 text-xs text-muted">
            <span>{t("explain.less")}</span>
            {/* Same jet colour map the AI service draws with */}
            <span className="h-2 flex-1 rounded-full bg-[linear-gradient(90deg,#00008f,#0000ff,#00ffff,#ffff00,#ff0000,#800000)]" />
            <span>{t("explain.more")}</span>
          </div>
        )}

        {view === "lesions" && overlayImage && (
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
                    "relative aspect-square overflow-hidden rounded-lg ring-2 transition-all",
                    photoIndex === index ? "ring-primary" : "ring-transparent hover:ring-border",
                    explanation && !overlayFor(index) && "opacity-60"
                  )}
                >
                  <AuthImage src={url} alt="" className="size-full" />
                  <span className="absolute top-1 left-1 grid size-5 place-items-center rounded-full bg-black/60 text-[11px] font-bold text-white">
                    {index + 1}
                  </span>
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

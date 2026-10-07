import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImagePlus, Plus, Upload, X } from "lucide-react";
import {
  MAX_IMAGE_SIZE,
  MAX_IMAGES,
  SUPPORTED_IMAGE_TYPES,
} from "../utils/constants";
import { formatFileSize } from "../utils/helpers";
import usePreferences from "../hooks/usePreferences";
import { Button, cx } from "./ui";

// Up to MAX_IMAGES photos of the same plant. Calls onImagesChange(files[]).
function ImageUploader({ onImagesChange }) {
  const { t } = usePreferences();

  const [images, setImages] = useState([]);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Free the previews when the page is left
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, []);

  const update = (next) => {
    setImages(next);
    onImagesChange?.(next.map((image) => image.file));
  };

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);

    if (files.length === 0) {
      return;
    }

    const accepted = [];
    let message = "";

    for (const file of files) {
      if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        message = t("upload.badType", { name: file.name });
      } else if (file.size > MAX_IMAGE_SIZE) {
        message = t("upload.tooBig", { name: file.name });
      } else if (images.length + accepted.length >= MAX_IMAGES) {
        message = t("upload.tooMany", { max: MAX_IMAGES });
      } else {
        accepted.push({ file, preview: URL.createObjectURL(file) });
      }
    }

    setError(message);

    if (accepted.length > 0) {
      update([...images, ...accepted]);
    }
  };

  const handleInputChange = (event) => {
    addFiles(event.target.files);
    event.target.value = "";
  };

  const dropHandlers = {
    onDragOver: (event) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: (event) => {
      event.preventDefault();
      setDragging(false);
      addFiles(event.dataTransfer.files);
    },
  };

  const removeImage = (index) => {
    URL.revokeObjectURL(images[index].preview);
    setError("");
    update(images.filter((_, i) => i !== index));
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(",")}
        multiple
        onChange={handleInputChange}
        hidden
      />

      {/* Opens the rear camera directly on phones */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        hidden
      />

      {images.length === 0 ? (
        <div
          {...dropHandlers}
          className={cx(
            "relative flex flex-col items-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          )}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="mb-5 grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25"
          >
            {dragging ? <Upload className="size-8" /> : <ImagePlus className="size-8" />}
          </motion.div>

          <h3 className="text-lg font-bold text-fg">{t("upload.title")}</h3>
          <p className="mt-1.5 max-w-md text-sm text-muted">
            {t("upload.description", { max: MAX_IMAGES })}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button icon={ImagePlus} onClick={() => fileInputRef.current?.click()}>
              {t("upload.choose")}
            </Button>
            <Button variant="secondary" icon={Camera} onClick={() => cameraInputRef.current?.click()}>
              {t("upload.camera")}
            </Button>
          </div>

          <p className="mt-5 text-xs text-subtle">{t("upload.hint")}</p>
        </div>
      ) : (
        <div {...dropHandlers} className={cx("rounded-2xl transition-colors", dragging && "bg-primary/5")}>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-bold text-fg">
              {t("upload.count", { count: images.length, max: MAX_IMAGES })}
            </h3>
            <span className="text-sm text-muted">{t("upload.samePlant")}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {images.map((image, index) => (
                <motion.figure
                  key={image.preview}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border"
                >
                  <img src={image.preview} alt={t("upload.photoAlt", { n: index + 1 })} className="size-full object-cover" />

                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pt-6 pb-2 text-white">
                    <p className="truncate text-xs font-semibold" title={image.file.name}>{image.file.name}</p>
                    <p className="text-[11px] text-white/70">{formatFileSize(image.file.size)}</p>
                  </figcaption>

                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={t("upload.remove", { name: image.file.name })}
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/60 text-white backdrop-blur transition-colors hover:bg-danger"
                  >
                    <X className="size-4" />
                  </button>
                </motion.figure>
              ))}

              {images.length < MAX_IMAGES && (
                <motion.button
                  key="add"
                  layout
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm font-semibold text-muted transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Plus className="size-6" />
                  {t("upload.add")}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

export default ImageUploader;

import React, { useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";
import AssistantPanel from "./AssistantPanel";
import usePreferences from "../../hooks/usePreferences";

// Floating "Ask CropCare AI" button on the result page, and the panel it opens.
// Not shown for photos that were not recognised as a crop leaf: there is nothing to ask about.
function AssistantLauncher({ prediction, title, open, onOpenChange }) {
  const { t } = usePreferences();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  if (prediction.status === "rejected") {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => onOpenChange(true)}
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label={t("chat.open")}
            className="group fixed right-4 bottom-24 z-40 rounded-full p-[1.5px] shadow-[0_10px_40px_-8px_var(--glow)] lg:right-8 lg:bottom-8"
          >
            {/* Rotating gradient border */}
            <span aria-hidden="true" className="absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute -inset-[200%] animate-spin-slow bg-ai-conic motion-reduce:animate-none" />
            </span>

            <span className="relative flex h-13 items-center gap-2.5 rounded-full bg-surface pr-1.5 pl-1.5 lg:pr-5">
              <span className="grid size-10 place-items-center rounded-full bg-ai text-primary-fg">
                <Sparkles className="size-5 transition-transform group-hover:rotate-12" strokeWidth={2.2} />
              </span>
              <span className="hidden text-sm font-bold text-fg lg:inline">{t("chat.open")}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && <AssistantPanel prediction={prediction} title={title} onClose={close} />}
      </AnimatePresence>
    </>
  );
}

export default AssistantLauncher;

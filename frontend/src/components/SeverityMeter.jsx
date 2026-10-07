import React from "react";
import { motion } from "motion/react";
import { TONES, cx } from "./ui";
import { SEVERITY_TONE } from "../utils/prediction";
import usePreferences from "../hooks/usePreferences";

// Severity grade 0-4 as five segments (ai-service/configs/taxonomy.yaml),
// filled up to the grade in the grade's colour.
function SeverityMeter({ severity, showLabel = true }) {
  const { t } = usePreferences();

  if (!severity) {
    return null;
  }

  const grade = Math.min(Math.max(severity.grade ?? 0, 0), 4);
  const tone = SEVERITY_TONE[grade];

  return (
    <div>
      {showLabel && (
        <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <span className="whitespace-nowrap text-muted">{t(`severity.grade${grade}`)}</span>
          <strong className="font-semibold whitespace-nowrap text-fg tabular">
            {t("severity.leafAffected", { percent: Number(severity.percent ?? 0).toFixed(1) })}
          </strong>
        </div>
      )}

      <div className="flex gap-0.5" role="meter" aria-valuemin={0} aria-valuemax={4} aria-valuenow={grade}>
        {[0, 1, 2, 3, 4].map((step) => (
          <div key={step} className={cx("h-2 flex-1 overflow-hidden first:rounded-l-full last:rounded-r-full", TONES[tone].track)}>
            {step <= grade && (
              <motion.div
                className={cx("h-full", TONES[tone].fill)}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                style={{ originX: 0 }}
                transition={{ delay: 0.15 + step * 0.08, duration: 0.3 }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default SeverityMeter;

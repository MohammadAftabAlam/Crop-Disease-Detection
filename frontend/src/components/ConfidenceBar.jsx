import React from "react";
import { motion } from "motion/react";
import { TONES, cx } from "./ui";

// Meter for a percentage (0-100) from the backend. The track is a light step
// of the fill's own colour, so the state reads across the whole bar.
function ConfidenceBar({ value, label, tone = "success", size = "md", showValue = true, className }) {
  const percent = Math.min(Math.max(Number(value) || 0, 0), 100);

  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className={cx("text-muted", showValue && "truncate")}>{label}</span>
          {showValue && <strong className="font-semibold text-fg tabular">{percent.toFixed(1)}%</strong>}
        </div>
      )}

      <div
        className={cx(
          "overflow-hidden rounded-full",
          size === "sm" ? "h-1.5" : "h-2",
          TONES[tone].track
        )}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
      >
        <motion.div
          className={cx("h-full rounded-full", TONES[tone].fill)}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
        />
      </div>
    </div>
  );
}

export default ConfidenceBar;

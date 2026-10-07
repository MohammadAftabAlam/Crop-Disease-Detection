import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, MessageSquareHeart, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { Alert, Button, Card, cx } from "../ui";
import { sendFeedback } from "../../services/predictionService";
import useDiseases from "../../hooks/useDiseases";
import usePreferences from "../../hooks/usePreferences";
import { formatDate } from "../../utils/prediction";

// "Was this right?" - stored with the prediction to measure real-world accuracy
function FeedbackForm({ prediction, onSaved }) {
  const { t, cropName, locale } = usePreferences();
  const { diseases } = useDiseases();
  const existing = prediction.feedback;

  const [correct, setCorrect] = useState(existing ? existing.correct : null);
  const [actualClassId, setActualClassId] = useState(
    existing && !existing.correct ? existing.actualClassId || "other" : ""
  );
  const [comment, setComment] = useState(existing?.comment || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // Same crop first, then the rest, grouped by crop
  const groups = useMemo(() => {
    const byCrop = new Map();

    diseases.forEach((disease) => {
      if (!byCrop.has(disease.crop)) {
        byCrop.set(disease.crop, []);
      }
      byCrop.get(disease.crop).push(disease);
    });

    return [...byCrop.entries()].sort(([a], [b]) =>
      a === prediction.crop ? -1 : b === prediction.crop ? 1 : a.localeCompare(b)
    );
  }, [diseases, prediction.crop]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (correct === null) {
      setError(t("feedback.chooseFirst"));
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await sendFeedback(prediction.id, {
        correct,
        actualClassId: correct ? null : actualClassId || "other",
        comment: comment.trim() || null,
      });

      setSaved(true);
      onSaved?.(data.prediction);
    } catch (err) {
      setError(err.response?.data?.message || t("feedback.failed"));
    } finally {
      setSaving(false);
    }
  };

  const choice = (value, Icon, label) => (
    <button
      type="button"
      onClick={() => {
        setCorrect(value);
        setSaved(false);
      }}
      aria-pressed={correct === value}
      className={cx(
        "flex flex-1 items-center justify-center gap-2.5 rounded-xl px-4 py-4 text-sm font-semibold ring-1 ring-inset transition-all",
        correct === value
          ? value
            ? "bg-success/10 text-fg ring-success/50"
            : "bg-danger/10 text-fg ring-danger/50"
          : "bg-surface-2 text-muted ring-border hover:text-fg"
      )}
    >
      <Icon className={cx("size-5", correct === value && (value ? "text-success" : "text-danger"))} />
      {label}
    </button>
  );

  return (
    <Card className="mx-auto max-w-2xl p-5 sm:p-7">
      <div className="mb-6 flex items-start gap-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
          <MessageSquareHeart className="size-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-fg">{t("feedback.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("feedback.text")}</p>
        </div>
      </div>

      {existing && !saved && (
        <Alert tone="info" icon={CircleCheck} className="mb-5">
          {t(existing.correct ? "feedback.previousYes" : "feedback.previousNo", {
            date: formatDate(existing.at, locale),
          })}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          {choice(true, ThumbsUp, t("feedback.yes"))}
          {choice(false, ThumbsDown, t("feedback.no"))}
        </div>

        <AnimatePresence initial={false}>
          {correct === false && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <label htmlFor="actual-disease" className="mb-2 block text-sm font-semibold text-fg">
                {t("feedback.actual")}
              </label>
              <select
                id="actual-disease"
                value={actualClassId}
                onChange={(event) => setActualClassId(event.target.value)}
                className="h-11 w-full rounded-xl bg-surface-2 px-3 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
              >
                <option value="">{t("feedback.notSure")}</option>
                {groups.map(([crop, items]) => (
                  <optgroup key={crop} label={cropName(crop)}>
                    {items.map((disease) => (
                      <option key={disease.code} value={disease.code}>
                        {cropName(disease.crop)} – {disease.diseaseName}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="other">{t("feedback.other")}</option>
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        <div>
          <label htmlFor="feedback-comment" className="mb-2 block text-sm font-semibold text-fg">
            {t("feedback.comment")} <span className="font-normal text-subtle">({t("feedback.optional")})</span>
          </label>
          <textarea
            id="feedback-comment"
            rows={3}
            maxLength={500}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("feedback.commentPlaceholder")}
            className="w-full resize-none rounded-xl bg-surface-2 p-3 text-sm text-fg ring-1 ring-inset ring-border focus:ring-primary"
          />
          <p className="mt-1 text-right text-xs text-subtle tabular">{comment.length}/500</p>
        </div>

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}

        {saved && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Alert tone="success" icon={CircleCheck} title={t("feedback.thanks")} />
          </motion.div>
        )}

        <Button type="submit" icon={Send} loading={saving} disabled={correct === null} className="w-full sm:w-auto">
          {existing ? t("feedback.update") : t("feedback.submit")}
        </Button>
      </form>
    </Card>
  );
}

export default FeedbackForm;

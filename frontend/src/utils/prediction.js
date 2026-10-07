import {
  CircleCheck,
  CircleHelp,
  CircleSlash,
  CircleDashed,
} from "lucide-react";

// How each diagnosis status from the AI service is shown. Labels are i18n keys.
export const STATUS_INFO = {
  confident: { tone: "success", icon: CircleCheck },
  ambiguous: { tone: "warning", icon: CircleHelp },
  unknown: { tone: "neutral", icon: CircleDashed },
  rejected: { tone: "danger", icon: CircleSlash },
};

export const STATUSES = Object.keys(STATUS_INFO);

export const statusInfo = (status) =>
  STATUS_INFO[status] || STATUS_INFO.unknown;

// Healthy leaves are confident results, but shown in green with their own label
export const isDiseased = (prediction) =>
  ["confident", "ambiguous"].includes(prediction.status) && !prediction.isHealthy;

// Short title for a prediction card; t is the translate function, diseaseName translates the name
export const predictionTitle = (prediction, t, diseaseName = (name) => name) => {
  if (prediction.status === "rejected") {
    return t("result.rejectedTitle");
  }

  if (prediction.status === "unknown") {
    return t(prediction.reason === "no_lesions" ? "result.noLesionsTitle" : "result.unknownTitle");
  }

  return prediction.isHealthy ? t("result.healthyTitle") : diseaseName(prediction.disease);
};

// The prediction's one-line message, in the user's language
export const predictionMessage = (prediction, { t, cropName, diseaseName }, supportedCrops = []) => {
  const crop = cropName(prediction.crop);
  const disease = diseaseName(prediction.disease);

  switch (prediction.status) {
    case "confident":
      return prediction.isHealthy ? t("result.msgHealthy", { crop }) : t("result.msgConfident", { crop, disease });
    case "ambiguous": {
      const options = (prediction.candidates || [])
        .map((c) => `${cropName(c.crop)} ${diseaseName(c.disease)}`)
        .join(` ${t("result.or")} `);
      return t("result.msgAmbiguous", { options: options || `${crop} ${disease}` });
    }
    case "rejected":
      return t("result.msgRejected", { crops: supportedCrops.map(cropName).join(", ") });
    default:
      return t(prediction.reason === "no_lesions" ? "result.msgNoLesions" : "result.msgUnknown");
  }
};

export const URGENCY_TONE = {
  NONE: "success",
  LOW: "success",
  MODERATE: "warning",
  HIGH: "danger",
  UNKNOWN: "neutral",
};

export const RISK_TONE = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "danger",
};

// Severity grade 0-4 (ai-service/configs/taxonomy.yaml)
export const SEVERITY_TONE = ["success", "success", "warning", "danger", "danger"];

// model-info "metrics" is keyed by test set: { plantvillage_test: {...}, plantdoc_test: {...} }
export const testAccuracy = (modelInfo, testSet) => {
  const accuracy = modelInfo?.metrics?.[testSet]?.accuracy;

  return typeof accuracy === "number" ? accuracy : null;
};

export const formatPercent = (fraction) =>
  fraction == null ? "—" : `${(fraction * 100).toFixed(1)}%`;

// "potato__late_blight" -> "Late Blight", when the disease library is not loaded
export const diseaseNameFromCode = (code = "") =>
  code
    .split("__")
    .pop()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const formatDate = (value, locale, withTime = true) => {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime && { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(value));
};

// "Fungus (Alternaria solani)" -> "fungus"; seed pathogens start with their type
export const pathogenType = (pathogen) => {
  const type = pathogen?.split(/[\s(]/)[0]?.toLowerCase();

  return ["fungus", "oomycete", "bacteria", "virus", "pest"].includes(type) ? type : null;
};

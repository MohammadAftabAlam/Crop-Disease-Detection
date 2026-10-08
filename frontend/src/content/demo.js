import leaf from "../assets/landing/leaf.jpg";
import leafSmall from "../assets/landing/leaf-small.jpg";
import heatmap from "../assets/landing/leaf-heatmap.jpg";
import lesions from "../assets/landing/leaf-lesions.jpg";

// Real output of the trained model (ai-service/artifacts/classifier, ConvNeXt-Tiny)
// on the sample photo, produced with Predictor.predict(..., explain=True) on 2026-10-08 (model D).
// Re-run it and update these numbers and images after retraining.
export const DEMO = {
  images: { leaf, leafSmall, heatmap, lesions },
  status: "ambiguous",
  candidates: [
    { crop: "Tomato", disease: "Late Blight", confidence: 78.75 },
    { crop: "Potato", disease: "Late Blight", confidence: 9.81 },
  ],
  severity: { percent: 19.1, grade: 2 },
};

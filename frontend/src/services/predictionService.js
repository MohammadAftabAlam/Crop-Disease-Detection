import api from "./api";

// 1-5 photos of the same plant. lat/lon add a weather risk, explain adds Grad-CAM overlays.
export const predictDisease = async (imageFiles, { lat, lon, explain = true, crop } = {}) => {
  const formData = new FormData();

  imageFiles.forEach((file) => formData.append("images", file));

  if (lat != null && lon != null) {
    formData.append("lat", lat);
    formData.append("lon", lon);
  }

  formData.append("explain", explain);

  // The farmer's crop: the model then chooses only among that crop's diseases
  if (crop) {
    formData.append("crop", crop);
  }

  const response = await api.post("/predictions/detect", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
};

export const getPredictionHistory = async () => {
  const response = await api.get("/predictions/history");
  return response.data;
};

export const getPredictionById = async (predictionId) => {
  const response = await api.get(`/predictions/${predictionId}`);
  return response.data;
};

// Stored photos need the auth header, so they cannot be used as a plain <img src>.
// imageUrl comes from the backend as "/api/predictions/{id}/images/{i}".
export const getPredictionImage = async (imageUrl) => {
  const response = await api.get(imageUrl.replace(/^\/api/, ""), {
    responseType: "blob",
  });

  return response.data;
};

export const sendFeedback = async (predictionId, feedback) => {
  const response = await api.post(
    `/predictions/${predictionId}/feedback`,
    feedback
  );

  return response.data;
};

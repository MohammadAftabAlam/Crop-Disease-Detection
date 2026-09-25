import api from "./api";

export const predictDisease = async (imageFile) => {
  const formData = new FormData();

  formData.append("image", imageFile);

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
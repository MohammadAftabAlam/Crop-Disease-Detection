import api from "./api";

export const getDiseases = async () => {
  const response = await api.get("/diseases");
  return response.data;
};

export const getDiseaseById = async (diseaseId) => {
  const response = await api.get(`/diseases/${diseaseId}`);
  return response.data;
};

export const searchDiseases = async (query) => {
  const response = await api.get(
    `/diseases/search?q=${encodeURIComponent(query)}`
  );

  return response.data;
};
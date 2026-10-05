import api from "./api";

// Model classes and the accuracy measured by ai-service/training/evaluate.py
export const getModelInfo = async () => {
  const response = await api.get("/model/info");
  return response.data;
};

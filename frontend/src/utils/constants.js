export const APP_NAME = "CropCare AI";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Keep in sync with the backend (application.properties + ImageStorage.java)
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  REGISTER: "/register",
  DASHBOARD: "/dashboard",
  DETECT: "/detect",
  RESULT: "/result",
  HISTORY: "/history",
  DISEASES: "/diseases",
  PROFILE: "/profile",
};
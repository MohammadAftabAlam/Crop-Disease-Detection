import api from "./api";

export const registerUser = async (userData) => {
  const response = await api.post("/auth/register", userData);
  return response.data;
};

// Sign-up step 2: the 6-digit code from the email -> { token, user }
export const verifyEmail = async (email, code) => {
  const response = await api.post("/auth/verify-email", { email, code });
  return response.data;
};

export const resendCode = async (email) => {
  const response = await api.post("/auth/resend-code", { email });
  return response.data;
};

export const loginUser = async (userData) => {
  const response = await api.post("/auth/login", userData);
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const logoutUser = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
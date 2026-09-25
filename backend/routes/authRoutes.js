import express from "express";

import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword,
} from "../controllers/authController.js";

import protect from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);

router.post("/login", loginUser);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password/:token", resetPassword);

// Change password - login required
router.post("/change-password", protect, changePassword);

export default router;
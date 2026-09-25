import express from "express";

import {
  detectDisease,
  savePrediction,
  getPredictionHistory,
} from "../controllers/predictionController.js";

import protect from "../middleware/authMiddleware.js";
import upload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Detect disease from uploaded image
router.post(
  "/detect",
  protect,
  upload.single("image"),
  detectDisease
);

// Save a prediction
router.post("/", protect, savePrediction);

// Get logged-in user's prediction history
router.get("/history", protect, getPredictionHistory);

export default router;
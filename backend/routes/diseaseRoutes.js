import express from "express";

import {
  getDiseases,
  getDiseaseById,
  getDiseasesByCrop,
  searchDiseases,
} from "../controllers/diseaseController.js";

const router = express.Router();

// Search diseases
router.get("/search", searchDiseases);

// Get all diseases
router.get("/", getDiseases);

// Get diseases by crop
router.get("/crop/:crop", getDiseasesByCrop);

// Get disease by ID
router.get("/:id", getDiseaseById);

export default router;
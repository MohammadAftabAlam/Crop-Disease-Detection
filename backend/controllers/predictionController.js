import Prediction from "../models/Prediction.js";
import predictDisease from "../services/aiService.js";

// Detect disease from uploaded image
export const detectDisease = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a crop image.",
      });
    }

    const imagePath = req.file.path;

    const result = await predictDisease(imagePath);

    const prediction = await Prediction.create({
      user: req.user._id,
      image: req.file.filename,
      crop: result.crop,
      disease: result.disease,
      confidence: result.confidence,
      remedy: result.remedy,
    });

    res.status(201).json({
      success: true,
      message: "Disease detected successfully.",
      prediction,
    });
  } catch (error) {
    console.error("Prediction Error:", error.message);

    res.status(500).json({
      success: false,
      message: "Disease detection failed.",
      error: error.message,
    });
  }
};

// Get user's prediction history
export const getPredictionHistory = async (req, res) => {
  try {
    const predictions = await Prediction.find({
      user: req.user._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      predictions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch prediction history.",
      error: error.message,
    });
  }
};

export const savePrediction = async (req, res) => {
  try {
    const {
      image,
      crop,
      disease,
      confidence,
      remedy,
    } = req.body;

    const prediction = await Prediction.create({
      user: req.user._id,
      image,
      crop,
      disease,
      confidence,
      remedy,
    });

    res.status(201).json({
      success: true,
      message: "Prediction saved successfully.",
      prediction,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to save prediction.",
      error: error.message,
    });
  }
};
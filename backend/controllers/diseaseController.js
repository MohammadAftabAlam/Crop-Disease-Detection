import Disease from "../models/Disease.js";

// Get all diseases
export const getDiseases = async (req, res) => {
  try {
    const diseases = await Disease.find().sort({ crop: 1 });

    res.status(200).json({
      success: true,
      diseases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch diseases",
      error: error.message,
    });
  }
};

// Search diseases by crop or disease name
export const searchDiseases = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      const diseases = await Disease.find().sort({ crop: 1 });

      return res.status(200).json({
        success: true,
        diseases,
      });
    }

    const diseases = await Disease.find({
      $or: [
        {
          crop: {
            $regex: query,
            $options: "i",
          },
        },
        {
          diseaseName: {
            $regex: query,
            $options: "i",
          },
        },
      ],
    }).sort({ crop: 1 });

    res.status(200).json({
      success: true,
      diseases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to search diseases",
      error: error.message,
    });
  }
};

// Get disease by ID
export const getDiseaseById = async (req, res) => {
  try {
    const disease = await Disease.findById(req.params.id);

    if (!disease) {
      return res.status(404).json({
        success: false,
        message: "Disease not found",
      });
    }

    res.status(200).json({
      success: true,
      disease,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch disease",
      error: error.message,
    });
  }
};

// Get diseases by crop
export const getDiseasesByCrop = async (req, res) => {
  try {
    const diseases = await Disease.find({
      crop: req.params.crop,
    });

    res.status(200).json({
      success: true,
      diseases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch crop diseases",
      error: error.message,
    });
  }
};
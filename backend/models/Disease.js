import mongoose from "mongoose";

const diseaseSchema = new mongoose.Schema(
  {
    crop: {
      type: String,
      required: true,
      trim: true,
    },

    diseaseName: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },

    symptoms: {
      type: [String],
      required: true,
    },

    causes: {
      type: [String],
      required: true,
    },

    remedies: {
      type: [String],
      required: true,
    },

    prevention: {
      type: [String],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Disease = mongoose.model("Disease", diseaseSchema);

export default Disease;
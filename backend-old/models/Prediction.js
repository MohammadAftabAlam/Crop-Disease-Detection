import mongoose from "mongoose";

const predictionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    image: {
      type: String,
      required: true,
    },

    crop: {
      type: String,
      required: true,
    },

    disease: {
      type: String,
      required: true,
    },

    confidence: {
      type: Number,
      required: true,
    },

    remedy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Prediction = mongoose.model("Prediction", predictionSchema);

export default Prediction;
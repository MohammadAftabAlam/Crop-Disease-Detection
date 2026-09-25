import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ImageUploader from "../components/ImageUploader";
import Loader from "../components/Loader";
import { predictDisease } from "../services/predictionService";

function DetectDisease() {
  const navigate = useNavigate();

  const [selectedImage, setSelectedImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Always open Detect Disease page from the top
  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, []);

  const handleImageSelect = (file) => {
    setSelectedImage(file);
    setError("");
  };

  const handleDetection = async () => {
    if (!selectedImage) {
      setError("Please select a crop image first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await predictDisease(selectedImage);

      navigate("/result", {
        state: {
          result,
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to analyze the image. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="detect-page">

      {/* ================= HEADER ================= */}

      <div className="detect-header">
        <h1>🌱 Crop Disease Detection</h1>

        <p>
          Upload a clear image of a crop leaf to identify possible
          diseases using AI.
        </p>
      </div>


      {/* ================= IMAGE UPLOAD / LOADER ================= */}

      {loading ? (
        <Loader message="Our AI model is analyzing your crop image..." />
      ) : (
        <>
          <ImageUploader onImageSelect={handleImageSelect} />

          {error && (
            <div className="detect-error">
              {error}
            </div>
          )}

          <div className="detect-action">
            <button
              type="button"
              onClick={handleDetection}
              className="primary-button"
              disabled={!selectedImage}
            >
              🔬 Analyze Image
            </button>
          </div>
        </>
      )}


      {/* ================= NOTE ================= */}

      <div className="detect-note">

        <h3>
          💡 For better results
        </h3>

        <p>
          Use a clear, well-lit image of the affected leaf and make
          sure the leaf is clearly visible.
        </p>

      </div>

    </div>
  );
}

export default DetectDisease;
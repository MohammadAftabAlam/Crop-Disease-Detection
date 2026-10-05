import React from "react";
import useModelInfo from "../hooks/useModelInfo";

function PredictionCard({
  crop = "Unknown Crop",
  disease = "Unknown Disease",
  confidence = 0,
  remedy = "No remedy information available.",
}) {
  const confidenceValue = Number(confidence);

  // Measured by ai-service/training/evaluate.py; absent until the model is evaluated
  const metrics = useModelInfo()?.metrics;

  return (
    <div className="prediction-card">

      {/* Header */}
      <div className="prediction-header">
        <div>
          <span className="prediction-label">AI Prediction</span>
          <p className="prediction-subtitle">
            Crop health analysis completed
          </p>
        </div>

        <span className="prediction-status">
          Detected
        </span>
      </div>

      {/* Main Content */}
      <div className="prediction-content">

        {/* Visual */}
        <div className="prediction-image">
          <div className="leaf-icon">🌿</div>
          <span>AI Analysis</span>
        </div>

        {/* Details */}
        <div className="prediction-details">

          <div className="crop-info">
            <span>Crop</span>
            <strong>{crop}</strong>
          </div>

          <div className="disease-result">
            <span>Detected Condition</span>
            <h2>{disease}</h2>
          </div>

          {/* Prediction Confidence */}
          <div className="confidence-section">

            <div className="confidence-header">
              <div>
                <span>Prediction Confidence</span>
                <small>
                  Confidence for this image
                </small>
              </div>

              <strong>
                {confidenceValue.toFixed(2)}%
              </strong>
            </div>

            <div className="confidence-track">
              <div
                className="confidence-fill"
                style={{
                  width: `${Math.min(
                    Math.max(confidenceValue, 0),
                    100
                  )}%`,
                }}
              ></div>
            </div>

            <p className="confidence-note">
              This score represents the model's output for this
              particular image and is not the overall model accuracy.
            </p>

          </div>

          {/* Model Accuracy */}
          {metrics && (
            <div className="accuracy-section">

              <div className="accuracy-icon">
                ✓
              </div>

              <div className="accuracy-content">
                <div className="accuracy-header">
                  <span>Model Test Accuracy</span>
                  <strong>{(metrics.accuracy * 100).toFixed(2)}%</strong>
                </div>

                <p className="accuracy-note">
                  Measured on {metrics.num_images.toLocaleString()} held-out
                  images ({metrics.test_set}). Accuracy on real field
                  photos is usually lower.
                </p>
              </div>

            </div>
          )}

          {/* Remedy */}
          <div className="remedy-section">

            <div className="remedy-heading">
              <span className="remedy-icon">✓</span>
              <h3>Recommended Remedy</h3>
            </div>

            <p>{remedy}</p>

          </div>

        </div>

      </div>

    </div>
  );
}

export default PredictionCard;
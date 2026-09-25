import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getPredictionHistory } from "../services/predictionService";
import Loader from "../components/Loader";

function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getPredictionHistory();

        setHistory(data.predictions || data || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load prediction history."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  if (loading) {
    return (
      <div className="history-page">
        <Loader message="Loading your prediction history..." />
      </div>
    );
  }

  return (
    <div className="history-page">

      {/* ================= HEADER ================= */}

      <div className="history-header">
        <div>
          <span className="history-tag">
            PREDICTION RECORDS
          </span>

          <h1>Prediction History</h1>

          <p>
            View your previous crop disease detection results
            and prediction confidence.
          </p>
        </div>

        <div className="history-count">
          <strong>{history.length}</strong>
          <span>
            {history.length === 1
              ? "Prediction"
              : "Predictions"}
          </span>
        </div>
      </div>


      {/* ================= ERROR ================= */}

      {error && (
        <div className="history-error">
          <strong>Unable to load history</strong>
          <p>{error}</p>

          <Link
            to="/detect"
            className="secondary-button"
          >
            Go to Detection
          </Link>
        </div>
      )}


      {/* ================= EMPTY STATE ================= */}

      {!error && history.length === 0 && (
        <div className="history-empty">

          <div className="history-empty-icon">
            📂
          </div>

          <h2>No Predictions Yet</h2>

          <p>
            Your crop disease detection results will appear
            here after you analyze an image.
          </p>

          <Link
            to="/detect"
            className="primary-button"
          >
            🔍 Start Detection
          </Link>

        </div>
      )}


      {/* ================= HISTORY LIST ================= */}

      {!error && history.length > 0 && (
        <div className="history-list">

          {history.map((item) => {
            const confidence = Number(
              item.confidence || 0
            );

            const safeConfidence = Math.min(
              Math.max(confidence, 0),
              100
            );

            return (
              <div
                className="history-card"
                key={item._id || item.id}
              >

                {/* Card Header */}

                <div className="history-card-top">

                  <div className="history-crop">
                    <span className="history-crop-icon">
                      🌱
                    </span>

                    <div>
                      <small>Crop</small>

                      <strong>
                        {item.crop || "Unknown Crop"}
                      </strong>
                    </div>
                  </div>

                  {item.createdAt && (
                    <span className="history-date">
                      {new Date(
                        item.createdAt
                      ).toLocaleString()}
                    </span>
                  )}

                </div>


                {/* Disease */}

                <div className="history-disease">

                  <span>
                    Detected Condition
                  </span>

                  <h2>
                    {item.disease || "Unknown Disease"}
                  </h2>

                </div>


                {/* Confidence */}

                <div className="history-confidence">

                  <div className="history-confidence-header">

                    <span>
                      Prediction Confidence
                    </span>

                    <strong>
                      {confidence.toFixed(2)}%
                    </strong>

                  </div>

                  <div className="history-confidence-track">

                    <div
                      className="history-confidence-fill"
                      style={{
                        width: `${safeConfidence}%`,
                      }}
                    ></div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>
      )}


      {/* ================= BOTTOM ACTION ================= */}

      {!error && history.length > 0 && (
        <div className="history-action">

          <Link
            to="/detect"
            className="primary-button"
          >
            🔍 Analyze Another Image
          </Link>

        </div>
      )}

    </div>
  );
}

export default History;
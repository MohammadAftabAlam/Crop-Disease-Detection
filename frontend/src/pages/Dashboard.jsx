import React from "react";
import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth";

function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1>Welcome{user?.name ? `, ${user.name}` : ""}! 👋</h1>
          <p>
            Use AI to detect possible crop diseases from leaf images.
          </p>
        </div>

        <Link to="/detect" className="primary-button">
          🔍 Detect Disease
        </Link>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="dashboard-card-icon">🔬</div>
          <h3>Disease Detection</h3>
          <p>
            Upload a crop leaf image and get an AI-based disease
            prediction.
          </p>
          <Link to="/detect">Start Detection →</Link>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">📋</div>
          <h3>Prediction History</h3>
          <p>
            View your previous crop disease detection results.
          </p>
          <Link to="/history">View History →</Link>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-icon">📚</div>
          <h3>Disease Information</h3>
          <p>
            Explore information about different crop diseases,
            symptoms and remedies.
          </p>
          <Link to="/diseases">Explore Diseases →</Link>
        </div>
      </div>

      <div className="dashboard-info">
        <h2>How It Works</h2>

        <div className="dashboard-steps">
          <div>
            <span>1</span>
            <h3>Upload</h3>
            <p>Select a clear crop leaf image.</p>
          </div>

          <div>
            <span>2</span>
            <h3>Analyze</h3>
            <p>AI analyzes the image using the trained model.</p>
          </div>

          <div>
            <span>3</span>
            <h3>Result</h3>
            <p>View disease prediction and confidence score.</p>
          </div>

          <div>
            <span>4</span>
            <h3>Remedy</h3>
            <p>View the recommended remedy information.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
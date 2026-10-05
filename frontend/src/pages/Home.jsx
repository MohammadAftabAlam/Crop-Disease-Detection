import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPortal } from "react-dom";
import useModelInfo from "../hooks/useModelInfo";

function Home() {
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Real numbers from training/evaluate.py instead of a hard-coded accuracy
  const modelInfo = useModelInfo();
  const accuracy = modelInfo?.metrics?.accuracy;
  const classCount = modelInfo?.classes?.length || 15;

  const closeFeature = () => {
    setSelectedFeature(null);
  };

  const openFeature = (icon, title, text) => {
    setSelectedFeature({
      icon,
      title,
      text,
    });
  };

  return (
    <div className="home-page">

      {/* ================= HERO SECTION ================= */}

      <section className="hero-section">

        <div className="hero-content">

          <span className="hero-badge">
            ✦ AI-Powered Agriculture
          </span>

          <h1>
            Protect Your Crops
            <br />
            <span>With Smarter AI</span>
          </h1>

          <p>
            Identify crop diseases from leaf images using artificial
            intelligence and get useful information to help manage
            plant health.
          </p>

          <div className="hero-buttons">

            <Link to="/detect" className="primary-button">
              🔍 Detect Disease
            </Link>

            <Link to="/diseases" className="secondary-button">
              Explore Diseases →
            </Link>

          </div>

          <div className="hero-trust">

            <div>
              <strong>
                {typeof accuracy === "number"
                  ? `${(accuracy * 100).toFixed(2)}%`
                  : "—"}
              </strong>
              <span>Lab Test Accuracy</span>
            </div>

            <div>
              <strong>{classCount}</strong>
              <span>Disease Classes</span>
            </div>

            <div>
              <strong>AI</strong>
              <span>Powered Detection</span>
            </div>

          </div>

        </div>


        {/* ================= HERO VISUAL ================= */}

        <div className="hero-visual">

          <div className="hero-glow"></div>

          <div className="plant-card">

            <div className="plant-card-top">
              <span>AI Crop Analysis</span>
              <span className="status-dot"></span>
            </div>

            <div className="plant-visual">
              🌿
            </div>

            <div className="scan-line"></div>

            <div className="analysis-card">

              <div className="analysis-icon">
                ✓
              </div>

              <div>
                <small>AI Analysis</small>
                <strong>Ready to Detect</strong>
              </div>

            </div>

          </div>


          <div className="floating-card floating-card-one">

            <span>🤖</span>

            <div>
              <strong>AI Model</strong>
              <small>MobileNetV2</small>
            </div>

          </div>


          <div className="floating-card floating-card-two">

            <span>🌱</span>

            <div>
              <strong>Crop Health</strong>
              <small>Smart Detection</small>
            </div>

          </div>

        </div>

      </section>


      {/* ================= HOW IT WORKS ================= */}

      <section className="features-section">

        <div className="section-heading">

          <span className="section-tag">
            HOW IT WORKS
          </span>

          <h2>
            Disease detection made
            <span> simple</span>
          </h2>

          <p className="section-description">
            From uploading a leaf image to getting useful disease
            information, CropCare AI keeps the process simple.
          </p>

        </div>


        <div className="feature-grid">

          <div className="feature-card">

            <div className="feature-number">
              01
            </div>

            <div className="feature-icon">
              📷
            </div>

            <h3>
              Upload Image
            </h3>

            <p>
              Upload a clear image of the affected crop leaf.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-number">
              02
            </div>

            <div className="feature-icon">
              🤖
            </div>

            <h3>
              AI Analysis
            </h3>

            <p>
              Our trained AI model analyzes the uploaded image.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-number">
              03
            </div>

            <div className="feature-icon">
              📊
            </div>

            <h3>
              Get Prediction
            </h3>

            <p>
              View the predicted disease and confidence score.
            </p>

          </div>


          <div className="feature-card">

            <div className="feature-number">
              04
            </div>

            <div className="feature-icon">
              💊
            </div>

            <h3>
              Get Remedy
            </h3>

            <p>
              Explore useful information and recommended remedies.
            </p>

          </div>

        </div>

      </section>


      {/* ================= WHY CROPCARE AI ================= */}

      <section className="why-section">

        <div className="why-content">

          <span className="section-tag">
            WHY CROPCARE AI
          </span>

          <h2>
            Technology designed
            <br />
            for <span>healthier crops.</span>
          </h2>

          <p>
            CropCare AI combines computer vision and machine
            learning to make crop disease identification easier
            and more accessible.
          </p>

          <Link
            to="/detect"
            className="primary-button"
          >
            Start Detection →
          </Link>

        </div>


        {/* ================= WHY FEATURES ================= */}

        <div className="why-features">


          {/* AI-BASED ANALYSIS */}

          <div className="why-feature">

            <div className="why-icon">
              🧠
            </div>

            <div className="why-feature-text">

              <h3>
                AI-Based Analysis
              </h3>

              <p>
                Uses a trained deep learning model to analyze
                crop leaf images.
              </p>

            </div>

            <button
              type="button"
              className="why-info-button"
              onClick={() =>
                openFeature(
                  "🧠",
                  "AI-Based Analysis",
                  "CropCare AI uses a trained deep learning model to analyze crop leaf images and identify possible diseases based on visual patterns."
                )
              }
            >
              View
            </button>

          </div>


          {/* QUICK RESULTS */}

          <div className="why-feature">

            <div className="why-icon">
              ⚡
            </div>

            <div className="why-feature-text">

              <h3>
                Quick Results
              </h3>

              <p>
                Get disease predictions after uploading an image
                through the detection system.
              </p>

            </div>

            <button
              type="button"
              className="why-info-button"
              onClick={() =>
                openFeature(
                  "⚡",
                  "Quick Results",
                  "Upload a crop leaf image and the AI system processes the image to generate a disease prediction and confidence score."
                )
              }
            >
              View
            </button>

          </div>


          {/* DISEASE INFORMATION */}

          <div className="why-feature">

            <div className="why-icon">
              📚
            </div>

            <div className="why-feature-text">

              <h3>
                Disease Information
              </h3>

              <p>
                Explore symptoms, causes and recommended remedies
                for supported diseases.
              </p>

            </div>

            <button
              type="button"
              className="why-info-button"
              onClick={() =>
                openFeature(
                  "📚",
                  "Disease Information",
                  "Explore information about supported crop diseases, including symptoms, causes and recommended remedies."
                )
              }
            >
              View
            </button>

          </div>

        </div>

      </section>


      {/* ================= CTA ================= */}

      <section className="home-cta">

        <div className="cta-content">

          <span>
            🌱 Ready to check your crop?
          </span>

          <h2>
            Start your AI-powered
            <br />
            crop health check.
          </h2>

          <p>
            Upload a leaf image and explore what CropCare AI
            can detect.
          </p>

          <Link
            to="/detect"
            className="cta-button"
          >
            🔍 Detect Crop Disease
          </Link>

        </div>

      </section>


      {/* ================= POPUP ================= */}

      {selectedFeature &&
        createPortal(
          <div
            className="feature-modal-overlay"
            onClick={closeFeature}
          >
            <div
              className="feature-modal"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="feature-modal-close"
                onClick={closeFeature}
                aria-label="Close popup"
              >
                ×
              </button>

              <div className="feature-modal-icon">
                {selectedFeature.icon}
              </div>

              <h2>{selectedFeature.title}</h2>

              <p>{selectedFeature.text}</p>

              <button
                type="button"
                className="feature-modal-button"
                onClick={closeFeature}
              >
                Got it
              </button>
            </div>
          </div>,
          document.body
        )}

    </div>
  );
}

export default Home;
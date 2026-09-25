import React from "react";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        <div className="footer-brand">
          <h2>🌱 CropCare AI</h2>
          <p>
            AI-powered crop disease detection to help farmers
            identify plant diseases quickly and efficiently.
          </p>
        </div>

        <div className="footer-links">
          <h3>Quick Links</h3>
          <a href="/">Home</a>
          <a href="/detect">Detect Disease</a>
          <a href="/diseases">Disease Info</a>
          <a href="/history">History</a>
        </div>

        <div className="footer-info">
          <h3>Project</h3>
          <p>AI-Based Crop Disease Detection</p>
          <p>Powered by Machine Learning</p>
          <p>TensorFlow & MobileNetV2</p>
        </div>

      </div>

      <div className="footer-bottom">
        <p>
          © {new Date().getFullYear()} CropCare AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
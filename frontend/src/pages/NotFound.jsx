import React from "react";
import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="not-found-icon">🌱</div>

        <h1>404</h1>

        <h2>Page Not Found</h2>

        <p>
          Sorry, the page you are looking for does not exist.
        </p>

        <Link to="/" className="primary-button">
          🏠 Back to Home
        </Link>
      </div>
    </div>
  );
}

export default NotFound;
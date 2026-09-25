import React from "react";

function Loader({ message = "Analyzing your crop image..." }) {
  return (
    <div className="loader-container">
      <div className="loader-spinner"></div>

      <h3>AI Analysis in Progress</h3>

      <p>{message}</p>

      <span>Please wait while our AI model processes the image.</span>
    </div>
  );
}

export default Loader;
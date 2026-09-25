import React from "react";

function DiseaseCard({
  crop = "Unknown Crop",
  disease = "Unknown Disease",
  description = "No disease description available.",
  symptoms = [],
  remedy = [],
}) {
  const symptomList = Array.isArray(symptoms)
    ? symptoms
    : [symptoms];

  const remedyList = Array.isArray(remedy)
    ? remedy
    : [remedy];

  return (
    <article className="disease-card">

      {/* Card Header */}
      <div className="disease-card-header">

        <div className="disease-crop">
          <span className="disease-crop-icon">
            🌱
          </span>

          <div>
            <small>Crop</small>
            <strong>{crop}</strong>
          </div>
        </div>

      </div>


      {/* Card Content */}
      <div className="disease-card-content">

        <div className="disease-title">
          <span>Detected Disease</span>
          <h2>{disease}</h2>
        </div>


        {/* Description */}
        <div className="disease-section">

          <div className="disease-section-heading">
            <span className="disease-section-icon">
              i
            </span>

            <h3>Description</h3>
          </div>

          <p>{description}</p>

        </div>


        {/* Symptoms */}
        <div className="disease-section">

          <div className="disease-section-heading">
            <span className="disease-section-icon">
              !
            </span>

            <h3>Symptoms</h3>
          </div>

          {symptomList.length > 0 ? (
            <ul className="disease-list">
              {symptomList.map((symptom, index) => (
                <li key={index}>
                  {symptom}
                </li>
              ))}
            </ul>
          ) : (
            <p className="disease-no-data">
              No symptom information available.
            </p>
          )}

        </div>


        {/* Remedy */}
        <div className="disease-section disease-remedy">

          <div className="disease-section-heading">
            <span className="disease-section-icon">
              ✓
            </span>

            <h3>Recommended Remedy</h3>
          </div>

          {remedyList.length > 0 ? (
            <ul className="disease-list">
              {remedyList.map((item, index) => (
                <li key={index}>
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="disease-no-data">
              No remedy information available.
            </p>
          )}

        </div>

      </div>

    </article>
  );
}

export default DiseaseCard;
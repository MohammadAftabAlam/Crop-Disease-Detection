import React, { useEffect, useState } from "react";
import DiseaseCard from "../components/DiseaseCard";
import Loader from "../components/Loader";
import {
  getDiseases,
  searchDiseases,
} from "../services/diseaseService";

function DiseaseInfo() {
  const [diseases, setDiseases] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDiseases = async () => {
      try {
        const data = await getDiseases();

        setDiseases(data.diseases || []);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Unable to load disease information."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDiseases();
  }, []);

  const handleSearch = async (event) => {
    const value = event.target.value;

    setSearch(value);
    setError("");

    if (!value.trim()) {
      try {
        const data = await getDiseases();

        setDiseases(data.diseases || []);
      } catch (err) {
        setError("Unable to load diseases.");
      }

      return;
    }

    try {
      const data = await searchDiseases(value);

      setDiseases(data.diseases || []);
    } catch (err) {
      setError("Unable to search diseases.");
    }
  };

  if (loading) {
    return (
      <div className="disease-info-page">
        <Loader message="Loading crop disease information..." />
      </div>
    );
  }

  return (
    <div className="disease-info-page">

      <div className="disease-info-header">
        <h1>📚 Crop Disease Information</h1>

        <p>
          Explore information about crop diseases, symptoms and
          recommended remedies.
        </p>
      </div>

      <div className="disease-search">
        <input
          type="text"
          placeholder="Search disease or crop..."
          value={search}
          onChange={handleSearch}
        />
      </div>

      {error && (
        <div className="disease-error">
          {error}
        </div>
      )}

      {!error && diseases.length === 0 ? (
        <div className="disease-empty">
          <h2>No Diseases Found</h2>

          <p>
            Try searching with a different crop or disease name.
          </p>
        </div>
      ) : (
        <div className="disease-grid">
          {diseases.map((disease) => (
            <DiseaseCard
              key={disease._id || disease.id}
              crop={disease.crop}
              disease={disease.diseaseName}
              description={disease.description}
              symptoms={disease.symptoms}
              remedy={disease.remedies}
            />
          ))}
        </div>
      )}

    </div>
  );
}

export default DiseaseInfo;
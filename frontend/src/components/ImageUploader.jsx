import React, { useRef, useState } from "react";

function ImageUploader({ onImageSelect }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file.");
      setSelectedImage(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image size must be less than 10 MB.");
      setSelectedImage(null);
      return;
    }

    setError("");

    const imageUrl = URL.createObjectURL(file);

    setSelectedImage({
      file,
      preview: imageUrl,
    });

    if (onImageSelect) {
      onImageSelect(file);
    }
  };

  const handleChooseImage = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveImage = () => {
    if (selectedImage?.preview) {
      URL.revokeObjectURL(selectedImage.preview);
    }

    setSelectedImage(null);
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (onImageSelect) {
      onImageSelect(null);
    }
  };

  return (
    <div className="image-uploader">

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        hidden
      />

      {!selectedImage ? (
        <div className="upload-area">

          <div className="upload-icon">📷</div>

          <h3>Upload Crop Image</h3>

          <p>
            Upload a clear image of the affected crop leaf
            for disease detection.
          </p>

          <button
            type="button"
            onClick={handleChooseImage}
            className="upload-button"
          >
            Choose Image
          </button>

          <span className="upload-hint">
            Supported formats: JPG, JPEG, PNG • Maximum size: 10 MB
          </span>

        </div>
      ) : (
        <div className="image-preview-container">

          <img
            src={selectedImage.preview}
            alt="Selected crop"
            className="image-preview"
          />

          <div className="image-details">
            <h3>Image Selected</h3>

            <p>{selectedImage.file.name}</p>

            <button
              type="button"
              onClick={handleRemoveImage}
              className="remove-button"
            >
              Remove Image
            </button>
          </div>

        </div>
      )}

      {error && <p className="upload-error">{error}</p>}

    </div>
  );
}

export default ImageUploader;
export const formatConfidence = (confidence) => {
  const value = Number(confidence);

  if (isNaN(value)) {
    return "0.00%";
  }

  return `${Math.min(Math.max(value, 0), 100).toFixed(2)}%`;
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) {
    return "0 Bytes";
  }

  const units = ["Bytes", "KB", "MB", "GB"];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));

  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`;
};

export const getInitials = (name = "") => {
  return name
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export const isValidImage = (file) => {
  if (!file) {
    return false;
  }

  return file.type.startsWith("image/");
};
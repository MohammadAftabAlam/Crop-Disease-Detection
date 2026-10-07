import api from "./api";

// Risk for every disease of a crop from the next 3 days' forecast, highest first
export const getWeatherRisk = async (crop, lat, lon) => {
  const response = await api.get("/weather/risk", {
    params: { crop, lat, lon },
  });

  return response.data;
};

// Browser location as { lat, lon }; rejects with a reason key for the UI
export const getCurrentLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: Number(position.coords.latitude.toFixed(4)),
          lon: Number(position.coords.longitude.toFixed(4)),
        }),
      (error) => reject(new Error(error.code === 1 ? "denied" : "unavailable")),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 }
    );
  });

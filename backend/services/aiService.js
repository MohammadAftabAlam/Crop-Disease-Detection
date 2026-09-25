import axios from "axios";
import FormData from "form-data";
import fs from "fs";

const predictDisease = async (imagePath) => {
  try {
    const formData = new FormData();

    formData.append(
      "image",
      fs.createReadStream(imagePath)
    );

    const response = await axios.post(
      `${process.env.AI_SERVICE_URL}/predict`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error(
      "AI Service Error:",
      error.response?.data || error.message
    );

    throw new Error("AI disease prediction failed.");
  }
};

export default predictDisease;
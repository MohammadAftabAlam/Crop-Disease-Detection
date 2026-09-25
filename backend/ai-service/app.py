from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re

from prediction.predict import predict_image


app = Flask(__name__)
CORS(app)


# Disease-wise remedies
REMEDIES = {
    "Pepper___bell___Bacterial_spot":
        "Remove infected leaves and avoid overhead watering. Keep the leaves dry and maintain good field sanitation.",

    "Pepper___bell___healthy":
        "The plant appears healthy. Continue proper watering, sunlight, nutrition, and regular monitoring.",

    "Potato___Early_blight":
        "Remove infected leaves, avoid overhead watering, maintain proper plant spacing, and use suitable disease management practices.",

    "Potato___healthy":
        "The potato plant appears healthy. Continue proper irrigation, nutrition, sunlight, and regular monitoring.",

    "Potato___Late_blight":
        "Remove severely infected plant material, avoid prolonged leaf wetness, improve air circulation, and follow recommended disease management practices.",

    "Tomato_Bacterial_spot":
        "Remove affected leaves, avoid overhead irrigation, improve air circulation, and maintain good field sanitation.",

    "Tomato_Early_blight":
        "Remove infected leaves, avoid overhead watering, maintain proper spacing, and keep the growing area clean.",

    "Tomato_healthy":
        "The tomato plant appears healthy. Continue proper watering, sunlight, nutrition, and regular monitoring.",

    "Tomato_Late_blight":
        "Remove infected plant material, avoid overhead watering, improve air circulation, and follow recommended disease management practices.",

    "Tomato_Leaf_Mold":
        "Improve air circulation, reduce excess humidity, avoid wetting the leaves, and remove severely affected leaves.",

    "Tomato_Septoria_leaf_spot":
        "Remove infected leaves, avoid overhead watering, improve air circulation, and maintain good garden sanitation.",

    "Tomato_Spider_mites_Two_spotted_spider_mite":
        "Inspect the undersides of leaves, remove heavily affected leaves, reduce plant stress, and use appropriate pest management practices.",

    "Tomato___Target_Spot":
        "Remove affected leaves, improve air circulation, avoid overhead watering, and maintain good field sanitation.",

    "Tomato_Target_Spot":
        "Remove affected leaves, improve air circulation, avoid overhead watering, and maintain good field sanitation.",

    "Tomato_Tomato_mosaic_virus":
        "Remove infected plants or plant material, control weeds, disinfect tools, and avoid spreading the virus between plants.",

    "Tomato_Tomato_YellowLeaf__Curl_Virus":
        "Remove severely infected plants, control whitefly populations, remove weeds, and maintain good field sanitation."
}


@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "AI Crop Disease Detection Service is running"
    })


@app.route("/predict", methods=["POST"])
def predict():

    if "image" not in request.files:
        return jsonify({
            "success": False,
            "message": "No image uploaded"
        }), 400

    image = request.files["image"]

    upload_folder = "temp_uploads"
    os.makedirs(upload_folder, exist_ok=True)

    image_path = os.path.join(
        upload_folder,
        image.filename
    )

    image.save(image_path)

    try:
        # Get prediction from trained model
        result = predict_image(image_path)

        disease = result["disease"]

        # Extract crop name
        crop = disease.split("___")[0]

        # Find disease-specific remedy
        if disease == "Tomato___Target_Spot":

            remedy = (
                "Remove affected leaves, improve air circulation, "
                "avoid overhead watering, and maintain good field sanitation."
            )

        else:

            normalized_disease = re.sub(
            r"_+",
            "_",
            disease.strip().replace(" ", "_").lower()
            )

            remedy = None

            for key, value in REMEDIES.items():

                normalized_key = re.sub(
                r"_+",
                "_",
                key.strip().replace(" ", "_").lower()
                )

                if normalized_key == normalized_disease:
                    remedy = value
                    break

            if remedy is None:
                remedy = (
                    "Please consult an agricultural expert "
                    "for appropriate treatment."
                )

        # Debug information
        print("DISEASE REPR:", repr(disease))
        print("REMEDY:", remedy)

        return jsonify({
            "success": True,
            "crop": crop,
            "disease": disease,
            "confidence": result["confidence"],
            "remedy": remedy
        })

    except Exception as error:

        print("Prediction Error:", str(error))

        return jsonify({
            "success": False,
            "message": str(error)
        }), 500

    finally:

        if os.path.exists(image_path):
            os.remove(image_path)


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=8000,
        debug=True
    )
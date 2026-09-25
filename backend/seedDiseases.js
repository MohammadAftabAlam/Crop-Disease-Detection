console.log("SEED FILE STARTED");
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import Disease from "./models/Disease.js";

dotenv.config();

const diseases = [
  {
    crop: "Pepper",
    diseaseName: "Bacterial Spot",
    description: "A bacterial disease that causes spots and lesions on pepper leaves and fruits.",
    symptoms: [
      "Small dark spots on leaves",
      "Yellowing around leaf spots",
      "Lesions on fruits"
    ],
    causes: [
      "Bacterial infection",
      "High humidity",
      "Water splashing between plants"
    ],
    remedies: [
      "Remove infected leaves",
      "Avoid overhead watering",
      "Maintain good field sanitation"
    ],
    prevention: [
      "Use healthy planting material",
      "Avoid excessive leaf wetness",
      "Maintain proper plant spacing"
    ]
  },

  {
    crop: "Pepper",
    diseaseName: "Healthy",
    description: "The pepper plant shows no visible symptoms of the diseases included in the trained model.",
    symptoms: [
      "Healthy green leaves",
      "Normal plant growth",
      "No visible disease spots"
    ],
    causes: [
      "No visible disease detected"
    ],
    remedies: [
      "Continue proper watering and nutrition",
      "Provide sufficient sunlight",
      "Monitor the plant regularly"
    ],
    prevention: [
      "Maintain proper irrigation",
      "Keep the growing area clean",
      "Regularly inspect leaves"
    ]
  },

  {
    crop: "Potato",
    diseaseName: "Early Blight",
    description: "A fungal disease that commonly produces dark spots and lesions on potato leaves.",
    symptoms: [
      "Dark circular spots on leaves",
      "Concentric ring patterns",
      "Yellowing of affected leaves"
    ],
    causes: [
      "Fungal infection",
      "Warm and humid conditions",
      "Poor plant sanitation"
    ],
    remedies: [
      "Remove infected leaves",
      "Avoid overhead watering",
      "Maintain proper plant spacing"
    ],
    prevention: [
      "Practice crop rotation",
      "Remove infected plant debris",
      "Maintain good field sanitation"
    ]
  },

  {
    crop: "Potato",
    diseaseName: "Healthy",
    description: "The potato plant shows no visible symptoms of the diseases included in the trained model.",
    symptoms: [
      "Healthy green foliage",
      "Normal plant development",
      "No visible disease lesions"
    ],
    causes: [
      "No visible disease detected"
    ],
    remedies: [
      "Continue proper irrigation",
      "Provide adequate nutrition",
      "Monitor the crop regularly"
    ],
    prevention: [
      "Use healthy planting material",
      "Maintain field sanitation",
      "Regularly inspect plants"
    ]
  },

  {
    crop: "Potato",
    diseaseName: "Late Blight",
    description: "A serious potato disease that can cause dark lesions on leaves and rapid deterioration of plant tissue.",
    symptoms: [
      "Dark irregular leaf lesions",
      "Brown or black areas on foliage",
      "Rapid leaf deterioration"
    ],
    causes: [
      "Fungal-like pathogen infection",
      "Cool and humid conditions",
      "Prolonged leaf wetness"
    ],
    remedies: [
      "Remove severely infected plant material",
      "Avoid prolonged leaf wetness",
      "Improve air circulation"
    ],
    prevention: [
      "Use healthy planting material",
      "Avoid excessive irrigation",
      "Maintain good field sanitation"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Bacterial Spot",
    description: "A bacterial disease that produces small dark spots on tomato leaves and fruits.",
    symptoms: [
      "Small dark spots on leaves",
      "Yellowing around lesions",
      "Spots on fruits"
    ],
    causes: [
      "Bacterial infection",
      "High humidity",
      "Water splashing"
    ],
    remedies: [
      "Remove affected leaves",
      "Avoid overhead irrigation",
      "Improve air circulation"
    ],
    prevention: [
      "Use healthy seeds",
      "Avoid wetting foliage",
      "Maintain field sanitation"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Early Blight",
    description: "A fungal disease that causes characteristic dark lesions on tomato leaves.",
    symptoms: [
      "Dark spots on older leaves",
      "Concentric ring patterns",
      "Leaf yellowing"
    ],
    causes: [
      "Fungal infection",
      "Warm humid weather",
      "Poor sanitation"
    ],
    remedies: [
      "Remove infected leaves",
      "Avoid overhead watering",
      "Maintain proper plant spacing"
    ],
    prevention: [
      "Practice crop rotation",
      "Remove plant debris",
      "Maintain good air circulation"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Healthy",
    description: "The tomato plant shows no visible symptoms of the diseases included in the trained model.",
    symptoms: [
      "Healthy green leaves",
      "Normal plant growth",
      "No visible disease symptoms"
    ],
    causes: [
      "No visible disease detected"
    ],
    remedies: [
      "Continue proper watering",
      "Provide adequate sunlight",
      "Monitor the plant regularly"
    ],
    prevention: [
      "Maintain good nutrition",
      "Keep the growing area clean",
      "Inspect plants regularly"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Late Blight",
    description: "A serious disease that can cause dark lesions and rapid damage to tomato foliage.",
    symptoms: [
      "Dark irregular lesions",
      "Brown or black patches",
      "Rapid leaf damage"
    ],
    causes: [
      "Pathogen infection",
      "Cool humid conditions",
      "Prolonged leaf moisture"
    ],
    remedies: [
      "Remove infected plant material",
      "Avoid overhead watering",
      "Improve air circulation"
    ],
    prevention: [
      "Maintain field sanitation",
      "Avoid excessive moisture",
      "Regularly inspect plants"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Leaf Mold",
    description: "A fungal disease that commonly develops under humid conditions and affects tomato leaves.",
    symptoms: [
      "Yellow patches on upper leaf surfaces",
      "Mold growth on leaf undersides",
      "Leaf curling or drying"
    ],
    causes: [
      "Fungal infection",
      "High humidity",
      "Poor air circulation"
    ],
    remedies: [
      "Improve air circulation",
      "Reduce excess humidity",
      "Remove severely affected leaves"
    ],
    prevention: [
      "Avoid excessive humidity",
      "Provide proper plant spacing",
      "Avoid wetting leaves"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Septoria Leaf Spot",
    description: "A fungal disease that causes numerous small spots on tomato leaves.",
    symptoms: [
      "Small circular leaf spots",
      "Dark margins around spots",
      "Yellowing and dropping of leaves"
    ],
    causes: [
      "Fungal infection",
      "Moist conditions",
      "Infected plant debris"
    ],
    remedies: [
      "Remove infected leaves",
      "Avoid overhead watering",
      "Maintain good garden sanitation"
    ],
    prevention: [
      "Remove fallen leaves",
      "Practice crop rotation",
      "Improve air circulation"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Spider Mites",
    description: "A pest infestation that can damage tomato leaves by feeding on plant tissues.",
    symptoms: [
      "Tiny yellow or pale spots",
      "Leaf discoloration",
      "Fine webbing on leaves"
    ],
    causes: [
      "Spider mite infestation",
      "Hot and dry conditions",
      "Plant stress"
    ],
    remedies: [
      "Inspect the undersides of leaves",
      "Remove heavily affected leaves",
      "Use appropriate pest management practices"
    ],
    prevention: [
      "Monitor plants regularly",
      "Reduce plant stress",
      "Maintain suitable growing conditions"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Target Spot",
    description: "A fungal disease that produces circular target-like lesions on tomato leaves and plant parts.",
    symptoms: [
      "Circular dark spots",
      "Target-like ring patterns",
      "Leaf yellowing"
    ],
    causes: [
      "Fungal infection",
      "High humidity",
      "Poor air circulation"
    ],
    remedies: [
      "Remove affected leaves",
      "Improve air circulation",
      "Avoid overhead watering"
    ],
    prevention: [
      "Maintain proper plant spacing",
      "Remove infected plant debris",
      "Keep foliage dry"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Mosaic Virus",
    description: "A viral disease that can cause mosaic patterns and abnormal leaf growth in tomato plants.",
    symptoms: [
      "Mosaic patterns on leaves",
      "Light and dark green patches",
      "Distorted leaf growth"
    ],
    causes: [
      "Viral infection",
      "Infected plant material",
      "Contaminated tools or contact"
    ],
    remedies: [
      "Remove infected plants or plant material",
      "Disinfect tools",
      "Control weeds around the crop"
    ],
    prevention: [
      "Use healthy planting material",
      "Disinfect gardening tools",
      "Avoid spreading infection between plants"
    ]
  },

  {
    crop: "Tomato",
    diseaseName: "Yellow Leaf Curl Virus",
    description: "A viral disease that can cause yellowing, curling and stunted growth of tomato leaves.",
    symptoms: [
      "Yellowing of leaves",
      "Upward curling of leaves",
      "Stunted plant growth"
    ],
    causes: [
      "Viral infection",
      "Whitefly transmission",
      "Infected plant material"
    ],
    remedies: [
      "Remove severely infected plants",
      "Control whitefly populations",
      "Remove weeds around the crop"
    ],
    prevention: [
      "Use healthy seedlings",
      "Control insect vectors",
      "Maintain good field sanitation"
    ]
  }
];

const seedDiseases = async () => {
  try {
    await connectDB();

    await Disease.deleteMany({});

    await Disease.insertMany(diseases);

    console.log("Disease data inserted successfully!");
    console.log(`Total diseases inserted: ${diseases.length}`);

    process.exit(0);
  } catch (error) {
    console.error("Error seeding diseases:", error);
    process.exit(1);
  }
};

seedDiseases();
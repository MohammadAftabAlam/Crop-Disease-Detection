import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import diseaseRoutes from "./routes/diseaseRoutes.js";
import predictionRoutes from "./routes/predictionRoutes.js";


dotenv.config();

const app = express();

connectDB();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api/auth", authRoutes);
app.use("/api/diseases", diseaseRoutes);
app.use("/api/predictions", predictionRoutes);

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "AI Crop Disease Detection API is running",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
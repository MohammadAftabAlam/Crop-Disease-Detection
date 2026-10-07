import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcryptjs";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Password validation
const isStrongPassword = (password) => {
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

  return passwordRegex.test(password);
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Register User
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    res.status(201).json({
      message: "User registered successfully",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Registration Error:", error.message);

    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

// Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    const isPasswordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordCorrect) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    res.json({
      message: "Login successful",
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login Error:", error.message);

    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();

    if (!email) {
      return res.status(400).json({
        message: "Please enter your email address.",
      });
    }

    const user = await User.findOne({ email });

    // Do not reveal whether an account exists
    if (!user) {
      return res.status(200).json({
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    // Generate random reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Hash token before storing it
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    user.resetPasswordToken = hashedToken;

    // Token valid for 15 minutes
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;

    await user.save();

    // Reset URL
    const resetUrl = `${
      process.env.FRONTEND_URL || "http://localhost:5173"
    }/reset-password/${resetToken}`;

    // Send reset email
    await transporter.sendMail({
      from: `"CropCare AI" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "CropCare AI - Password Reset",
      html: `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 20px;
          "
        >
          <h2 style="color: #166534;">
            🌱 CropCare AI
          </h2>

          <p>Hello ${user.name},</p>

          <p>
            We received a request to reset your CropCare AI
            account password.
          </p>

          <p>
            Click the button below to create a new password:
          </p>

          <a
            href="${resetUrl}"
            style="
              display: inline-block;
              padding: 12px 20px;
              background: #16a34a;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
            "
          >
            Reset Password
          </a>

          <p style="margin-top: 20px;">
            This link will expire in
            <strong>15 minutes</strong>.
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>
            Regards,<br />
            CropCare AI Team
          </p>
        </div>
      `,
    });

    res.status(200).json({
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error(
      "Forgot Password Error:",
      error.message
    );

    res.status(500).json({
      message:
        "Unable to process password reset request.",
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Please enter a new password.",
      });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Hash token received from reset URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    });

    if (!user) {
      return res.status(400).json({
        message:
          "Password reset link is invalid or has expired.",
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(password, 10);

    // Remove reset token after successful reset
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.status(200).json({
      message:
        "Password reset successfully. You can now login with your new password.",
    });
  } catch (error) {
    console.error(
      "Reset Password Error:",
      error.message
    );

    res.status(500).json({
      message: "Unable to reset password.",
    });
  }
};
// Change Password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message:
          "Current password and new password are required.",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Verify current password
    const isCurrentPasswordCorrect =
      await bcrypt.compare(
        currentPassword,
        user.password
      );

    if (!isCurrentPasswordCorrect) {
      return res.status(400).json({
        message:
          "Current password is incorrect. If you forgot it, use Forgot Password.",
      });
    }

    // Validate new password
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        message:
          "New password must be at least 8 characters and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
      });
    }

    // Prevent same password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (isSamePassword) {
      return res.status(400).json({
        message:
          "New password must be different from your current password.",
      });
    }

    // Hash new password
    user.password = await bcrypt.hash(
      newPassword,
      10
    );

    await user.save();

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error(
      "Change Password Error:",
      error.message
    );

    res.status(500).json({
      message: "Unable to change password.",
    });
  }
};
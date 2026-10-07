import jwt from "jsonwebtoken";
import User from "../models/User.js";

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : null;

    if (!token) {
      return res.status(401).json({
        message: "Not authorized. Please login.",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        message: "User not found.",
      });
    }

    req.user = user;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
};

export default protect;
// Change Password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required.",
      });
    }

    // Find logged-in user with password
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    // Verify current password
    const isCurrentPasswordCorrect = await bcrypt.compare(
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

    // Prevent using the same password
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
    user.password = await bcrypt.hash(newPassword, 10);

    await user.save();

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Change Password Error:", error.message);

    res.status(500).json({
      message: "Unable to change password.",
    });
  }
};
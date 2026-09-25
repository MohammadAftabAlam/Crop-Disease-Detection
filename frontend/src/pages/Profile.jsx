import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { logoutUser } from "../services/authService";
import api from "../services/api";

function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogout = () => {
    logoutUser();
    logout();
    navigate("/login");
  };

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });

    setMessage("");
    setError("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setMessage("");
    setError("");

    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = formData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      setError(
        "New password must be at least 8 characters and include uppercase, lowercase, number and special character."
      );
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(
        "/auth/change-password",
        {
          currentPassword,
          newPassword,
        }
      );

      setMessage(
        response.data.message ||
          "Password changed successfully."
      );

      setFormData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to change password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">

      <div className="profile-card">

        {/* Profile Information */}

        <div className="profile-avatar">
          {user?.name
            ? user.name.charAt(0).toUpperCase()
            : "U"}
        </div>

        <h1>
          {user?.name || "User"}
        </h1>

        <p className="profile-email">
          {user?.email || "No email available"}
        </p>

        <div className="profile-details">

          <div className="profile-detail">
            <span>Name</span>

            <strong>
              {user?.name || "Not available"}
            </strong>
          </div>

          <div className="profile-detail">
            <span>Email</span>

            <strong>
              {user?.email || "Not available"}
            </strong>
          </div>

        </div>

        {/* Change Password */}

        <div className="change-password-section">

          <h2>🔐 Change Password</h2>

          <p className="change-password-description">
            Update your account password securely.
          </p>

          {message && (
            <div className="auth-success">
              {message}
            </div>
          )}

          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword}>

            {/* Current Password */}

            <div className="form-group">
              <label htmlFor="currentPassword">
                Current Password
              </label>

              <div className="password-input-wrapper">

                <input
                  id="currentPassword"
                  type={
                    showCurrentPassword
                      ? "text"
                      : "password"
                  }
                  name="currentPassword"
                  placeholder="Enter current password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowCurrentPassword(
                      !showCurrentPassword
                    )
                  }
                >
                  {showCurrentPassword
                    ? "🙈 Hide"
                    : "👁️ Show"}
                </button>

              </div>
            </div>

            {/* New Password */}

            <div className="form-group">
              <label htmlFor="newPassword">
                New Password
              </label>

              <div className="password-input-wrapper">

                <input
                  id="newPassword"
                  type={
                    showNewPassword
                      ? "text"
                      : "password"
                  }
                  name="newPassword"
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowNewPassword(
                      !showNewPassword
                    )
                  }
                >
                  {showNewPassword
                    ? "🙈 Hide"
                    : "👁️ Show"}
                </button>

              </div>
            </div>

            {/* Confirm Password */}

            <div className="form-group">
              <label htmlFor="confirmPassword">
                Confirm New Password
              </label>

              <div className="password-input-wrapper">

                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword
                    ? "🙈 Hide"
                    : "👁️ Show"}
                </button>

              </div>
            </div>

            <p className="password-hint">
              Must contain 8+ characters, uppercase,
              lowercase, number and special character.
            </p>

            <button
              type="submit"
              className="change-password-button"
              disabled={loading}
            >
              {loading
                ? "Changing Password..."
                : "🔐 Change Password"}
            </button>

          </form>

          <div className="forgot-password-profile">
            <span>Forgot your current password?</span>

            <button
              type="button"
              onClick={() =>
                navigate("/forgot-password")
              }
            >
              Reset Password
            </button>
          </div>

        </div>

        {/* Logout */}

        <button
          type="button"
          className="logout-button"
          onClick={handleLogout}
        >
          🚪 Logout
        </button>

      </div>

    </div>
  );
}

export default Profile;
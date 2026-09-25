import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";

function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">

        <Link to="/" className="navbar-logo">
          🌱 CropCare AI
        </Link>

        <div className="navbar-links">
          <Link to="/">Home</Link>
          <Link to="/detect">Detect Disease</Link>
          <Link to="/diseases">Disease Info</Link>

          {user && <Link to="/history">History</Link>}

          {user ? (
            <>
              <Link to="/profile" className="profile-link">
                👤 Profile
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="logout-button"
              >
                🚪 Logout
              </button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </div>

      </div>
    </nav>
  );
}

export default Navbar;
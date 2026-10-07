import React, {
  createContext,
  useState,
} from "react";

export const AuthContext = createContext();

// Read the saved session before the first render, so pages don't flash
// the logged-out view on reload
const restoreUser = () => {
  try {
    const savedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");

    return savedUser && token ? JSON.parse(savedUser) : null;
  } catch (error) {
    console.error("Failed to restore user session:", error);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    return null;
  }
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(restoreUser);

  const login = (userData, token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(userData));

    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export default AuthProvider;

import React from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { MotionConfig } from "motion/react";

import PublicShell from "./components/layout/PublicShell";
import AuthLayout from "./components/layout/AuthLayout";
import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import DetectDisease from "./pages/DetectDisease";
import Result from "./pages/Result";
import History from "./pages/History";
import DiseaseInfo from "./pages/DiseaseInfo";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

import AuthProvider from "./context/AuthContext";
import PreferencesProvider from "./context/PreferencesContext";

function App() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        {/* Animations are skipped for people who ask their OS for reduced motion */}
        <MotionConfig reducedMotion="user">
          <BrowserRouter>
            <Routes>
              {/* Landing page and 404: top navigation + footer */}
              <Route element={<PublicShell />}>
                <Route path="/" element={<Home />} />
                <Route path="*" element={<NotFound />} />
              </Route>

              {/* Sign-in pages: split screen */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
              </Route>

              {/* The app: sidebar layout */}
              <Route element={<AppShell />}>
                <Route path="/diseases" element={<DiseaseInfo />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/detect" element={<DetectDisease />} />
                  <Route path="/result" element={<Navigate to="/detect" replace />} />
                  <Route path="/result/:id" element={<Result />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/profile" element={<Profile />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </MotionConfig>
      </PreferencesProvider>
    </AuthProvider>
  );
}

export default App;

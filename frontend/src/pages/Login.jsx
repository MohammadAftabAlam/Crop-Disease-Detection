import React, { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CircleAlert, LogIn, Sprout } from "lucide-react";
import AuthHeader from "../components/AuthHeader";
import PasswordField, { TextField } from "../components/PasswordField";
import { Alert, Button } from "../components/ui";
import { loginUser } from "../services/authService";
import useAuth from "../hooks/useAuth";
import usePreferences from "../hooks/usePreferences";

function Login() {
  const { user, login } = useAuth();
  const { t } = usePreferences();
  const location = useLocation();

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Back to the page that asked for a login (see ProtectedRoute)
  if (user) {
    return <Navigate to={location.state?.from || "/dashboard"} replace />;
  }

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const email = formData.email.trim();
    const password = formData.password;

    if (!email || !password) {
      setError(t("auth.missingLogin"));
      return;
    }

    setLoading(true);

    try {
      const data = await loginUser({ email, password });
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || t("auth.loginFailed"));
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHeader icon={Sprout} title={t("auth.loginTitle")} subtitle={t("auth.loginSubtitle")} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          id="email"
          type="email"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          value={formData.email}
          onChange={handleChange}
          autoComplete="email"
          required
        />

        <PasswordField
          id="password"
          label={t("auth.password")}
          value={formData.password}
          onChange={handleChange}
          autoComplete="current-password"
          action={
            <Link to="/forgot-password" className="text-sm font-semibold text-primary hover:underline">
              {t("auth.forgotLink")}
            </Link>
          }
        />

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}

        <Button type="submit" size="lg" icon={LogIn} loading={loading} className="w-full">
          {t("nav.login")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="font-semibold text-primary hover:underline">{t("nav.register")}</Link>
      </p>
    </>
  );
}

export default Login;

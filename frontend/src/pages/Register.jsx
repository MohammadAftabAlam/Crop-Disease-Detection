import React, { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { CircleAlert, UserPlus } from "lucide-react";
import AuthHeader from "../components/AuthHeader";
import PasswordField, { PasswordRules, TextField } from "../components/PasswordField";
import { Alert, Button } from "../components/ui";
import { registerUser } from "../services/authService";
import useAuth from "../hooks/useAuth";
import usePreferences from "../hooks/usePreferences";
import { STRONG_PASSWORD } from "../utils/password";

function Register() {
  const { user, login } = useAuth();
  const { t } = usePreferences();

  const [formData, setFormData] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const name = formData.name.trim();
    const email = formData.email.trim();
    const { password, confirmPassword } = formData;

    if (!name || !email) {
      setError(t("auth.missingRegister"));
      return;
    }

    if (!STRONG_PASSWORD.test(password)) {
      setError(t("profile.weak"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("profile.mismatch"));
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser({ name, email, password });
      login(data.user, data.token);
    } catch (err) {
      setError(err.response?.data?.message || t("auth.registerFailed"));
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHeader icon={UserPlus} title={t("auth.registerTitle")} subtitle={t("auth.registerSubtitle")} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          id="name"
          label={t("auth.name")}
          placeholder={t("auth.namePlaceholder")}
          value={formData.name}
          onChange={handleChange}
          autoComplete="name"
          maxLength={100}
          required
        />

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
          autoComplete="new-password"
        />

        <PasswordField
          id="confirmPassword"
          label={t("auth.confirm")}
          value={formData.confirmPassword}
          onChange={handleChange}
          autoComplete="new-password"
        />

        <PasswordRules value={formData.password} />

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}

        <Button type="submit" size="lg" icon={UserPlus} loading={loading} className="w-full">
          {t("nav.register")}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-semibold text-primary hover:underline">{t("nav.login")}</Link>
      </p>
    </>
  );
}

export default Register;

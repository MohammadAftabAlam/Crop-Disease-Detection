import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, CircleCheck, LockKeyhole } from "lucide-react";
import AuthHeader from "../components/AuthHeader";
import PasswordField, { PasswordRules } from "../components/PasswordField";
import { Alert, Button } from "../components/ui";
import api from "../services/api";
import usePreferences from "../hooks/usePreferences";
import { STRONG_PASSWORD } from "../utils/password";

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { t } = usePreferences();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // After a successful reset, go to the login page
  useEffect(() => {
    if (!message) {
      return undefined;
    }

    const timer = setTimeout(() => navigate("/login"), 2000);
    return () => clearTimeout(timer);
  }, [message, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!password || !confirmPassword) {
      setError(t("auth.missingReset"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("profile.mismatch"));
      return;
    }

    if (!STRONG_PASSWORD.test(password)) {
      setError(t("profile.weak"));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(`/auth/reset-password/${token}`, { password });
      setMessage(response.data.message || t("auth.resetDone"));
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err.response?.data?.message || t("auth.resetFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHeader icon={LockKeyhole} title={t("auth.resetTitle")} subtitle={t("auth.resetSubtitle")} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <PasswordField
          id="new-password"
          label={t("profile.new")}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError("");
          }}
          autoComplete="new-password"
        />

        <PasswordField
          id="confirm-password"
          label={t("profile.confirm")}
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            setError("");
          }}
          autoComplete="new-password"
        />

        <PasswordRules value={password} />

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}
        {message && <Alert tone="success" icon={CircleCheck} title={message}>{t("auth.redirecting")}</Alert>}

        <Button type="submit" size="lg" icon={LockKeyhole} loading={loading} disabled={Boolean(message)} className="w-full">
          {t("auth.resetButton")}
        </Button>
      </form>

      <Link to="/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("auth.backToLogin")}
      </Link>
    </>
  );
}

export default ResetPassword;

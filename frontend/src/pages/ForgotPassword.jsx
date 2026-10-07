import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CircleAlert, MailCheck, Send, KeyRound } from "lucide-react";
import AuthHeader from "../components/AuthHeader";
import { TextField } from "../components/PasswordField";
import { Alert, Button } from "../components/ui";
import api from "../services/api";
import usePreferences from "../hooks/usePreferences";

function ForgotPassword() {
  const { t } = usePreferences();

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setError(t("auth.missingEmail"));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email: trimmedEmail });
      setMessage(response.data.message || t("auth.resetSent"));
      setEmail("");
    } catch (err) {
      setError(err.response?.data?.message || t("auth.requestFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AuthHeader icon={KeyRound} title={t("auth.forgotTitle")} subtitle={t("auth.forgotSubtitle")} />

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          id="email"
          type="email"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          autoComplete="email"
          required
        />

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}
        {message && <Alert tone="success" icon={MailCheck}>{message}</Alert>}

        <Button type="submit" size="lg" icon={Send} loading={loading} className="w-full">
          {t("auth.sendLink")}
        </Button>
      </form>

      <Link to="/login" className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("auth.backToLogin")}
      </Link>
    </>
  );
}

export default ForgotPassword;

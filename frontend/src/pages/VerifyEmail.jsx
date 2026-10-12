import React, { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, MailCheck, RotateCw, ShieldCheck } from "lucide-react";
import AuthHeader from "../components/AuthHeader";
import { Alert, Button, cx } from "../components/ui";
import { resendCode, verifyEmail } from "../services/authService";
import useAuth from "../hooks/useAuth";
import usePreferences from "../hooks/usePreferences";

const LENGTH = 6;

// Sign-up step 2: the 6-digit code from the email. Reached from Register, or from Login when
// the account was never verified (email comes in the navigation state or ?email=).
function VerifyEmail() {
  const { user, login } = useAuth();
  const { t } = usePreferences();
  const location = useLocation();
  const [params] = useSearchParams();
  const email = location.state?.email || params.get("email") || "";

  const [digits, setDigits] = useState(Array(LENGTH).fill(""));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(location.state?.message ? t("auth.verifySent", { email }) : "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(location.state?.resendAfterSeconds ?? 60);
  const boxes = useRef([]);

  useEffect(() => {
    boxes.current[0]?.focus();
  }, []);

  // Resend countdown
  useEffect(() => {
    if (wait <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setWait((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  if (!email) {
    return <Navigate to="/register" replace />;
  }

  // Our own words for the backend's error codes (the backend messages are English only)
  const errorText = (err) => {
    const data = err.response?.data || {};
    switch (data.code) {
      case "CODE_INCORRECT":
        return t("auth.codeIncorrect", { left: data.attemptsLeft });
      case "CODE_EXPIRED":
        return t("auth.codeExpired");
      case "RESEND_TOO_SOON":
        return t("auth.resendTooSoon", { seconds: data.resendAfterSeconds });
      default:
        return data.message || t("auth.verifyFailed");
    }
  };

  const submit = async (code) => {
    if (code.length !== LENGTH || loading) {
      return;
    }
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await verifyEmail(email, code);
      login(data.user, data.token);
    } catch (err) {
      setError(errorText(err));
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
      setLoading(false);
    }
  };

  const fill = (index, value) => {
    const incoming = value.replace(/\D/g, "");
    if (!incoming) {
      const next = [...digits];
      next[index] = "";
      setDigits(next);
      return;
    }
    // Typing one digit, or pasting / autofilling the whole code into any box
    const next = [...digits];
    incoming.slice(0, LENGTH - index).split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setDigits(next);
    setError("");
    const focusAt = Math.min(index + incoming.length, LENGTH - 1);
    boxes.current[focusAt]?.focus();
    if (next.every(Boolean)) {
      submit(next.join(""));
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      boxes.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      boxes.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < LENGTH - 1) {
      boxes.current[index + 1]?.focus();
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError("");
    setNotice("");
    try {
      const data = await resendCode(email);
      setNotice(t("auth.codeResent", { email }));
      setWait(data.resendAfterSeconds || 60);
      setDigits(Array(LENGTH).fill(""));
      boxes.current[0]?.focus();
    } catch (err) {
      setError(errorText(err));
      if (err.response?.data?.resendAfterSeconds) {
        setWait(err.response.data.resendAfterSeconds);
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <>
      <AuthHeader
        icon={MailCheck}
        title={t("auth.verifyTitle")}
        subtitle={t("auth.verifySubtitle", { email })}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(digits.join(""));
        }}
        className="space-y-5"
        noValidate
      >
        <fieldset>
          <legend className="mb-3 text-sm font-semibold text-fg">{t("auth.codeLabel")}</legend>
          <div className="flex justify-between gap-2 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  boxes.current[index] = element;
                }}
                value={digit}
                onChange={(event) => fill(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                onFocus={(event) => event.target.select()}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={index === 0 ? LENGTH : 1}
                aria-label={t("auth.codeDigit", { n: index + 1 })}
                disabled={loading}
                className={cx(
                  "h-14 w-full min-w-0 rounded-xl bg-surface-2 text-center text-2xl font-bold text-fg tabular ring-1 ring-inset transition-shadow focus:ring-2 focus:ring-primary",
                  error ? "ring-danger/60" : "ring-border"
                )}
              />
            ))}
          </div>
        </fieldset>

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}
        {notice && <Alert tone="success" icon={MailCheck}>{notice}</Alert>}

        <Button
          type="submit"
          size="lg"
          icon={ShieldCheck}
          loading={loading}
          disabled={digits.some((digit) => !digit)}
          className="w-full"
        >
          {t("auth.verifyButton")}
        </Button>

        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{t("auth.noCode")}</span>
          {wait > 0 ? (
            <span className="tabular">{t("auth.resendIn", { seconds: wait })}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline disabled:opacity-50"
            >
              <RotateCw className={cx("size-3.5", resending && "animate-spin")} /> {t("auth.resendCode")}
            </button>
          )}
        </div>
        <p className="text-center text-xs text-subtle">{t("auth.checkSpam")}</p>
      </form>

      <Link to="/register" className="mt-8 flex items-center justify-center gap-2 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" /> {t("auth.wrongEmail")}
      </Link>
    </>
  );
}

export default VerifyEmail;

import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  CircleAlert,
  CircleCheck,
  KeyRound,
  Languages,
  LogOut,
  Mail,
  Moon,
  Palette,
  Sun,
  UserRound,
} from "lucide-react";
import { Alert, Button, Card, PageHeader, SectionTitle, Segmented, fadeUp, stagger } from "../components/ui";
import PasswordField, { PasswordRules } from "../components/PasswordField";
import useAuth from "../hooks/useAuth";
import usePreferences from "../hooks/usePreferences";
import { getInitials } from "../utils/helpers";
import api from "../services/api";
import { STRONG_PASSWORD } from "../utils/password";

function ChangePassword() {
  const { t } = usePreferences();

  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    setForm({ ...form, [event.target.name]: event.target.value });
    setMessage("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const { currentPassword, newPassword, confirmPassword } = form;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError(t("profile.fillAll"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t("profile.mismatch"));
      return;
    }

    if (!STRONG_PASSWORD.test(newPassword)) {
      setError(t("profile.weak"));
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/change-password", { currentPassword, newPassword });
      setMessage(response.data.message || t("profile.changed"));
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || t("profile.changeFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-7 lg:col-span-2">
      <SectionTitle icon={KeyRound}>{t("profile.passwordTitle")}</SectionTitle>
      <p className="-mt-2 mb-6 text-sm text-muted">{t("profile.passwordText")}</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <PasswordField
          id="currentPassword"
          label={t("profile.current")}
          value={form.currentPassword}
          onChange={handleChange}
          autoComplete="current-password"
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <PasswordField
            id="newPassword"
            label={t("profile.new")}
            value={form.newPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
          <PasswordField
            id="confirmPassword"
            label={t("profile.confirm")}
            value={form.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </div>

        <PasswordRules value={form.newPassword} />

        {error && <Alert tone="danger" icon={CircleAlert}>{error}</Alert>}
        {message && <Alert tone="success" icon={CircleCheck}>{message}</Alert>}

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" icon={KeyRound} loading={loading}>{t("profile.update")}</Button>
          <Link to="/forgot-password" className="text-sm font-semibold text-muted hover:text-primary">
            {t("profile.forgot")}
          </Link>
        </div>
      </form>
    </Card>
  );
}

function Profile() {
  const { user, logout } = useAuth();
  const { t, theme, toggleTheme, lang, setLang } = usePreferences();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <>
      <PageHeader eyebrow={t("profile.eyebrow")} title={t("profile.title")} description={t("profile.description")} />

      <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <Card as={motion.div} variants={fadeUp} className="p-6 text-center">
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-fg glow">
              {getInitials(user?.name) || <UserRound className="size-8" />}
            </div>
            <h2 className="mt-4 text-xl font-bold text-fg">{user?.name}</h2>
            <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted">
              <Mail className="size-3.5" /> {user?.email}
            </p>
            <Button variant="danger" icon={LogOut} onClick={handleLogout} className="mt-6 w-full">
              {t("nav.logout")}
            </Button>
          </Card>

          <Card as={motion.div} variants={fadeUp} className="space-y-5 p-6">
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
                <Palette className="size-4 text-primary" /> {t("profile.theme")}
              </p>
              <Segmented
                layoutId="profile-theme"
                value={theme}
                onChange={(value) => value !== theme && toggleTheme()}
                options={[
                  { value: "dark", label: t("profile.dark"), icon: Moon },
                  { value: "light", label: t("profile.light"), icon: Sun },
                ]}
              />
            </div>
            <div>
              <p className="mb-3 flex items-center gap-2 text-sm font-bold text-fg">
                <Languages className="size-4 text-primary" /> {t("profile.language")}
              </p>
              <Segmented
                layoutId="profile-lang"
                value={lang}
                onChange={setLang}
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिन्दी" },
                ]}
              />
            </div>
          </Card>
        </div>

        <ChangePassword />
      </motion.div>
    </>
  );
}

export default Profile;

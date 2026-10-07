import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { BookOpen, House, LayoutDashboard, SearchX } from "lucide-react";
import { Button } from "../components/ui";
import useAuth from "../hooks/useAuth";
import usePreferences from "../hooks/usePreferences";

function NotFound() {
  const { user } = useAuth();
  const { t } = usePreferences();

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center sm:py-32">
      <div className="relative mb-10 grid size-28 place-items-center">
        {[0, 1].map((ring) => (
          <motion.span
            key={ring}
            aria-hidden="true"
            className="absolute inset-0 rounded-full border border-primary/40"
            animate={{ scale: [1, 1.5], opacity: [0.6, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: ring * 1.2, ease: "easeOut" }}
          />
        ))}
        <span className="grid size-20 place-items-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/30 glow">
          <SearchX className="size-9" />
        </span>
      </div>

      <p className="text-gradient text-7xl font-extrabold tracking-tight sm:text-8xl">404</p>
      <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{t("notFound.title")}</h1>
      <p className="mt-3 max-w-md text-muted">{t("notFound.text")}</p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button as={Link} to="/" icon={House}>{t("notFound.home")}</Button>
        {user && (
          <Button as={Link} to="/dashboard" variant="secondary" icon={LayoutDashboard}>{t("nav.dashboard")}</Button>
        )}
        <Button as={Link} to="/diseases" variant="secondary" icon={BookOpen}>{t("nav.library")}</Button>
      </div>
    </section>
  );
}

export default NotFound;

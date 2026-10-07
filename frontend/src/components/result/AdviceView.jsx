import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  BookOpen,
  CloudSun,
  ExternalLink,
  FlaskConical,
  Leaf,
  ListChecks,
  PhoneCall,
  ShieldCheck,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { Alert, Badge, Card, EmptyState, SectionTitle, fadeUp, stagger } from "../ui";
import { URGENCY_TONE } from "../../utils/prediction";
import usePreferences from "../../hooks/usePreferences";

const URGENCY_ICON = {
  NONE: ShieldCheck,
  LOW: ShieldCheck,
  MODERATE: TriangleAlert,
  HIGH: Siren,
  UNKNOWN: TriangleAlert,
};

function List({ items, numbered = false }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-sm leading-relaxed text-fg">
          {numbered ? (
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {index + 1}
            </span>
          ) : (
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          )}
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

// Treatment advice from the backend's AdvisoryService (template based, English)
function AdviceView({ advice, classId, showLibraryLink }) {
  const { t } = usePreferences();

  if (!advice) {
    return <EmptyState icon={Leaf} title={t("advice.noneTitle")} description={t("advice.noneText")} />;
  }

  const urgency = advice.urgency || "UNKNOWN";
  const chemicals = advice.chemicalOptions || [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-fg">{advice.headline}</h2>
            {advice.urgencyText && <p className="mt-1 text-muted">{advice.urgencyText}</p>}
          </div>
          <Badge tone={URGENCY_TONE[urgency]} icon={URGENCY_ICON[urgency]} className="self-start">
            {t(`advice.urgency.${urgency}`)}
          </Badge>
        </div>

        {advice.weatherNote && (
          <Alert tone="info" icon={CloudSun} className="mt-5">{advice.weatherNote}</Alert>
        )}

        {showLibraryLink && classId && (
          <Link
            to={`/diseases?disease=${encodeURIComponent(classId)}`}
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <BookOpen className="size-4" /> {t("advice.readMore")}
          </Link>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {advice.immediateActions?.length > 0 && (
          <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
            <SectionTitle icon={ListChecks}>{t("advice.now")}</SectionTitle>
            <List items={advice.immediateActions} numbered />
          </Card>
        )}

        {advice.organicOptions?.length > 0 && (
          <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
            <SectionTitle icon={Leaf}>{t("advice.organic")}</SectionTitle>
            <List items={advice.organicOptions} />
          </Card>
        )}

        {advice.prevention?.length > 0 && (
          <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
            <SectionTitle icon={ShieldCheck}>{t("advice.prevention")}</SectionTitle>
            <List items={advice.prevention} />
          </Card>
        )}

        {(chemicals.length > 0 || advice.chemicalNote) && (
          <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6 lg:col-span-2">
            <SectionTitle icon={FlaskConical}>{t("advice.chemical")}</SectionTitle>

            {chemicals.length > 0 && (
              <div className="-mx-5 mb-4 overflow-x-auto sm:mx-0">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs tracking-wide text-muted uppercase">
                      <th className="px-5 py-2 font-semibold sm:pl-0">{t("advice.ingredient")}</th>
                      <th className="px-3 py-2 font-semibold">{t("advice.dose")}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t("advice.waiting")}</th>
                      <th className="px-5 py-2 font-semibold sm:pr-0">{t("advice.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chemicals.map((chemical) => (
                      <tr key={chemical.activeIngredient} className="border-b border-border/60 last:border-0">
                        <td className="px-5 py-3 font-semibold text-fg sm:pl-0">{chemical.activeIngredient}</td>
                        <td className="px-3 py-3 text-fg">{chemical.dose || "—"}</td>
                        <td className="px-3 py-3 text-right text-fg tabular">
                          {chemical.waitingPeriodDays != null ? t("advice.days", { n: chemical.waitingPeriodDays }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-muted sm:pr-0">{chemical.note || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {advice.chemicalNote && (
              <Alert tone="warning" icon={TriangleAlert}>{advice.chemicalNote}</Alert>
            )}
          </Card>
        )}
      </div>

      {advice.whenToGetHelp && (
        <motion.div variants={fadeUp}>
          <Alert tone="info" icon={PhoneCall} title={t("advice.help")}>{advice.whenToGetHelp}</Alert>
        </motion.div>
      )}

      {advice.sources?.length > 0 && (
        <Card as={motion.div} variants={fadeUp} className="p-5 sm:p-6">
          <SectionTitle icon={BookOpen}>{t("advice.sources")}</SectionTitle>
          <ul className="space-y-2">
            {advice.sources.map((source) => (
              <li key={source.url + source.title}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-start gap-2 text-sm text-muted transition-colors hover:text-primary"
                >
                  <ExternalLink className="mt-0.5 size-3.5 shrink-0" />
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {advice.disclaimer && (
        <p className="text-xs leading-relaxed text-subtle">{advice.disclaimer}</p>
      )}
    </motion.div>
  );
}

export default AdviceView;

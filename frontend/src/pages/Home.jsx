import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleSlash,
  Flame,
  GraduationCap,
  Languages,
  Leaf,
  ListChecks,
  Plus,
  ScanLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import CompareSlider from "../components/landing/CompareSlider";
import HeroDemo from "../components/landing/HeroDemo";
import { Badge, Button, Card, Segmented, TONES, cx, fadeUp, stagger } from "../components/ui";
import useAuth from "../hooks/useAuth";
import useDiseases from "../hooks/useDiseases";
import useModelInfo from "../hooks/useModelInfo";
import usePreferences from "../hooks/usePreferences";
import { DEMO } from "../content/demo";
import { PROJECT } from "../content/project";
import { SUPPORTED_CROPS } from "../utils/constants";
import { formatPercent, testAccuracy } from "../utils/prediction";

// Reveal a section's children one after another as it scrolls into view
const reveal = {
  variants: stagger,
  initial: "hidden",
  whileInView: "show",
  viewport: { once: true, margin: "-80px" },
};

function SectionHeader({ eyebrow, title, highlight, text, center = true }) {
  return (
    <motion.div variants={fadeUp} className={cx("mb-12 max-w-2xl", center && "mx-auto text-center")}>
      <p className="mb-3 text-xs font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
        {title} {highlight && <span className="text-gradient">{highlight}</span>}
      </h2>
      {text && <p className="mt-4 text-lg leading-relaxed text-muted">{text}</p>}
    </motion.div>
  );
}

function Hero() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const modelInfo = useModelInfo();
  const crops = modelInfo?.crops?.length ? modelInfo.crops : SUPPORTED_CROPS;

  const facts = [
    { icon: Leaf, text: t("landing.factCrops", { count: crops.length }) },
    { icon: ScanSearch, text: t("landing.factExplain") },
    { icon: Languages, text: t("landing.factLanguages") },
  ];

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-16 px-4 pt-10 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-20 lg:pb-28">
      <motion.div variants={stagger} initial="hidden" animate="show">
        <motion.span
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary ring-1 ring-primary/25"
        >
          <Sparkles className="size-3.5" /> {t("landing.heroBadge")}
        </motion.span>

        <motion.h1
          variants={fadeUp}
          className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-fg sm:text-5xl lg:text-6xl"
        >
          {t("dashboard.heroTitle")} <span className="text-gradient">{t("dashboard.heroHighlight")}</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          {t("landing.heroText")}
        </motion.p>

        <motion.div variants={fadeUp} className="mt-9 flex flex-wrap gap-3">
          {user ? (
            <Button as={Link} to="/detect" size="lg" icon={ScanLine}>{t("dashboard.scanNow")}</Button>
          ) : (
            <Button as={Link} to="/register" size="lg" icon={ScanLine}>{t("landing.ctaStart")}</Button>
          )}
          <Button as={Link} to="/#how" size="lg" variant="secondary">
            {t("landing.ctaHow")} <ArrowRight className="size-4" />
          </Button>
        </motion.div>

        <motion.ul variants={fadeUp} className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted">
          {facts.map((fact) => (
            <li key={fact.text} className="flex items-center gap-2">
              <fact.icon className="size-4 text-primary" /> {fact.text}
            </li>
          ))}
        </motion.ul>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24, rotate: 1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        <HeroDemo />
      </motion.div>
    </section>
  );
}

function HowItWorks() {
  const { t } = usePreferences();

  const steps = [
    { icon: Camera, title: "landing.step1Title", text: "landing.step1Text" },
    { icon: ShieldCheck, title: "landing.step2Title", text: "landing.step2Text" },
    { icon: ScanSearch, title: "landing.step3Title", text: "landing.step3Text" },
    { icon: ListChecks, title: "landing.step4Title", text: "landing.step4Text" },
  ];

  return (
    <motion.section id="how" {...reveal} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <SectionHeader
        eyebrow={t("landing.howEyebrow")}
        title={t("landing.howTitle")}
        highlight={t("landing.howHighlight")}
        text={t("landing.howText")}
      />

      <div className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Line joining the steps on wide screens */}
        <div aria-hidden="true" className="absolute top-12 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent lg:block" />

        {steps.map((step, index) => (
          <Card as={motion.div} key={step.title} variants={fadeUp} className="relative p-6">
            <div className="flex items-center justify-between">
              <span className="relative grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
                <step.icon className="size-6" />
              </span>
              <span className="text-4xl font-extrabold text-surface-3">0{index + 1}</span>
            </div>
            <h3 className="mt-5 text-lg font-bold text-fg">{t(step.title)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t(step.text)}</p>
          </Card>
        ))}
      </div>
    </motion.section>
  );
}

function ExplainableAI() {
  const { t } = usePreferences();
  const [view, setView] = useState("heatmap");

  const points = view === "heatmap"
    ? ["landing.explainHeat1", "landing.explainHeat2", "landing.explainHeat3"]
    : ["landing.explainLesion1", "landing.explainLesion2", "landing.explainLesion3"];

  return (
    <motion.section id="explain" {...reveal} className="scroll-mt-24 border-y border-border bg-surface/40 py-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <SectionHeader
            center={false}
            eyebrow={t("landing.explainEyebrow")}
            title={t("landing.explainTitle")}
            highlight={t("landing.explainHighlight")}
            text={t("landing.explainText")}
          />

          <motion.div variants={fadeUp}>
            <Segmented
              layoutId="landing-explain"
              value={view}
              onChange={setView}
              options={[
                { value: "heatmap", label: t("explain.heatmap"), icon: Flame },
                { value: "lesions", label: t("explain.lesions"), icon: ScanSearch },
              ]}
            />

            <AnimatePresence mode="wait">
              <motion.ul
                key={view}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className="mt-6 space-y-3"
              >
                {points.map((key) => (
                  <li key={key} className="flex gap-3 text-fg">
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    {t(key)}
                  </li>
                ))}
              </motion.ul>
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div variants={fadeUp}>
          <Card className="p-3">
            <CompareSlider
              before={DEMO.images.leafSmall}
              after={view === "heatmap" ? DEMO.images.heatmap : DEMO.images.lesions}
              beforeLabel={t("explain.photo")}
              afterLabel={t(view === "heatmap" ? "explain.heatmap" : "explain.lesions")}
              alt={t("landing.demoAlt")}
              label={t("landing.sliderLabel")}
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-3 pb-1 text-xs text-muted">
              {view === "heatmap" ? (
                <span className="flex flex-1 items-center gap-3">
                  {t("explain.less")}
                  <span className="h-2 max-w-48 flex-1 rounded-full bg-[linear-gradient(90deg,#00008f,#0000ff,#00ffff,#ffff00,#ff0000,#800000)]" />
                  {t("explain.more")}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <span className="size-3 rounded-sm bg-[#dc2626]" /> {t("explain.lesionLegend")}
                </span>
              )}
              <span className="text-subtle">{t("landing.demoCaption")}</span>
            </div>
          </Card>
        </motion.div>
      </div>
    </motion.section>
  );
}

function HonestModel() {
  const { t, cropName } = usePreferences();
  const modelInfo = useModelInfo();
  const { diseases } = useDiseases();

  const lab = testAccuracy(modelInfo, "plantvillage_test");
  const field = testAccuracy(modelInfo, "plantdoc_test");
  const crops = modelInfo?.crops?.length ? modelInfo.crops : SUPPORTED_CROPS;

  // Diseases per crop in the library (healthy entries left out)
  const counts = useMemo(() => {
    const result = {};
    diseases
      .filter((disease) => disease.diseaseName?.toLowerCase() !== "healthy")
      .forEach((disease) => {
        result[disease.crop] = (result[disease.crop] || 0) + 1;
      });
    return result;
  }, [diseases]);

  const answers = [
    { status: "confident", icon: CircleCheck },
    { status: "ambiguous", icon: CircleHelp },
    { status: "unknown", icon: CircleDashed },
    { status: "rejected", icon: CircleSlash },
  ];
  const tones = { confident: "success", ambiguous: "warning", unknown: "neutral", rejected: "danger" };

  return (
    <motion.section id="model" {...reveal} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <SectionHeader
        eyebrow={t("landing.modelEyebrow")}
        title={t("landing.modelTitle")}
        highlight={t("landing.modelHighlight")}
        text={t("landing.modelText")}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card as={motion.div} variants={fadeUp} className="p-6 sm:p-8">
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <Target className="size-5 text-primary" /> {t("landing.accuracyTitle")}
          </h3>

          {lab != null || field != null ? (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-surface-2 p-5 ring-1 ring-inset ring-border">
                <p className="text-4xl font-bold tracking-tight text-fg sm:text-5xl">{formatPercent(lab)}</p>
                <p className="mt-2 text-sm text-muted">{t("dashboard.labAccuracy")}</p>
              </div>
              <div className="rounded-2xl bg-surface-2 p-5 ring-1 ring-inset ring-border">
                <p className="text-4xl font-bold tracking-tight text-fg sm:text-5xl">{formatPercent(field)}</p>
                <p className="mt-2 text-sm text-muted">{t("dashboard.fieldAccuracy")}</p>
              </div>
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-surface-2 p-5 text-sm text-muted ring-1 ring-inset ring-border">
              {t("landing.accuracyOffline")}
            </p>
          )}

          <p className="mt-5 text-sm leading-relaxed text-muted">{t("dashboard.accuracyNote")}</p>
        </Card>

        <Card as={motion.div} variants={fadeUp} className="p-6 sm:p-8">
          <h3 className="flex items-center gap-2 font-bold text-fg">
            <ShieldCheck className="size-5 text-primary" /> {t("landing.answersTitle")}
          </h3>
          <ul className="mt-6 space-y-4">
            {answers.map((answer) => (
              <li key={answer.status} className="flex gap-3">
                <span className={cx("grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset", TONES[tones[answer.status]].soft)}>
                  <answer.icon className={cx("size-4.5", TONES[tones[answer.status]].text)} />
                </span>
                <div>
                  <p className="font-semibold text-fg">{t(`status.${answer.status}.label`)}</p>
                  <p className="text-sm text-muted">{t(`landing.answer_${answer.status}`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <motion.div variants={fadeUp} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {crops.map((crop) => (
          <Link
            key={crop}
            to={`/diseases?crop=${encodeURIComponent(crop)}`}
            className="group rounded-2xl border border-border bg-surface/80 p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
          >
            <Leaf className="size-5 text-primary transition-transform group-hover:rotate-12" />
            <p className="mt-3 font-bold text-fg">{cropName(crop)}</p>
            <p className="text-xs text-muted">
              {counts[crop] === 1
                ? t("landing.diseaseCountOne")
                : counts[crop]
                  ? t("landing.diseaseCount", { count: counts[crop] })
                  : t("nav.library")}
            </p>
          </Link>
        ))}
      </motion.div>
    </motion.section>
  );
}

function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-5 text-left font-semibold text-fg"
      >
        {question}
        <motion.span animate={{ rotate: open ? 45 : 0 }} className="grid size-7 shrink-0 place-items-center rounded-full ring-1 ring-inset ring-border">
          <Plus className="size-4" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectAndFaq() {
  const { t } = usePreferences();

  const details = [
    { label: "landing.team", value: PROJECT.team.join(", ") },
    { label: "landing.guide", value: PROJECT.guide },
    { label: "landing.department", value: PROJECT.department },
    { label: "landing.college", value: PROJECT.college },
    { label: "landing.batchLabel", value: PROJECT.batch },
  ].filter((detail) => detail.value);

  const faqs = [1, 2, 3, 4, 5, 6];

  return (
    <motion.section id="faq" {...reveal} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 sm:px-6">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <motion.div variants={fadeUp}>
          <p className="mb-3 text-xs font-bold tracking-[0.18em] text-primary uppercase">{t("landing.projectEyebrow")}</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{PROJECT.name}</h2>
          <p className="mt-4 leading-relaxed text-muted">{t("landing.projectText")}</p>

          <Card className="mt-8 p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/25">
                <GraduationCap className="size-5" />
              </span>
              <p className="font-bold text-fg">{t("landing.projectCard")}</p>
            </div>
            <dl className="space-y-3 text-sm">
              {details.map((detail) => (
                <div key={detail.label} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                  <dt className="w-28 shrink-0 text-subtle">{t(detail.label)}</dt>
                  <dd className="font-semibold text-fg">{detail.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              {PROJECT.stack.map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={fadeUp}>
          <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-fg">{t("landing.faqTitle")}</h2>
          <Card className="px-6">
            {faqs.map((n) => (
              <FaqItem key={n} question={t(`landing.faq${n}q`)} answer={t(`landing.faq${n}a`)} />
            ))}
          </Card>
        </motion.div>
      </div>
    </motion.section>
  );
}

function FinalCta() {
  const { user } = useAuth();
  const { t } = usePreferences();

  return (
    <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl border border-primary/30 bg-surface p-8 text-center sm:p-14"
      >
        <div aria-hidden="true" className="absolute -top-24 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">
            {t("landing.ctaTitle")} <span className="text-gradient">{t("landing.ctaHighlight")}</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted">{t("landing.ctaText")}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {user ? (
              <Button as={Link} to="/detect" size="lg" icon={ScanLine}>{t("dashboard.scanNow")}</Button>
            ) : (
              <>
                <Button as={Link} to="/register" size="lg" icon={ScanLine}>{t("landing.ctaStart")}</Button>
                <Button as={Link} to="/login" size="lg" variant="secondary">{t("nav.login")}</Button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <ExplainableAI />
      <HonestModel />
      <ProjectAndFaq />
      <FinalCta />
    </>
  );
}

export default Home;

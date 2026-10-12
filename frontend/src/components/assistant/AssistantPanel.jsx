import React, { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Apple,
  ArrowDown,
  Bug,
  CalendarClock,
  Camera,
  CircleAlert,
  Droplets,
  Eye,
  Info,
  ListChecks,
  PhoneCall,
  RotateCw,
  ScanSearch,
  ShieldCheck,
  Sprout,
  X,
} from "lucide-react";
import AiAvatar from "./AiAvatar";
import Composer from "./Composer";
import { AssistantMessage, ThinkingMessage, UserMessage } from "./ChatMessage";
import AuthImage from "../AuthImage";
import { Skeleton, cx } from "../ui";
import { askQuestion, getChat } from "../../services/predictionService";
import useAuth from "../../hooks/useAuth";
import useIsDesktop from "../../hooks/useIsDesktop";
import usePreferences from "../../hooks/usePreferences";
import useReadAloud from "../../hooks/useReadAloud";

// Tap-to-ask questions, chosen by what the scan found
const SUGGESTION_ICONS = {
  spread: Sprout,
  firstStep: ListChecks,
  nextSeason: CalendarClock,
  safeToEat: Apple,
  confirm: ScanSearch,
  photos: Camera,
  insects: Bug,
  whoToAsk: PhoneCall,
  healthyKeep: ShieldCheck,
  healthyWatch: Eye,
  healthyWater: Droplets,
  healthyNext: CalendarClock,
};

function suggestionKeys(prediction) {
  if (prediction.status === "confident" && prediction.isHealthy) {
    return ["healthyKeep", "healthyWatch", "healthyWater", "healthyNext"];
  }
  if (prediction.status === "confident") {
    return ["spread", "firstStep", "nextSeason", "safeToEat"];
  }
  return ["confirm", "photos", "insects", "whoToAsk"];
}

// Being near the bottom keeps the view following new text
const NEAR_BOTTOM = 80;

function Welcome({ prediction, suggestions, onAsk, disabled }) {
  const { t, cropName, diseaseName } = usePreferences();
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0];

  let greeting;
  if (prediction.status === "confident" && prediction.isHealthy) {
    greeting = t("chat.greetingHealthy", { crop: cropName(prediction.crop) });
  } else if (prediction.status === "confident") {
    greeting = t("chat.greetingDisease", { disease: diseaseName(prediction.disease) });
  } else {
    greeting = t("chat.greetingUnsure");
  }

  return (
    <div className="flex min-h-full flex-col justify-center py-4">
      <AiAvatar size="lg" className="mb-6" />
      <p className="text-gradient text-2xl font-extrabold tracking-tight">
        {firstName ? t("chat.hello", { name: firstName }) : t("chat.helloAnon")}
      </p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-fg">{greeting}</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">{t("chat.text")}</p>

      <div className="mt-6 grid gap-2.5 sm:grid-cols-2" aria-label={t("chat.suggestions")}>
        {suggestions.map((key, index) => {
          const Icon = SUGGESTION_ICONS[key] || Sprout;
          return (
            <motion.button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onAsk(t(`chat.suggest.${key}`))}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.06 }}
              className="group flex flex-col gap-3 rounded-2xl bg-surface-2/70 p-4 text-left text-sm font-medium text-fg ring-1 ring-inset ring-border transition-all hover:-translate-y-0.5 hover:bg-surface-2 hover:ring-primary/40 disabled:pointer-events-none disabled:opacity-50"
            >
              <Icon className="size-4.5 text-primary transition-transform group-hover:scale-110" />
              {t(`chat.suggest.${key}`)}
            </motion.button>
          );
        })}
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" /> {t("chat.disclaimer")}
      </p>
    </div>
  );
}

// CropCare AI: follow-up questions about one scan, answered by the backend (Gemini)
function AssistantPanel({ prediction, title, onClose }) {
  const { t, cropName } = usePreferences();
  const isDesktop = useIsDesktop();
  const readAloud = useReadAloud();

  const [chat, setChat] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(null);
  const [failed, setFailed] = useState(null);
  const [typingId, setTypingId] = useState(null);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const atBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior = "smooth") => {
    const element = scrollRef.current;
    if (element) {
      element.scrollTo({ top: element.scrollHeight, behavior });
    }
  }, []);

  useEffect(() => {
    let active = true;
    getChat(prediction.id)
      .then((data) => active && setChat(data.chat))
      .catch((err) => active && setLoadError(err.response?.data?.message || t("chat.loadFailed")));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prediction.id]);

  // Esc closes; on phones the panel is full screen, so the page behind must not scroll
  useEffect(() => {
    const onKey = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);

    const overflow = document.body.style.overflow;
    if (!isDesktop) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, isDesktop]);

  // Open at the latest message (the welcome screen starts at the top), ready to type;
  // not on phones, where the keyboard would cover the welcome
  useEffect(() => {
    if (chat) {
      if (chat.messages.length > 0) {
        scrollToBottom("instant");
      }
      if (isDesktop) {
        inputRef.current?.focus();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(chat)]);

  useEffect(() => {
    if (pending || failed) {
      scrollToBottom();
    }
  }, [pending, failed, scrollToBottom]);

  const handleScroll = () => {
    const element = scrollRef.current;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < NEAR_BOTTOM;
    atBottomRef.current = near;
    setAtBottom(near);
  };

  // Keep following the answer while it types out, unless the farmer scrolled up to read
  const handleTypingProgress = useCallback(
    (done) => {
      if (atBottomRef.current) {
        scrollToBottom("instant");
      }
      if (done) {
        setTypingId(null);
      }
    },
    [scrollToBottom]
  );

  const send = async (text) => {
    const value = text.trim();
    if (!value || pending) {
      return;
    }

    setFailed(null);
    setPending(value);
    setQuestion("");
    atBottomRef.current = true;

    try {
      const data = await askQuestion(prediction.id, value);
      const answer = [...data.chat.messages].reverse().find((message) => message.role === "assistant");
      setTypingId(answer?.id ?? null);
      setChat(data.chat);
    } catch (err) {
      setFailed({ text: value, message: err.response?.data?.message || t("chat.failed") });
    } finally {
      setPending(null);
    }
  };

  const messages = chat?.messages || [];
  const maxChars = chat?.maxQuestionChars || 300;
  const outOfQuestions = chat && (chat.remainingToday <= 0 || chat.remainingForScan <= 0);
  const canAsk = chat?.enabled && !outOfQuestions;
  const suggestions = suggestionKeys(prediction);

  // Follow-up ideas: the suggested questions not asked yet
  const askedTexts = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));
  const followUps = suggestions.filter((key) => !askedTexts.has(t(`chat.suggest.${key}`))).slice(0, 3);

  const showWelcome = chat?.enabled && messages.length === 0 && !pending && !failed;
  const busy = Boolean(pending) || typingId !== null;
  const statusLabel =
    prediction.status === "confident" && prediction.isHealthy ? t("status.healthy") : t(`status.${prediction.status}.short`);

  return (
    <motion.div
      role="dialog"
      aria-modal={!isDesktop}
      aria-label={t("chat.name")}
      initial={isDesktop ? { opacity: 0, x: 24, scale: 0.98 } : { y: "100%" }}
      animate={isDesktop ? { opacity: 1, x: 0, scale: 1 } : { y: 0 }}
      exit={isDesktop ? { opacity: 0, x: 24, scale: 0.98 } : { y: "100%" }}
      transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg lg:inset-auto lg:top-4 lg:right-4 lg:bottom-4 lg:w-[440px] lg:rounded-3xl lg:border lg:border-border lg:bg-surface/95 lg:shadow-2xl lg:backdrop-blur-xl"
    >
      {/* Soft AI glow along the top */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-ai opacity-[0.07] blur-2xl" />

      {/* Header */}
      <header className="relative flex items-center gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <AiAvatar size="md" thinking={Boolean(pending)} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-fg">{t("chat.name")}</p>
          <p className="flex items-center gap-1.5 truncate text-xs text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-success" /> {t("chat.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("chat.close")}
          title={t("chat.close")}
          className="grid size-9 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <X className="size-5" />
        </button>
      </header>

      {/* What the assistant knows about */}
      <div className="relative border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-2 pr-3 ring-1 ring-inset ring-border">
          {prediction.imageUrls?.[0] ? (
            <AuthImage src={prediction.imageUrls[0]} alt="" className="size-10 shrink-0 rounded-xl" />
          ) : (
            <span className="size-10 shrink-0 rounded-xl bg-surface-3" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-wider text-subtle uppercase">{t("chat.about")}</p>
            <p className="truncate text-sm font-semibold text-fg">
              {prediction.crop ? `${cropName(prediction.crop)} · ` : ""}{title}
            </p>
          </div>
          <span className="shrink-0 text-right text-xs text-muted">
            {statusLabel}
            {prediction.confidence != null && <span className="block font-semibold text-fg tabular">{Number(prediction.confidence).toFixed(0)}%</span>}
          </span>
        </div>
      </div>

      {/* Conversation */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          role="log"
          aria-live="polite"
          aria-busy={busy}
          className="h-full space-y-7 overflow-y-auto px-4 py-6 [mask-image:linear-gradient(to_bottom,transparent,black_24px)] sm:px-5"
        >
          {!chat && !loadError && (
            <div className="space-y-4">
              <Skeleton className="size-16 rounded-full" />
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="grid grid-cols-2 gap-2.5">
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            </div>
          )}

          {loadError && (
            <p className="flex items-start gap-2 rounded-2xl bg-danger/10 p-4 text-sm text-fg ring-1 ring-inset ring-danger/25">
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> {loadError}
            </p>
          )}

          {chat && !chat.enabled && (
            <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
              <AiAvatar size="lg" className="mb-5 opacity-60" />
              <p className="font-bold text-fg">{t(`chat.disabled.${chat.reason}`)}</p>
              <p className="mt-2 max-w-xs text-sm text-muted">{t(`chat.disabledText.${chat.reason}`)}</p>
            </div>
          )}

          {showWelcome && (
            <Welcome prediction={prediction} suggestions={suggestions} onAsk={send} disabled={!canAsk} />
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage key={message.id} text={message.text} />
            ) : (
              <AssistantMessage
                key={message.id}
                message={message}
                typing={message.id === typingId}
                onTypingProgress={message.id === typingId ? handleTypingProgress : undefined}
                readAloud={readAloud}
              />
            )
          )}

          {pending && (
            <>
              <UserMessage text={pending} pending />
              <ThinkingMessage />
            </>
          )}

          {failed && (
            <>
              <UserMessage text={failed.text} />
              <div className="flex items-start gap-3">
                <AiAvatar />
                <div className="flex-1 rounded-2xl bg-danger/10 p-3.5 text-sm text-fg ring-1 ring-inset ring-danger/25">
                  <p className="flex items-start gap-2">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" /> {failed.message}
                  </p>
                  {canAsk && (
                    <button
                      type="button"
                      onClick={() => send(failed.text)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-xs font-semibold text-fg ring-1 ring-inset ring-border hover:ring-primary/50"
                    >
                      <RotateCw className="size-3.5" /> {t("chat.retry")}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {canAsk && messages.length > 0 && !busy && !failed && followUps.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-10" aria-label={t("chat.suggestions")}>
              {followUps.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => send(t(`chat.suggest.${key}`))}
                  className="rounded-full bg-surface-2/70 px-3.5 py-1.5 text-left text-sm text-muted ring-1 ring-inset ring-border transition-colors hover:text-fg hover:ring-primary/50"
                >
                  {t(`chat.suggest.${key}`)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Jump back to the newest message */}
        <AnimatePresence>
          {!atBottom && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={() => scrollToBottom()}
              aria-label={t("chat.scrollDown")}
              title={t("chat.scrollDown")}
              className="absolute bottom-3 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full bg-surface-3 text-fg shadow-lg ring-1 ring-border hover:ring-primary/50"
            >
              <ArrowDown className="size-4.5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Composer */}
      {chat?.enabled && (
        <div className="relative px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4">
          {outOfQuestions ? (
            <p className="flex items-start gap-2 rounded-2xl bg-warning/10 p-3.5 text-sm text-fg ring-1 ring-inset ring-warning/25">
              <Info className="mt-0.5 size-4 shrink-0 text-warning" />
              {t(chat.remainingToday <= 0 ? "chat.noneToday" : "chat.noneForScan")}
            </p>
          ) : (
            <Composer
              value={question}
              onChange={setQuestion}
              onSend={send}
              sending={Boolean(pending)}
              maxChars={maxChars}
              inputRef={inputRef}
            />
          )}
          <p className={cx("mt-2 text-center text-[11px] text-subtle", outOfQuestions && "hidden")}>
            {t("chat.footer")} · <span className="tabular">{t("chat.remaining", { today: chat.remainingToday, scan: chat.remainingForScan })}</span>
          </p>
        </div>
      )}
    </motion.div>
  );
}

export default AssistantPanel;

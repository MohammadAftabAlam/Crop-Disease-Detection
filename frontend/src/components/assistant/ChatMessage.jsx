import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy, Info, ShieldCheck, Square, Volume2 } from "lucide-react";
import AiAvatar from "./AiAvatar";
import Markdown, { plainText } from "./Markdown";
import usePreferences from "../../hooks/usePreferences";
import { cx } from "../ui";

// Answers that were not a normal reply get a short note (ChatMessage outcomes on the backend)
const OUTCOME_ICON = { off_topic: Info, unsafe_removed: ShieldCheck, blocked: Info };

const timeOf = (value, locale) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(date);
};

// Reveal a new answer a few words at a time, like a streaming reply.
// The full answer has already arrived; this only paces how it appears.
function useTypewriter(text, active, onProgress) {
  const reduceMotion = useReducedMotion();
  const tokens = useMemo(() => text.split(/(\s+)/), [text]);
  const animate = active && !reduceMotion;
  const [count, setCount] = useState(animate ? 0 : tokens.length);

  useEffect(() => {
    if (!animate) {
      setCount(tokens.length);
      return undefined;
    }

    const timer = setInterval(() => {
      setCount((current) => {
        const next = Math.min(current + 3, tokens.length);
        if (next >= tokens.length) {
          clearInterval(timer);
        }
        return next;
      });
    }, 35);

    return () => clearInterval(timer);
  }, [animate, tokens.length]);

  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;

  useEffect(() => {
    progressRef.current?.(count >= tokens.length);
  }, [count, tokens.length]);

  return { shown: tokens.slice(0, count).join(""), done: count >= tokens.length };
}

function ActionButton({ icon: Icon, label, onClick, active = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cx(
        "grid size-8 place-items-center rounded-lg transition-colors",
        active ? "bg-primary/15 text-primary" : "text-subtle hover:bg-surface-2 hover:text-fg"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

export function AssistantMessage({ message, typing = false, onTypingProgress, readAloud }) {
  const { t, locale } = usePreferences();
  const { shown, done } = useTypewriter(message.text, typing, onTypingProgress);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plainText(message.text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. not https); nothing else to do
    }
  };

  const speaking = readAloud?.speakingId === message.id;
  const OutcomeIcon = OUTCOME_ICON[message.outcome];

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="group flex gap-3">
      <AiAvatar className="mt-0.5" />

      <div className="min-w-0 flex-1">
        <p className="mb-1 flex items-baseline gap-2 text-sm">
          <span className="font-bold text-fg">{t("chat.name")}</span>
          <span className="text-xs text-subtle">{timeOf(message.createdAt, locale)}</span>
        </p>

        <div className="text-[15px] leading-relaxed text-fg/90">
          <Markdown text={shown} />
          {!done && <span aria-hidden="true" className="ml-0.5 inline-block h-4 w-1.5 translate-y-0.5 animate-pulse rounded-sm bg-primary" />}
        </div>

        {OutcomeIcon && done && (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted ring-1 ring-inset ring-border">
            <OutcomeIcon className="size-3.5" /> {t(`chat.outcome.${message.outcome}`)}
          </p>
        )}

        {done && (
          <div className="mt-1.5 -ml-1.5 flex gap-0.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
            <ActionButton icon={copied ? Check : Copy} label={t(copied ? "chat.copied" : "chat.copy")} onClick={copy} />
            {readAloud?.supported && (
              <ActionButton
                icon={speaking ? Square : Volume2}
                label={t(speaking ? "chat.stopReading" : "chat.readAloud")}
                active={speaking}
                onClick={() => readAloud.toggle(message.id, plainText(message.text))}
              />
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function UserMessage({ text, pending = false }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
      <div
        className={cx(
          "max-w-[85%] rounded-3xl rounded-br-lg bg-surface-3 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line text-fg",
          pending && "opacity-80"
        )}
      >
        {text}
      </div>
    </motion.div>
  );
}

// While the answer is on its way
export function ThinkingMessage() {
  const { t } = usePreferences();

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
      <AiAvatar thinking />
      <span className="animate-shimmer text-sm font-semibold text-shimmer motion-reduce:animate-none">{t("chat.thinking")}</span>
    </motion.div>
  );
}

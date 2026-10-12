import React, { useEffect, useRef } from "react";
import { ArrowUp, LoaderCircle, Mic, Square } from "lucide-react";
import usePreferences from "../../hooks/usePreferences";
import useSpeechToText from "../../hooks/useSpeechToText";
import { cx } from "../ui";

// Browser speech-recognition error codes -> message keys
const SPEECH_ERRORS = {
  "not-allowed": "micDenied",
  "service-not-allowed": "micDenied",
  "audio-capture": "noMic",
  "no-speech": "noSpeech",
  network: "speechNetwork",
  "language-not-supported": "speechLanguage",
};

// The message box: grows with the text, Enter sends, Shift+Enter adds a line
function Composer({ value, onChange, onSend, sending, maxChars, inputRef }) {
  const { t, lang } = usePreferences();
  const typedBeforeRef = useRef("");
  const localRef = useRef(null);
  const textareaRef = inputRef || localRef;

  // Spoken words go into the box after anything already typed; the farmer checks
  // them and sends, so a misheard question is never sent by itself
  const speech = useSpeechToText({
    lang,
    onText: (spoken) => {
      const before = typedBeforeRef.current;
      onChange((before ? `${before} ${spoken}` : spoken).slice(0, maxChars));
    },
  });

  // Grow up to about six lines, then scroll
  useEffect(() => {
    const element = textareaRef.current;
    if (element) {
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, 168)}px`;
    }
  }, [value, textareaRef]);

  const submit = () => {
    if (!value.trim() || sending) {
      return;
    }
    speech.stop();
    onSend(value);
  };

  const toggleListening = () => {
    if (speech.listening) {
      speech.stop();
    } else {
      typedBeforeRef.current = value.trim();
      speech.start();
    }
  };

  const nearLimit = value.length > maxChars * 0.8;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div
        className={cx(
          "rounded-3xl bg-surface-2 p-2 shadow-lg ring-1 ring-inset transition-shadow",
          speech.listening ? "ring-danger/50" : "ring-border focus-within:ring-primary/60"
        )}
      >
        <label htmlFor="assistant-question" className="sr-only">{t("chat.placeholder")}</label>
        <textarea
          id="assistant-question"
          ref={textareaRef}
          rows={1}
          value={value}
          maxLength={maxChars}
          lang={lang}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t(speech.listening ? "chat.listening" : "chat.placeholder")}
          className="block max-h-42 w-full resize-none bg-transparent px-3 pt-2 pb-1 text-[15px] leading-relaxed text-fg focus-visible:outline-none"
        />

        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <div className="flex items-center gap-2">
            {speech.supported && (
              <button
                type="button"
                onClick={toggleListening}
                disabled={sending}
                aria-pressed={speech.listening}
                aria-label={t(speech.listening ? "chat.stopListening" : "chat.speak")}
                title={t(speech.listening ? "chat.stopListening" : "chat.speak")}
                className={cx(
                  "relative grid size-9 place-items-center rounded-full transition-colors disabled:opacity-50",
                  speech.listening ? "bg-danger/15 text-danger" : "text-muted hover:bg-surface-3 hover:text-fg"
                )}
              >
                {speech.listening && (
                  <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full bg-danger/25 motion-reduce:animate-none" />
                )}
                {speech.listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4.5" />}
              </button>
            )}
            {speech.listening && (
              <span className="text-xs font-medium text-danger" role="status">{t("chat.listening")}</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {nearLimit && <span className="text-xs text-subtle tabular">{value.length}/{maxChars}</span>}
            <button
              type="submit"
              disabled={!value.trim() || sending}
              aria-label={t("chat.send")}
              title={t("chat.send")}
              className="grid size-9 place-items-center rounded-full bg-primary text-primary-fg shadow-[0_0_16px_-4px_var(--glow)] transition-all hover:bg-primary-strong active:scale-95 disabled:bg-surface-3 disabled:text-subtle disabled:shadow-none"
            >
              {sending ? <LoaderCircle className="size-4.5 animate-spin" /> : <ArrowUp className="size-4.5" strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {speech.error && !speech.listening && (
        <p className="mt-2 px-2 text-xs text-danger" role="alert">
          {t(`chat.speechError.${SPEECH_ERRORS[speech.error] || "failed"}`)}
        </p>
      )}
    </form>
  );
}

export default Composer;

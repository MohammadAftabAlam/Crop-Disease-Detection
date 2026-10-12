import { useCallback, useEffect, useRef, useState } from "react";

// Speech to text with the browser's own speech recognition (Chrome / Edge, including Android;
// Safari on iOS 14.5+). Nothing to host: the browser sends the audio to its speech service and
// returns text. Needs a secure page (https or localhost) and microphone permission.
const Recognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

// App language -> speech language (Indian English understands Indian names and accents better)
const SPEECH_LANG = { hi: "hi-IN", en: "en-IN" };

export default function useSpeechToText({ lang, onText }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const supported = Boolean(Recognition) && (typeof window === "undefined" || window.isSecureContext);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!supported || recognitionRef.current) {
      return;
    }
    const recognition = new Recognition();
    recognition.lang = SPEECH_LANG[lang] || "en-IN";
    recognition.interimResults = true; // show words while the farmer is still speaking
    recognition.continuous = false; // stop after a pause
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const text = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("")
        .trim();
      const final = event.results[event.results.length - 1].isFinal;
      onTextRef.current?.(text, final);
    };
    recognition.onerror = (event) => {
      // "aborted" is our own stop(); everything else is shown to the user
      if (event.error !== "aborted") {
        setError(event.error);
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    setError("");
    recognitionRef.current = recognition;
    setListening(true);
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
    }
  }, [lang, supported]);

  // Stop listening when the language changes or the component goes away
  useEffect(() => () => recognitionRef.current?.abort(), [lang]);

  return { supported, listening, error, start, stop };
}

import { useCallback, useEffect, useState } from "react";

const synth = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;

// Answers come in the language the question was asked in, which may differ from
// the current app language, so the voice follows the text itself
const languageOf = (text) => (/[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN");

const pickVoice = (lang) => {
  const voices = synth.getVoices();
  const base = lang.slice(0, 2);
  return (
    voices.find((voice) => voice.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find((voice) => voice.lang?.toLowerCase().startsWith(base))
  );
};

// Read a chat answer aloud with the browser's built-in voices (no server needed).
// Only one answer speaks at a time; speakingId says which one.
function useReadAloud() {
  const [speakingId, setSpeakingId] = useState(null);

  const stop = useCallback(() => {
    synth?.cancel();
    setSpeakingId(null);
  }, []);

  // Stop talking when the panel closes
  useEffect(() => () => synth?.cancel(), []);

  const toggle = useCallback(
    (id, text) => {
      if (!synth) {
        return;
      }

      synth.cancel();

      if (speakingId === id) {
        setSpeakingId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageOf(text);
      utterance.rate = 0.95;

      const voice = pickVoice(utterance.lang);
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => setSpeakingId((current) => (current === id ? null : current));
      utterance.onerror = utterance.onend;

      setSpeakingId(id);
      synth.speak(utterance);
    },
    [speakingId]
  );

  return { supported: Boolean(synth), speakingId, toggle, stop };
}

export default useReadAloud;

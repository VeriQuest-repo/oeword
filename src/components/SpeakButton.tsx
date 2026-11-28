// 영단어 발음 듣기 (#50). 브라우저에 들어 있는 음성 읽기(Web Speech API)를 써서
// 외부 서비스·키·비용 없이 읽습니다. 목소리는 기기에 들어 있는 영어 음성이라 기기마다 조금 다릅니다.

function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function englishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-US") ?? voices.find((v) => v.lang.startsWith("en"));
}

export function speakEnglish(text: string) {
  if (!canSpeak()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  const voice = englishVoice();
  if (voice) utterance.voice = voice;
  // 앞에서 읽던 것이 있으면 멈추고 새로 읽습니다 (여러 번 눌러도 겹치지 않게).
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

/** 스피커 버튼. 음성 읽기를 지원하지 않는 브라우저에서는 보이지 않습니다. */
export function SpeakButton({ text, small = false, className = "" }: { text: string; small?: boolean; className?: string }) {
  if (!canSpeak()) return null;
  return (
    <button
      type="button"
      onClick={() => speakEnglish(text)}
      aria-label={`${text} 발음 듣기`}
      title="발음 듣기"
      className={`inline-flex ${small ? "size-11" : "size-14"} shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100 hover:bg-indigo-100 active:bg-indigo-200 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={small ? "size-6" : "size-7"} aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </button>
  );
}

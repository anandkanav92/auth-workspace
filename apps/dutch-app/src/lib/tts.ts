"use client";

let dutchVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function loadVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (voicesLoaded) {
      resolve();
      return;
    }

    const tryLoad = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer Dutch (Netherlands) voices, prioritize ones with "Google" or "Microsoft" in name
        const dutch = voices.filter((v) => v.lang.startsWith("nl"));
        dutchVoice =
          dutch.find((v) => v.name.includes("Google")) ??
          dutch.find((v) => v.name.includes("Microsoft")) ??
          dutch.find((v) => v.lang === "nl-NL") ??
          dutch[0] ??
          null;

        console.log(
          "[TTS] Available Dutch voices:",
          dutch.map((v) => `${v.name} (${v.lang})`),
        );
        console.log("[TTS] Selected voice:", dutchVoice?.name ?? "none");
        voicesLoaded = true;
        resolve();
      }
    };

    tryLoad();
    if (!voicesLoaded) {
      speechSynthesis.onvoiceschanged = () => {
        tryLoad();
        resolve();
      };
      // Fallback timeout
      setTimeout(() => {
        tryLoad();
        resolve();
      }, 2000);
    }
  });
}

export async function initTTS(): Promise<void> {
  await loadVoices();
}

export async function speak(text: string): Promise<void> {
  await loadVoices();

  // Cancel any ongoing speech
  speechSynthesis.cancel();

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "nl-NL";
    utterance.rate = 0.9; // Slightly slower for learners
    if (dutchVoice) {
      utterance.voice = dutchVoice;
    }

    utterance.onend = () => resolve();
    utterance.onerror = (e) => {
      console.error("[TTS] Speech error:", e.error);
      resolve();
    };

    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  speechSynthesis.cancel();
}

export function onLoadProgress(_callback: (percent: number) => void) {
  // No download needed for Web Speech API
  return () => {};
}

export function isModelReady(): boolean {
  return true; // Always ready — no model to download
}

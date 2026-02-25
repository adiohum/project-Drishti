let lastSpoken = 0;
const ANNOUNCE_COOLDOWN = 2500;

function speak(text) {
  const now = Date.now();
  if (now - lastSpoken < ANNOUNCE_COOLDOWN) return;

  lastSpoken = now;

  const utter = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

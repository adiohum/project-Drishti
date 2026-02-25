
let speechQueue = [];
let speaking = false;

function speak(text) {
    if (speechQueue.includes(text)) return;

    speechQueue.push(text);
    processSpeech();
}

function processSpeech() {
    if (speaking || speechQueue.length === 0) return;

    speaking = true;
    let utter = new SpeechSynthesisUtterance(speechQueue.shift());
    utter.rate = 1;
    utter.pitch = 0.9;

    utter.onend = () => {
        speaking = false;
        processSpeech();
    };

    window.speechSynthesis.speak(utter);
}

function stopVoice() {
    window.speechSynthesis.cancel();
    speechQueue = [];
    speaking = false;
}

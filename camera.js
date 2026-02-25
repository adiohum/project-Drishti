
let model, stream;
let detecting = false;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

async function startSystem() {
    try {
        model = await cocoSsd.load();

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" }
            }
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            detecting = true;
            objectStates = {};
            clearLog();
            startDetection();
        };

    } catch (err) {
        alert("Camera access denied or not supported.");
        console.error(err);
    }
}

function stopSystem() {
    detecting = false;

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    stopVoice();
    objectStates = {};
}

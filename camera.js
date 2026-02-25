let stream = null;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

async function startSystem() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });

  video.srcObject = stream;

  video.onloadedmetadata = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    loadModel();   // call detection
  };
}

function stopSystem() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
  stopDetection();
}

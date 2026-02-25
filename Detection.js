let model;
let detecting = false;
let trackedObjects = {};

const STABLE_FRAMES = 6;
const LOST_FRAMES = 12;

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const radar = document.getElementById("radar");
const rCtx = radar.getContext("2d");
radar.width = 130;
radar.height = 130;

async function loadModel() {
  model = await cocoSsd.load();
  detecting = true;
  trackedObjects = {};
  detectFrame();
}

function stopDetection() {
  detecting = false;
  trackedObjects = {};
}

function estimateDistance(boxWidth) {
  const focalLength = 700;
  const realWidth = 50;
  const distance = (realWidth * focalLength) / boxWidth;
  return Math.round(distance / 100);
}

function generateID(pred) {
  return pred.class + "_" +
         Math.round(pred.bbox[0] / 40) + "_" +
         Math.round(pred.bbox[1] / 40);
}

async function detectFrame() {
  if (!detecting) return;

  const predictions = await model.detect(video);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rCtx.clearRect(0, 0, 130, 130);

  let currentFrameIDs = {};

  predictions.forEach(pred => {
    if (pred.score < 0.7) return;

    const [x, y, w, h] = pred.bbox;
    const id = generateID(pred);
    currentFrameIDs[id] = true;

    if (!trackedObjects[id]) {
      trackedObjects[id] = {
        class: pred.class,
        seen: 0,
        lost: 0,
        announced: false
      };
    }

    trackedObjects[id].seen++;
    trackedObjects[id].lost = 0;

    const distance = estimateDistance(w);

    // Draw box
    ctx.strokeStyle = "#00ffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = "#00ffff";
    ctx.font = "14px Orbitron";
    ctx.fillText(pred.class + " (" + distance + "m)", x, y > 20 ? y - 10 : 20);

    // Radar
    let rx = (x / canvas.width) * 130;
    let ry = (y / canvas.height) * 130;
    rCtx.beginPath();
    rCtx.arc(rx, ry, 4, 0, Math.PI * 2);
    rCtx.fillStyle = "#00ffff";
    rCtx.fill();

    if (
      trackedObjects[id].seen >= STABLE_FRAMES &&
      !trackedObjects[id].announced
    ) {
      speak(pred.class + " detected at " + distance + " meters");
      trackedObjects[id].announced = true;
    }
  });

  // Handle lost objects
  for (let id in trackedObjects) {
    if (!currentFrameIDs[id]) {
      trackedObjects[id].lost++;
      if (trackedObjects[id].lost >= LOST_FRAMES) {
        if (trackedObjects[id].announced) {
          speak(trackedObjects[id].class + " left view");
        }
        delete trackedObjects[id];
      }
    }
  }

  requestAnimationFrame(detectFrame);
}

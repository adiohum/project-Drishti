(function(global) {
'use strict';

const DetectionModule = {
    model: null,
    isModelLoaded: false,
    isDetecting: false,
    animationFrameId: null,

    video: null,
    overlayCanvas: null,
    overlayCtx: null,
    radarCanvas: null,
    radarCtx: null,

    trackedObjects: new Map(),

    lastFrameTime: 0,
    frameCount: 0,
    fps: 0
};

const CONFIG = {
    scoreThreshold: 0.6,
    stableFrames: 6,
    lostFrames: 20,
    positionBucketSize: 120, // 🔥 increased for stability

    focalLength: 600,

    realWidths: {
        person: 0.5,
        car: 1.8,
        bicycle: 0.6,
        motorcycle: 0.8,
        bus: 2.5,
        truck: 2.5,
        dog: 0.3,
        cat: 0.25,
        default: 0.4
    },

    radarSize: 120
};

async function init(video, overlay, radar) {
    DetectionModule.video = video;
    DetectionModule.overlayCanvas = overlay;
    DetectionModule.overlayCtx = overlay.getContext('2d');

    if (radar) {
        DetectionModule.radarCanvas = radar;
        DetectionModule.radarCtx = radar.getContext('2d');
        radar.width = CONFIG.radarSize;
        radar.height = CONFIG.radarSize;
    }

    if (typeof voice !== "undefined") {
        voice.init(); // 🔥 FIX: initialize voice properly
    }

    DetectionModule.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    DetectionModule.isModelLoaded = true;

    return true;
}

function startDetection() {
    if (!DetectionModule.isModelLoaded) return false;
    DetectionModule.isDetecting = true;
    detectFrame();
    return true;
}

function stopDetection() {
    DetectionModule.isDetecting = false;
    cancelAnimationFrame(DetectionModule.animationFrameId);
    DetectionModule.trackedObjects.clear();
    DetectionModule.overlayCtx.clearRect(
        0,0,
        DetectionModule.overlayCanvas.width,
        DetectionModule.overlayCanvas.height
    );
}

async function detectFrame() {
    if (!DetectionModule.isDetecting) return;

    const predictions = await DetectionModule.model.detect(
        DetectionModule.video,
        20,
        CONFIG.scoreThreshold
    );

    updateCanvasSize();

    DetectionModule.overlayCtx.clearRect(
        0,0,
        DetectionModule.overlayCanvas.width,
        DetectionModule.overlayCanvas.height
    );

    processPredictions(predictions);
    drawObjects();
    drawRadar();

    DetectionModule.animationFrameId =
        requestAnimationFrame(detectFrame);
}

function processPredictions(predictions) {

    const matched = new Set();

    for (const p of predictions) {

        const [x,y,w,h] = p.bbox;
        const className = p.class;

        const id = generateId(className, x, y);

        const distance = calculateDistance(className, w);

        if (DetectionModule.trackedObjects.has(id)) {

            const obj = DetectionModule.trackedObjects.get(id);

            obj.bbox = p.bbox;
            obj.score = p.score;
            obj.distance = distance; // 🔥 FIX distance updating
            obj.lostFrames = 0;
            obj.frameCount++;

            if (!obj.isStable && obj.frameCount >= CONFIG.stableFrames) {
                obj.isStable = true;
                if (voice) voice.announceObjectDetected(className, distance);
            }

            matched.add(id);

        } else {

            DetectionModule.trackedObjects.set(id,{
                id,
                class: className,
                bbox: p.bbox,
                score: p.score,
                distance,
                frameCount: 1,
                lostFrames: 0,
                isStable: false
            });
        }
    }

    for (const [id,obj] of DetectionModule.trackedObjects) {

        if (!matched.has(id)) {
            obj.lostFrames++;

            if (obj.lostFrames >= CONFIG.lostFrames) {

                if (obj.isStable && voice) {
                    voice.announceObjectLeft(obj.class);
                }

                DetectionModule.trackedObjects.delete(id);
            }
        }
    }
}

function generateId(className,x,y){
    const qx = Math.floor(x / CONFIG.positionBucketSize);
    const qy = Math.floor(y / CONFIG.positionBucketSize);
    return `${className}_${qx}_${qy}`;
}

function calculateDistance(className, boxWidth){
    if (boxWidth <= 0) return 0;
    const realWidth = CONFIG.realWidths[className] || CONFIG.realWidths.default;
    return Math.max(0.1, (realWidth * CONFIG.focalLength) / boxWidth);
}

function updateCanvasSize(){
    const v = DetectionModule.video;
    const c = DetectionModule.overlayCanvas;
    if (c.width !== v.videoWidth) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
    }
}

function drawObjects(){

    const ctx = DetectionModule.overlayCtx;

    for (const obj of DetectionModule.trackedObjects.values()) {

        if (!obj.isStable) continue;

        const [x,y,w,h] = obj.bbox;

        ctx.strokeStyle="#00ffff";
        ctx.lineWidth=2;
        ctx.strokeRect(x,y,w,h);

        ctx.fillStyle="rgba(0,0,0,0.6)";
        ctx.fillRect(x,y-24,160,20);

        ctx.fillStyle="#00ffff";
        ctx.font="13px Orbitron";
        ctx.fillText(`${obj.class} ${obj.distance.toFixed(1)}m`, x+6, y-8);
    }
}

function drawRadar(){

    if (!DetectionModule.radarCtx) return;

    const ctx = DetectionModule.radarCtx;
    const size = CONFIG.radarSize;
    const center = size/2;

    ctx.clearRect(0,0,size,size);

    ctx.strokeStyle="rgba(0,255,255,0.3)";
    ctx.beginPath();
    ctx.arc(center,center,center-2,0,Math.PI*2);
    ctx.stroke();

    for (const obj of DetectionModule.trackedObjects.values()) {

        if (!obj.isStable) continue;

        const [x,y,w,h] = obj.bbox;
        const v = DetectionModule.video;

        const normX = ((x+w/2)/v.videoWidth - 0.5)*2;
        const normY = ((y+h/2)/v.videoHeight - 0.5)*2;

        const rx = center + normX*(center-10);
        const ry = center + normY*(center-10);

        ctx.fillStyle="#00ffff";
        ctx.beginPath();
        ctx.arc(rx,ry,5,0,Math.PI*2);
        ctx.fill();
    }
}

global.detection = {
    init,
    startDetection,
    stopDetection
};

})(window);

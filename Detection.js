
let objectStates = {};

const STABLE_FRAMES = 6;
const LOST_FRAMES = 12;
const ANNOUNCE_INTERVAL = 6000; // 6 seconds repeat interval

const realSizes = {
    person: 0.5,
    "cell phone": 0.07,
    laptop: 0.35,
    bottle: 0.08,
    car: 1.8,
    chair: 0.5
};

const focalLength = 650;

function smoothDistance(previous, current) {
    if (!previous) return current;
    return (previous * 0.7 + current * 0.3);
}

function estimateDistance(className, pixelWidth) {
    const realWidth = realSizes[className] || 0.3;
    return (realWidth * focalLength) / pixelWidth;
}

async function startDetection() {
    detectLoop();
}

async function detectLoop() {
    if (!detecting) return;

    const predictions = await model.detect(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let currentFrame = {};
    let now = Date.now();

    predictions.forEach(p => {
        if (p.score < 0.75) return;

        const [x, y, w, h] = p.bbox;
        const rawDistance = estimateDistance(p.class, w);

        if (!objectStates[p.class]) {
            objectStates[p.class] = {
                seen: 0,
                lost: 0,
                active: false,
                distance: null,
                lastSpoken: 0
            };
        }

        let obj = objectStates[p.class];
        obj.seen++;
        obj.lost = 0;

        obj.distance = smoothDistance(obj.distance, rawDistance);
        const displayDistance = obj.distance.toFixed(1);

        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = "#00ffff";
        ctx.fillText(
            `${p.class} | ${displayDistance}m`,
            x,
            y > 10 ? y - 5 : 10
        );

        currentFrame[p.class] = true;

        // First stable detection
        if (obj.seen >= STABLE_FRAMES && !obj.active) {
            obj.active = true;
            obj.lastSpoken = now;
            speak(`${p.class} detected at ${displayDistance} meters`);
            addLog(`${p.class} detected at ${displayDistance}m`);
        }

        // Controlled repetition while still visible
        if (obj.active && now - obj.lastSpoken > ANNOUNCE_INTERVAL) {
            obj.lastSpoken = now;
            speak(`${p.class} at ${displayDistance} meters`);
        }
    });

    // Handle disappear
    for (let key in objectStates) {
        if (!currentFrame[key]) {
            objectStates[key].lost++;

            if (objectStates[key].lost >= LOST_FRAMES) {
                speak(`${key} no longer detected`);
                addLog(`${key} disappeared`);
                delete objectStates[key];
            }
        }
    }

    requestAnimationFrame(detectLoop);
}

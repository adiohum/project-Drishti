/**
 * Project Drishti - Detection Module
 * Proper Multi-Object Tracking with IoU Matching
 */

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
        nextObjectId: 1,
        lastFrameTime: 0,
        frameCount: 0,
        fps: 0
    };

    const CONFIG = {
        scoreThreshold: 0.5,
        stableFrames: 3,
        lostFrames: 30,
        iouThreshold: 0.3,  // For matching objects
        focalLength: 600,
        realWidths: {
            person: 0.5, car: 1.8, bicycle: 0.6, motorcycle: 0.8,
            bus: 2.5, truck: 2.5, dog: 0.3, cat: 0.25,
            bird: 0.15, bottle: 0.08, chair: 0.5, couch: 2.0,
            'dining table': 1.0, laptop: 0.35, 'cell phone': 0.08,
            tv: 1.0, default: 0.3
        },
        classColors: {
            person: '#00ffff', car: '#ff00ff', bicycle: '#ffff00',
            motorcycle: '#ff8800', bus: '#00ff00', truck: '#0088ff',
            dog: '#ff0088', cat: '#88ff00', bird: '#ff4444',
            bottle: '#44ff44', chair: '#ffaa00', couch: '#aa00ff',
            default: '#00ffff'
        },
        radarSize: 120
    };

    // Track what we've announced
    const announcedObjects = new Map();

    function updateStatus(id, status) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active', 'error', 'loading');
        if (status === 'active') el.classList.add('active');
        else if (status === 'error') el.classList.add('error');
        else if (status === 'loading') el.classList.add('loading');
    }

    function updateObjectCount(count) {
        const el = document.getElementById('objectCount');
        if (el) el.textContent = count;
    }

    function updateFPS(fps) {
        const el = document.getElementById('fpsValue');
        if (el) el.textContent = fps;
    }

    function hideLoading() {
        const el = document.getElementById('loadingOverlay');
        if (el) el.classList.add('hidden');
    }

    function showLoading(msg) {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        if (overlay) overlay.classList.remove('hidden');
        if (text) text.textContent = msg || 'LOADING...';
    }

    function logMsg(level, msg) {
        if (typeof logEvent === 'function') logEvent(level, msg);
    }

    // Calculate IoU (Intersection over Union) for matching
    function calculateIoU(box1, box2) {
        const [x1, y1, w1, h1] = box1;
        const [x2, y2, w2, h2] = box2;

        const xi1 = Math.max(x1, x2);
        const yi1 = Math.max(y1, y2);
        const xi2 = Math.min(x1 + w1, x2 + w2);
        const yi2 = Math.min(y1 + h1, y2 + h2);

        const interWidth = Math.max(0, xi2 - xi1);
        const interHeight = Math.max(0, yi2 - yi1);
        const interArea = interWidth * interHeight;

        const box1Area = w1 * h1;
        const box2Area = w2 * h2;
        const unionArea = box1Area + box2Area - interArea;

        return unionArea > 0 ? interArea / unionArea : 0;
    }

    // Calculate distance from bbox width
    function calculateDistance(className, boxWidth) {
        if (boxWidth <= 0) return 0;
        const realWidth = CONFIG.realWidths[className] || CONFIG.realWidths.default;
        return Math.max(0.1, Math.min((realWidth * CONFIG.focalLength) / boxWidth, 100));
    }

    async function init(video, overlay, radar) {
        try {
            DetectionModule.video = video;
            DetectionModule.overlayCanvas = overlay;
            DetectionModule.overlayCtx = overlay.getContext('2d');

            if (radar) {
                DetectionModule.radarCanvas = radar;
                DetectionModule.radarCtx = radar.getContext('2d');
                radar.width = CONFIG.radarSize;
                radar.height = CONFIG.radarSize;
            }

            showLoading('LOADING AI MODEL...');
            updateStatus('modelStatus', 'loading');
            logMsg('INFO', 'Loading COCO-SSD model...');

            DetectionModule.model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
            DetectionModule.isModelLoaded = true;

            updateStatus('modelStatus', 'active');
            hideLoading();
            logMsg('SUCCESS', 'AI Model loaded successfully');

            return true;

        } catch (error) {
            console.error('[Detection] Init error:', error);
            updateStatus('modelStatus', 'error');
            showLoading('MODEL LOAD FAILED');
            logMsg('ERROR', 'Model load failed: ' + error.message);
            return false;
        }
    }

    function startDetection() {
        if (!DetectionModule.isModelLoaded) return false;
        if (DetectionModule.isDetecting) return true;

        DetectionModule.isDetecting = true;
        DetectionModule.lastFrameTime = performance.now();
        DetectionModule.frameCount = 0;
        
        updateStatus('detectionStatus', 'active');
        logMsg('INFO', 'Detection started');
        
        detectFrame();
        return true;
    }

    function stopDetection() {
        DetectionModule.isDetecting = false;
        
        if (DetectionModule.animationFrameId) {
            cancelAnimationFrame(DetectionModule.animationFrameId);
            DetectionModule.animationFrameId = null;
        }
        
        DetectionModule.trackedObjects.clear();
        DetectionModule.nextObjectId = 1;
        announcedObjects.clear();
        
        if (DetectionModule.overlayCtx && DetectionModule.overlayCanvas) {
            DetectionModule.overlayCtx.clearRect(
                0, 0,
                DetectionModule.overlayCanvas.width,
                DetectionModule.overlayCanvas.height
            );
        }
        
        updateStatus('detectionStatus', 'inactive');
        updateObjectCount(0);
        logMsg('INFO', 'Detection stopped');
    }

    async function detectFrame() {
        if (!DetectionModule.isDetecting) return;

        const now = performance.now();
        DetectionModule.frameCount++;
        
        if (now - DetectionModule.lastFrameTime >= 1000) {
            DetectionModule.fps = DetectionModule.frameCount;
            DetectionModule.frameCount = 0;
            DetectionModule.lastFrameTime = now;
            updateFPS(DetectionModule.fps);
        }

        try {
            const v = DetectionModule.video;
            if (!v || v.readyState < 2) {
                DetectionModule.animationFrameId = requestAnimationFrame(detectFrame);
                return;
            }

            // Detect up to 30 objects
            const predictions = await DetectionModule.model.detect(v, 30, CONFIG.scoreThreshold);

            updateCanvasSize();
            
            const ctx = DetectionModule.overlayCtx;
            if (ctx) {
                ctx.clearRect(0, 0, DetectionModule.overlayCanvas.width, DetectionModule.overlayCanvas.height);
            }

            processPredictions(predictions);
            drawObjects();
            drawRadar();

        } catch (error) {
            console.error('[Detection] Frame error:', error);
        }

        DetectionModule.animationFrameId = requestAnimationFrame(detectFrame);
    }

    function updateCanvasSize() {
        const v = DetectionModule.video;
        const c = DetectionModule.overlayCanvas;
        if (c && v && (c.width !== v.videoWidth || c.height !== v.videoHeight)) {
            c.width = v.videoWidth;
            c.height = v.videoHeight;
        }
    }

    function processPredictions(predictions) {
        const now = Date.now();
        const matchedIds = new Set();

        // For each prediction, find best matching tracked object
        for (let i = 0; i < predictions.length; i++) {
            const p = predictions[i];
            const [x, y, w, h] = p.bbox;
            const className = p.class;
            const distance = calculateDistance(className, w);

            let bestMatch = null;
            let bestIoU = 0;

            // Find best matching object by IoU
            for (const [id, obj] of DetectionModule.trackedObjects) {
                // Only match same class
                if (obj.class !== className) continue;
                if (matchedIds.has(id)) continue;

                const iou = calculateIoU(obj.bbox, p.bbox);
                if (iou > bestIoU && iou > CONFIG.iouThreshold) {
                    bestIoU = iou;
                    bestMatch = id;
                }
            }

            if (bestMatch !== null) {
                // Update existing object
                const obj = DetectionModule.trackedObjects.get(bestMatch);
                obj.bbox = [x, y, w, h];
                obj.score = p.score;
                obj.distance = distance;
                obj.lostFrames = 0;
                obj.frameCount++;
                obj.lastSeen = now;

                // Check if stable
                if (!obj.isStable && obj.frameCount >= CONFIG.stableFrames) {
                    obj.isStable = true;
                }

                // Announce new detection (once per object)
                if (obj.isStable && !announcedObjects.has(obj.id)) {
                    announcedObjects.set(obj.id, now);
                    if (typeof voice !== 'undefined' && voice.announceObjectDetected) {
                        voice.announceObjectDetected(className, distance);
                    }
                    logMsg('INFO', 'Detected: ' + className + ' #' + obj.id + ' (' + distance.toFixed(1) + 'm)');
                }

                matchedIds.add(bestMatch);
            } else {
                // Create new object with unique ID
                const newId = DetectionModule.nextObjectId++;
                DetectionModule.trackedObjects.set(newId, {
                    id: newId,
                    class: className,
                    bbox: [x, y, w, h],
                    score: p.score,
                    distance: distance,
                    frameCount: 1,
                    lostFrames: 0,
                    isStable: false,
                    firstSeen: now,
                    lastSeen: now
                });
            }
        }

        // Handle lost objects
        for (const [id, obj] of DetectionModule.trackedObjects) {
            if (!matchedIds.has(id)) {
                obj.lostFrames++;

                if (obj.lostFrames >= CONFIG.lostFrames) {
                    if (obj.isStable) {
                        if (typeof voice !== 'undefined' && voice.announceObjectLeft) {
                            voice.announceObjectLeft(obj.class);
                        }
                        logMsg('INFO', 'Object left: ' + obj.class + ' #' + id);
                    }
                    DetectionModule.trackedObjects.delete(id);
                    announcedObjects.delete(id);
                }
            }
        }

        // Update object count
        const stableCount = Array.from(DetectionModule.trackedObjects.values())
            .filter(o => o.isStable).length;
        updateObjectCount(stableCount);
    }

    function drawObjects() {
        const ctx = DetectionModule.overlayCtx;
        if (!ctx) return;

        for (const obj of DetectionModule.trackedObjects.values()) {
            const [x, y, w, h] = obj.bbox;
            const color = CONFIG.classColors[obj.class] || CONFIG.classColors.default;

            // Draw bounding box
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, w, h);

            // Draw corners
            const corner = 15;
            ctx.lineWidth = 3;
            
            ctx.beginPath();
            ctx.moveTo(x, y + corner);
            ctx.lineTo(x, y);
            ctx.lineTo(x + corner, y);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + w - corner, y);
            ctx.lineTo(x + w, y);
            ctx.lineTo(x + w, y + corner);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x, y + h - corner);
            ctx.lineTo(x, y + h);
            ctx.lineTo(x + corner, y + h);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x + w - corner, y + h);
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x + w, y + h - corner);
            ctx.stroke();

            // Draw label with ID
            const label = obj.class + ' #' + obj.id + ' ' + obj.distance.toFixed(1) + 'm';
            ctx.font = 'bold 14px Arial';
            const textWidth = ctx.measureText(label).width;
            
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x, y - 25, textWidth + 10, 22);
            
            ctx.fillStyle = color;
            ctx.fillText(label, x + 5, y - 8);

            // Draw confidence bar
            const barWidth = 50;
            const barHeight = 4;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(x + w - barWidth - 5, y + 5, barWidth, barHeight);
            ctx.fillStyle = color;
            ctx.fillRect(x + w - barWidth - 5, y + 5, barWidth * obj.score, barHeight);
        }
    }

    function drawRadar() {
        const ctx = DetectionModule.radarCtx;
        if (!ctx) return;

        const size = CONFIG.radarSize;
        const center = size / 2;

        ctx.clearRect(0, 0, size, size);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.beginPath();
        ctx.arc(center, center, center - 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw grid
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        for (let r = center / 3; r < center; r += center / 3) {
            ctx.beginPath();
            ctx.arc(center, center, r, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw cross
        ctx.beginPath();
        ctx.moveTo(center, 0);
        ctx.lineTo(center, size);
        ctx.moveTo(0, center);
        ctx.lineTo(size, center);
        ctx.stroke();

        // Draw objects on radar
        const v = DetectionModule.video;
        const vw = v ? (v.videoWidth || 1) : 1;
        const vh = v ? (v.videoHeight || 1) : 1;

        for (const obj of DetectionModule.trackedObjects.values()) {
            if (!obj.isStable) continue;

            const [x, y, w, h] = obj.bbox;
            const normX = ((x + w / 2) / vw - 0.5) * 2;
            const normY = ((y + h / 2) / vh - 0.5) * 2;

            const rx = center + normX * (center - 10);
            const ry = center + normY * (center - 10);

            const color = CONFIG.classColors[obj.class] || CONFIG.classColors.default;

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(rx, ry, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    global.detection = {
        init: init,
        startDetection: startDetection,
        stopDetection: stopDetection
    };

})(window);

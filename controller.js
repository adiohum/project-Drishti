/**
 * Controller module for Project Drishti
 * - Wires up camera, detection and voice systems
 * - Handles UI buttons and status updates
 */

(function(global) {
    'use strict';

    // Track state
    let systemActive = false;
    let modulesReady = false;

    // DOM Elements (initialized after DOM ready)
    let activateBtn = null;
    let shutdownBtn = null;
    let loadingOverlay = null;
    let loadingText = null;
    let videoElement = null;
    let overlayCanvas = null;
    let radarCanvas = null;

    // Show loading UI
    function showLoading(msg) {
        if (loadingOverlay && loadingText) {
            loadingText.textContent = msg || 'INITIALIZING...';
            loadingOverlay.classList.remove('hidden');
        }
    }

    // Hide loading UI
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }

    // Update status indicators
    function updateStatus(id, status) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('active', 'error', 'loading');
        if (status === 'active') el.classList.add('active');
        else if (status === 'error') el.classList.add('error');
        else if (status === 'loading') el.classList.add('loading');
    }

    // Update object count
    function updateObjectCount(count) {
        const el = document.getElementById('objectCount');
        if (el) el.textContent = count;
    }

    // Update FPS
    function updateFPS(fps) {
        const el = document.getElementById('fpsValue');
        if (el) el.textContent = fps;
    }

    // Initialize DOM references
    function initDOM() {
        activateBtn = document.getElementById('activateBtn');
        shutdownBtn = document.getElementById('shutdownBtn');
        loadingOverlay = document.getElementById('loadingOverlay');
        loadingText = document.getElementById('loadingText');
        videoElement = document.getElementById('videoElement');
        overlayCanvas = document.getElementById('overlayCanvas');
        radarCanvas = document.getElementById('radarCanvas');

        // 🔥 FIX: Attach button event listeners
        if (activateBtn) {
            activateBtn.addEventListener('click', startSystem);
        }
        if (shutdownBtn) {
            shutdownBtn.addEventListener('click', stopSystem);
        }
    }

    // Initialize all modules
    async function initModules() {
        try {
            showLoading('INITIALIZING VOICE...');
            
            // Initialize voice
            if (typeof voice !== 'undefined' && voice.init) {
                voice.init();
                updateStatus('voiceStatus', 'active');
            } else {
                updateStatus('voiceStatus', 'error');
            }

            showLoading('INITIALIZING CAMERA...');
            updateStatus('cameraStatus', 'loading');

            // Initialize camera
            if (typeof camera !== 'undefined' && camera.init) {
                camera.init(videoElement, {
                    onReady: function(data) {
                        if (typeof logEvent === 'function') {
                            logEvent('SUCCESS', 'Camera ready: ' + data.width + 'x' + data.height);
                        }
                        updateStatus('cameraStatus', 'active');
                    },
                    onError: function(err) {
                        if (typeof logEvent === 'function') {
                            logEvent('ERROR', 'Camera error: ' + err.message);
                        }
                        updateStatus('cameraStatus', 'error');
                    }
                });
            }

            showLoading('LOADING AI MODEL...');
            updateStatus('modelStatus', 'loading');

            // Initialize detection
            if (typeof detection !== 'undefined' && detection.init) {
                const detectionOk = await detection.init(videoElement, overlayCanvas, radarCanvas);
                
                if (detectionOk) {
                    updateStatus('modelStatus', 'active');
                    if (typeof logEvent === 'function') {
                        logEvent('SUCCESS', 'AI Model loaded');
                    }
                } else {
                    updateStatus('modelStatus', 'error');
                    if (typeof logEvent === 'function') {
                        logEvent('ERROR', 'AI Model failed to load');
                    }
                    hideLoading();
                    return false;
                }
            } else {
                updateStatus('modelStatus', 'error');
                if (typeof logEvent === 'function') {
                    logEvent('ERROR', 'Detection module not found');
                }
                hideLoading();
                return false;
            }

            modulesReady = true;
            hideLoading();
            
            if (typeof logEvent === 'function') {
                logEvent('SUCCESS', 'All modules initialized');
            }
            
            return true;

        } catch (error) {
            console.error('[Controller] Init error:', error);
            if (typeof logEvent === 'function') {
                logEvent('ERROR', 'Initialization failed: ' + error.message);
            }
            hideLoading();
            return false;
        }
    }

    // Start the system
    async function startSystem() {
        console.log('[Controller] startSystem called');
        
        if (systemActive) {
            console.log('[Controller] System already active');
            return;
        }

        if (!modulesReady) {
            console.log('[Controller] Modules not ready, initializing...');
            const ok = await initModules();
            if (!ok) {
                if (typeof logEvent === 'function') {
                    logEvent('ERROR', 'Failed to initialize modules');
                }
                return;
            }
        }

        systemActive = true;
        
        if (activateBtn) activateBtn.disabled = true;
        
        showLoading('STARTING CAMERA...');
        updateStatus('cameraStatus', 'loading');

        // Start camera
        if (typeof camera !== 'undefined' && camera.start) {
            const camOk = await camera.start();
            if (!camOk) {
                if (typeof logEvent === 'function') {
                    logEvent('ERROR', 'Camera failed to start');
                }
                updateStatus('cameraStatus', 'error');
                systemActive = false;
                if (activateBtn) activateBtn.disabled = false;
                hideLoading();
                return;
            }
        }

        updateStatus('cameraStatus', 'active');
        updateStatus('detectionStatus', 'active');

        // Start detection
        showLoading('STARTING DETECTION...');
        if (typeof detection !== 'undefined' && detection.startDetection) {
            detection.startDetection();
        }

        if (shutdownBtn) shutdownBtn.disabled = false;

        // Announce
        if (typeof voice !== 'undefined' && voice.announceStatus) {
            voice.announceStatus('System activated. All systems operational.');
        }

        if (typeof logEvent === 'function') {
            logEvent('SUCCESS', 'System activated');
        }
        
        hideLoading();
    }

    // Stop the system
    function stopSystem() {
        console.log('[Controller] stopSystem called');
        
        if (!systemActive) {
            console.log('[Controller] System not active');
            return;
        }

        if (typeof logEvent === 'function') {
            logEvent('INFO', 'Shutting down system...');
        }

        // Stop detection
        if (typeof detection !== 'undefined' && detection.stopDetection) {
            detection.stopDetection();
        }

        // Stop camera
        if (typeof camera !== 'undefined' && camera.stop) {
            camera.stop();
        }

        // Stop voice
        if (typeof voice !== 'undefined' && voice.stopSpeaking) {
            voice.stopSpeaking();
        }

        // Announce
        if (typeof voice !== 'undefined' && voice.announceStatus) {
            voice.announceStatus('System shutdown complete.');
        }

        // Update UI
        updateStatus('cameraStatus', 'inactive');
        updateStatus('detectionStatus', 'inactive');
        
        if (activateBtn) activateBtn.disabled = false;
        if (shutdownBtn) shutdownBtn.disabled = true;

        // Show loading overlay for restart
        showLoading('SYSTEM OFFLINE');

        if (typeof logEvent === 'function') {
            logEvent('SUCCESS', 'System shutdown complete');
        }

        systemActive = false;
    }

    // Initialize when DOM is ready
    function onDOMReady() {
        console.log('[Controller] DOM ready, initializing...');
        initDOM();
        
        // Initialize modules after a short delay
        setTimeout(function() {
            initModules();
        }, 100);
    }

    // Wait for DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMReady);
    } else {
        onDOMReady();
    }

    // Expose to global
    global.startSystem = startSystem;
    global.stopSystem = stopSystem;

})(window);

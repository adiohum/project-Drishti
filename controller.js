/**
 * Controller module for Project Drishti
 * - Wires up camera, detection and voice systems
 * - Handles UI buttons and status updates
 */

(async function(global) {
    'use strict';

    const activateBtn = document.getElementById('activateBtn');
    const shutdownBtn = document.getElementById('shutdownBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    // Track state
    let systemActive = false;

    // Show loading UI
    function showLoading(msg = 'INITIALIZING...') {
        if (loadingOverlay) {
            loadingText.textContent = msg;
            loadingOverlay.classList.remove('hidden');
        }
    }

    // Hide loading UI
    function hideLoading() {
        if (loadingOverlay) {
            loadingOverlay.classList.add('hidden');
        }
    }

    // Initialize all modules
    async function initModules() {
        showLoading('LOADING VOICE...');
        if (typeof voice !== 'undefined') {
            voice.init();
        }

        showLoading('INITIALIZING CAMERA...');
        camera.init(document.getElementById('videoElement'), {
            onReady: () => {
                if (typeof logEvent === 'function') {
                    logEvent('SUCCESS', 'Camera ready');
                }
            }
        });

        showLoading('LOADING AI MODEL...');
        const detectionOk = await detection.init(
            document.getElementById('videoElement'),
            document.getElementById('overlayCanvas'),
            document.getElementById('radarCanvas')
        );

        if (!detectionOk) {
            hideLoading();
            return false;
        }

        hideLoading();
        return true;
    }

    // Start the system
    async function startSystem() {
        if (systemActive) return;
        systemActive = true;

        activateBtn.disabled = true;
        showLoading('STARTING CAMERA...');
        const camOk = await camera.start();
        if (!camOk) {
            if (typeof logEvent === 'function') {
                logEvent('ERROR', 'Camera failed to start');
            }
            shutdownBtn.disabled = false;
            return;
        }

        showLoading('STARTING DETECTION...');
        detection.startDetection();

        activateBtn.disabled = true;
        shutdownBtn.disabled = false;

        if (typeof voice !== 'undefined') {
            voice.announceStatus('System activated');
        }

        if (typeof logEvent === 'function') {
            logEvent('INFO', 'System activated');
        }
        
        hideLoading();
    }

    // Stop the system
    function stopSystem() {
        if (!systemActive) return;

        camera.stop();
        detection.stopDetection();

        if (typeof voice !== 'undefined') {
            voice.announceStatus('System shutdown');
        }

        activateBtn.disabled = false;
        shutdownBtn.disabled = true;

        if (typeof logEvent === 'function') {
            logEvent('INFO', 'System shutdown');
        }
        
        systemActive = false;
    }

    // Expose to global
    global.startSystem = startSystem;
    global.stopSystem = stopSystem;

})(window);

/**
 * Project Drishti - Camera Module
 * Handles WebRTC camera stream with mobile support
 * 
 * Features:
 * - Mobile-friendly (playsinline, facingMode: environment)
 * - Permission handling
 * - Stream lifecycle management
 * - Callback system for detection initialization
 */

(function(global) {
    'use strict';

    // ============================================
    // CAMERA MODULE STATE
    // ============================================
    const CameraModule = {
        stream: null,
        video: null,
        isRunning: false,
        onReady: null,      // Callback when video metadata loaded
        onError: null,      // Callback for errors
        
        // Status elements
        statusElement: null
    };

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        // Camera constraints
        constraints: {
            video: {
                facingMode: 'environment',  // Rear camera for mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        },
        
        // Mobile detection
        isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
        
        // Retry settings
        maxRetries: 3,
        retryDelay: 1000
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Initialize camera module
     * @param {HTMLVideoElement} videoElement - Video element to use
     * @param {Object} callbacks - Callback functions
     */
    function init(videoElement, callbacks = {}) {
        CameraModule.video = videoElement;
        CameraModule.onReady = callbacks.onReady || null;
        CameraModule.onError = callbacks.onError || null;
        CameraModule.statusElement = document.getElementById('cameraStatus');
        
        // Configure mobile-specific settings
        if (CONFIG.isMobile) {
            CameraModule.video.setAttribute('playsinline', '');
            CameraModule.video.setAttribute('autoplay', '');
            CameraModule.video.setAttribute('muted', '');
        }
        
        if (typeof logEvent === 'function') {
            logEvent('INFO', 'Camera module initialized');
        }
    }

    // ============================================
    // CAMERA START
    // ============================================
    
    /**
     * Start camera stream
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<boolean>} Success status
     */
    async function start(retryCount = 0) {
        if (CameraModule.isRunning) {
            console.warn('[Camera] Already running');
            return true;
        }

        try {
            updateStatus('loading');
            
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia not supported in this browser');
            }

            if (typeof logEvent === 'function') {
                logEvent('INFO', 'Requesting camera access...');
            }

            // Request camera access
            CameraModule.stream = await navigator.mediaDevices.getUserMedia(CONFIG.constraints);
            
            if (typeof logEvent === 'function') {
                logEvent('SUCCESS', 'Camera permission granted');
            }

            // Set video source
            CameraModule.video.srcObject = CameraModule.stream;
            
            // Wait for video metadata to load
            await new Promise((resolve, reject) => {
                const onLoadedMetadata = () => {
                    CameraModule.video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    CameraModule.video.removeEventListener('error', onError);
                    resolve();
                };
                
                const onError = (e) => {
                    CameraModule.video.removeEventListener('loadedmetadata', onLoadedMetadata);
                    CameraModule.video.removeEventListener('error', onError);
                    reject(new Error('Video element error: ' + (e.message || 'Unknown error')));
                };
                
                CameraModule.video.addEventListener('loadedmetadata', onLoadedMetadata);
                CameraModule.video.addEventListener('error', onError);
                
                // Timeout fallback
                setTimeout(() => {
                    reject(new Error('Video metadata load timeout'));
                }, 10000);
            });

            // Start playing
            await CameraModule.video.play();
            
            CameraModule.isRunning = true;
            updateStatus('active');
            
            if (typeof logEvent === 'function') {
                logEvent('SUCCESS', `Camera started: ${CameraModule.video.videoWidth}x${CameraModule.video.videoHeight}`);
            }

            // Trigger onReady callback
            if (CameraModule.onReady && typeof CameraModule.onReady === 'function') {
                CameraModule.onReady({
                    width: CameraModule.video.videoWidth,
                    height: CameraModule.video.videoHeight,
                    stream: CameraModule.stream
                });
            }

            return true;

        } catch (error) {
            console.error('[Camera] Error:', error);
            
            let errorMessage = error.message;
            
            // Handle specific error types
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                errorMessage = 'Camera permission denied. Please allow camera access and refresh.';
                updateStatus('error');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                errorMessage = 'No camera found on this device.';
                updateStatus('error');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                errorMessage = 'Camera is already in use by another application.';
                updateStatus('error');
            } else if (error.name === 'OverconstrainedError') {
                // Try fallback constraints
                if (retryCount === 0) {
                    if (typeof logEvent === 'function') {
                        logEvent('WARN', 'Trying fallback camera constraints...');
                    }
                    CONFIG.constraints.video = { facingMode: 'user' };
                    return start(retryCount + 1);
                }
                errorMessage = 'Camera does not meet requirements.';
                updateStatus('error');
            } else {
                updateStatus('error');
            }

            if (typeof logEvent === 'function') {
                logEvent('ERROR', errorMessage);
            }

            // Trigger onError callback
            if (CameraModule.onError && typeof CameraModule.onError === 'function') {
                CameraModule.onError(error);
            }

            // Retry logic
            if (retryCount < CONFIG.maxRetries && error.name !== 'NotAllowedError') {
                if (typeof logEvent === 'function') {
                    logEvent('INFO', `Retrying camera start (${retryCount + 1}/${CONFIG.maxRetries})...`);
                }
                await sleep(CONFIG.retryDelay);
                return start(retryCount + 1);
            }

            return false;
        }
    }

    // ============================================
    // CAMERA STOP
    // ============================================
    
    /**
     * Stop camera stream
     */
    function stop() {
        if (!CameraModule.isRunning && !CameraModule.stream) {
            return;
        }

        try {
            // Stop all tracks
            if (CameraModule.stream) {
                CameraModule.stream.getTracks().forEach(track => {
                    track.stop();
                });
                CameraModule.stream = null;
            }

            // Clear video source
            if (CameraModule.video) {
                CameraModule.video.srcObject = null;
            }

            CameraModule.isRunning = false;
            updateStatus('inactive');
            
            if (typeof logEvent === 'function') {
                logEvent('INFO', 'Camera stopped');
            }

        } catch (error) {
            console.error('[Camera] Error stopping:', error);
            if (typeof logEvent === 'function') {
                logEvent('ERROR', 'Error stopping camera: ' + error.message);
            }
        }
    }

    // ============================================
    // STATUS UPDATE
    // ============================================
    
    /**
     * Update status indicator
     * @param {string} status - Status type (loading, active, error, inactive)
     */
    function updateStatus(status) {
        if (!CameraModule.statusElement) return;

        // Remove all status classes
        CameraModule.statusElement.classList.remove('active', 'error', 'loading');
        
        // Add appropriate class
        switch (status) {
            case 'active':
                CameraModule.statusElement.classList.add('active');
                break;
            case 'error':
                CameraModule.statusElement.classList.add('error');
                break;
            case 'loading':
                CameraModule.statusElement.classList.add('loading');
                break;
            default:
                // Inactive - no class
                break;
        }
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get current video dimensions
     * @returns {Object} Width and height
     */
    function getDimensions() {
        if (!CameraModule.video) return { width: 0, height: 0 };
        return {
            width: CameraModule.video.videoWidth || 0,
            height: CameraModule.video.videoHeight || 0
        };
    }

    /**
     * Check if camera is running
     * @returns {boolean} Running state
     */
    function isRunning() {
        return CameraModule.isRunning;
    }

    /**
     * Get video element
     * @returns {HTMLVideoElement} Video element
     */
    function getVideo() {
        return CameraModule.video;
    }

    /**
     * Get stream
     * @returns {MediaStream} Media stream
     */
    function getStream() {
        return CameraModule.stream;
    }

    // ============================================
    // SWITCH CAMERA (Mobile)
    // ============================================
    
    /**
     * Switch between front and back camera
     * @returns {Promise<boolean>} Success status
     */
    async function switchCamera() {
        if (!CameraModule.isRunning) {
            console.warn('[Camera] Not running, cannot switch');
            return false;
        }

        try {
            // Stop current stream
            stop();
            
            // Toggle facing mode
            const currentMode = CONFIG.constraints.video.facingMode;
            CONFIG.constraints.video.facingMode = currentMode === 'environment' ? 'user' : 'environment';
            
            // Restart with new facing mode
            await sleep(100);
            return await start();

        } catch (error) {
            console.error('[Camera] Error switching camera:', error);
            if (typeof logEvent === 'function') {
                logEvent('ERROR', 'Error switching camera: ' + error.message);
            }
            return false;
        }
    }

    // ============================================
    // EXPOSE TO GLOBAL
    // ============================================
    global.camera = {
        init: init,
        start: start,
        stop: stop,
        isRunning: isRunning,
        getVideo: getVideo,
        getStream: getStream,
        getDimensions: getDimensions,
        switchCamera: switchCamera
    };

})(window);

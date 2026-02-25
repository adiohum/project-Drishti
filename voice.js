/**
 * Project Drishti - Voice Module
 * Handles Web Speech API for voice announcements
 * 
 * Features:
 * - Cooldown timer to prevent overlapping speech
 * - Queue management
 * - Error handling for unsupported browsers
 * - Mobile support
 */

(function(global) {
    'use strict';

    // ============================================
    // VOICE MODULE STATE
    // ============================================
    const VoiceModule = {
        synthesis: null,
        currentUtterance: null,
        isSpeaking: false,
        isSupported: false,
        
        // Cooldown tracking
        lastSpokenTime: 0,
        cooldownActive: false,
        
        // Announcement tracking (to prevent repetition)
        lastAnnounced: {},
        
        // Status element
        statusElement: null
    };

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        // Cooldown in milliseconds (2-3 seconds)
        cooldownDuration: 2500,
        
        // Speech rate
        rate: 1.0,
        
        // Speech pitch
        pitch: 1.0,
        
        // Speech volume
        volume: 1.0,
        
        // Voice preference (prefer English voices)
        preferredLang: 'en-US',
        
        // Default voice name patterns (prefer higher quality)
        preferredVoicePatterns: ['Google', 'Microsoft', 'Samantha', 'Alex', 'Daniel']
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Initialize voice module
     */
    function init() {
        VoiceModule.statusElement = document.getElementById('voiceStatus');
        
        // Check if Web Speech API is supported
        if (!('speechSynthesis' in window)) {
            VoiceModule.isSupported = false;
            updateStatus('error');
            
            if (typeof logEvent === 'function') {
                logEvent('WARN', 'Web Speech API not supported in this browser');
            }
            return false;
        }

        VoiceModule.synthesis = window.speechSynthesis;
        VoiceModule.isSupported = true;
        
        // Load voices (they may load asynchronously)
        loadVoices();
        
        // Handle voice list changes (some browsers load voices async)
        if (VoiceModule.synthesis.onvoiceschanged !== undefined) {
            VoiceModule.synthesis.onvoiceschanged = loadVoices;
        }

        updateStatus('active');
        
        if (typeof logEvent === 'function') {
            logEvent('SUCCESS', 'Voice module initialized');
        }
        
        return true;
    }

    // ============================================
    // VOICE LOADING
    // ============================================
    
    let availableVoices = [];
    
    /**
     * Load available voices
     */
    function loadVoices() {
        if (!VoiceModule.synthesis) return;
        
        const voices = VoiceModule.synthesis.getVoices();
        
        if (voices.length === 0) {
            return;
        }
        
        availableVoices = voices;
        
        // Find preferred voice
        let preferredVoice = null;
        
        // First try to find a voice matching our preferred patterns
        for (const pattern of CONFIG.preferredVoicePatterns) {
            preferredVoice = voices.find(v => 
                v.name.includes(pattern) && v.lang.startsWith('en')
            );
            if (preferredVoice) break;
        }
        
        // Fallback to any English voice
        if (!preferredVoice) {
            preferredVoice = voices.find(v => v.lang.startsWith('en'));
        }
        
        // Last resort: use first available voice
        if (!preferredVoice && voices.length > 0) {
            preferredVoice = voices[0];
        }
        
        if (preferredVoice && typeof logEvent === 'function') {
            logEvent('INFO', `Voice selected: ${preferredVoice.name} (${preferredVoice.lang})`);
        }
        
        CONFIG.selectedVoice = preferredVoice;
    }

    // ============================================
    // SPEAK FUNCTION
    // ============================================
    
    /**
     * Speak text using Web Speech API
     * @param {string} text - Text to speak
     * @param {Object} options - Optional settings
     * @returns {boolean} Success status
     */
    function speak(text, options = {}) {
        // Check if speech is supported
        if (!VoiceModule.isSupported) {
            console.warn('[Voice] Web Speech API not supported');
            return false;
        }

        // Check cooldown
        const now = Date.now();
        const timeSinceLastSpoken = now - VoiceModule.lastSpokenTime;
        
        if (timeSinceLastSpoken < CONFIG.cooldownDuration && !options.force) {
            console.log('[Voice] Cooldown active, skipping:', text);
            return false;
        }

        // Check for duplicate announcement within cooldown
        const announcementKey = text.toLowerCase().trim();
        if (VoiceModule.lastAnnounced[announcementKey] && 
            now - VoiceModule.lastAnnounced[announcementKey] < CONFIG.cooldownDuration * 2) {
            console.log('[Voice] Duplicate announcement blocked:', text);
            return false;
        }

        try {
            // Cancel any existing speech
            if (VoiceModule.synthesis.speaking) {
                VoiceModule.synthesis.cancel();
            }

            // Create new utterance
            const utterance = new SpeechSynthesisUtterance(text);
            
            // Configure utterance
            utterance.rate = options.rate || CONFIG.rate;
            utterance.pitch = options.pitch || CONFIG.pitch;
            utterance.volume = options.volume || CONFIG.volume;
            utterance.lang = options.lang || CONFIG.preferredLang;
            
            // Set voice if available
            if (CONFIG.selectedVoice) {
                utterance.voice = CONFIG.selectedVoice;
            }

            // Event handlers
            utterance.onstart = () => {
                VoiceModule.isSpeaking = true;
                updateStatus('active');
            };

            utterance.onend = () => {
                VoiceModule.isSpeaking = false;
                VoiceModule.lastSpokenTime = Date.now();
                VoiceModule.lastAnnounced[announcementKey] = Date.now();
            };

            utterance.onerror = (event) => {
                VoiceModule.isSpeaking = false;
                console.error('[Voice] Speech error:', event.error);
                
                if (event.error !== 'canceled' && typeof logEvent === 'function') {
                    logEvent('ERROR', 'Speech error: ' + event.error);
                }
            };

            // Speak
            VoiceModule.synthesis.speak(utterance);
            VoiceModule.currentUtterance = utterance;
            
            if (typeof logEvent === 'function') {
                logEvent('INFO', `Speaking: "${text}"`);
            }
            
            return true;

        } catch (error) {
            console.error('[Voice] Error:', error);
            
            if (typeof logEvent === 'function') {
                logEvent('ERROR', 'Voice error: ' + error.message);
            }
            
            return false;
        }
    }

    // ============================================
    // SPECIALIZED ANNOUNCEMENT FUNCTIONS
    // ============================================
    
    /**
     * Announce object detected
     * @param {string} className - Object class name
     * @param {number} distance - Distance in meters (optional)
     */
    function announceObjectDetected(className, distance = null) {
        let text = className + ' detected';
        
        if (distance !== null && distance > 0) {
            const distanceText = distance < 1 
                ? Math.round(distance * 100) + ' centimeters'
                : distance.toFixed(1) + ' meters';
            text += ', approximately ' + distanceText + ' away';
        }
        
        return speak(text, { force: false });
    }

    /**
     * Announce object left
     * @param {string} className - Object class name
     */
    function announceObjectLeft(className) {
        return speak(className + ' no longer visible', { force: false });
    }

    /**
     * Announce system status
     * @param {string} status - Status message
     */
    function announceStatus(status) {
        return speak(status, { force: true });
    }

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================
    
    /**
     * Stop current speech
     */
    function stopSpeaking() {
        if (!VoiceModule.isSupported || !VoiceModule.synthesis) return;
        
        if (VoiceModule.synthesis.speaking) {
            VoiceModule.synthesis.cancel();
            VoiceModule.isSpeaking = false;
        }
    }

    /**
     * Check if currently speaking
     * @returns {boolean} Speaking state
     */
    function isSpeaking() {
        return VoiceModule.isSpeaking;
    }

    /**
     * Check if voice is supported
     * @returns {boolean} Support state
     */
    function isSupported() {
        return VoiceModule.isSupported;
    }

    /**
     * Update status indicator
     * @param {string} status - Status type
     */
    function updateStatus(status) {
        if (!VoiceModule.statusElement) return;

        VoiceModule.statusElement.classList.remove('active', 'error', 'loading');
        
        switch (status) {
            case 'active':
                VoiceModule.statusElement.classList.add('active');
                break;
            case 'error':
                VoiceModule.statusElement.classList.add('error');
                break;
            case 'loading':
                VoiceModule.statusElement.classList.add('loading');
                break;
            default:
                break;
        }
    }

    /**
     * Clear announcement history
     */
    function clearHistory() {
        VoiceModule.lastAnnounced = {};
    }

    /**
     * Set cooldown duration
     * @param {number} duration - Duration in milliseconds
     */
    function setCooldownDuration(duration) {
        if (duration >= 500 && duration <= 10000) {
            CONFIG.cooldownDuration = duration;
        }
    }

    /**
     * Force speak (bypass cooldown)
     * @param {string} text - Text to speak
     */
    function forceSpeak(text) {
        return speak(text, { force: true });
    }

    // ============================================
    // EXPOSE TO GLOBAL
    // ============================================
    global.voice = {
        init: init,
        speak: speak,
        stopSpeaking: stopSpeaking,
        isSpeaking: isSpeaking,
        isSupported: isSupported,
        announceObjectDetected: announceObjectDetected,
        announceObjectLeft: announceObjectLeft,
        announceStatus: announceStatus,
        clearHistory: clearHistory,
        setCooldownDuration: setCooldownDuration,
        forceSpeak: forceSpeak
    };

})(window);

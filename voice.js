/**
 * Project Drishti - Voice Module
 */

(function(global) {
    'use strict';

    const VoiceModule = {
        synthesis: null,
        isSpeaking: false,
        isSupported: false,
        lastSpokenTime: 0,
        lastAnnounced: new Map()
    };

    const CONFIG = {
        cooldownDuration: 4000,  // 4 seconds between announcements
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        preferredLang: 'en-US'
    };

    function init() {
        const statusEl = document.getElementById('voiceStatus');
        
        if (!('speechSynthesis' in window)) {
            VoiceModule.isSupported = false;
            if (statusEl) statusEl.classList.add('error');
            if (typeof logEvent === 'function') logEvent('WARN', 'Web Speech API not supported');
            return false;
        }

        VoiceModule.synthesis = window.speechSynthesis;
        VoiceModule.isSupported = true;
        
        if (statusEl) statusEl.classList.add('active');
        if (typeof logEvent === 'function') logEvent('SUCCESS', 'Voice module initialized');
        
        return true;
    }

    function speak(text, options) {
        options = options || {};
        
        if (!VoiceModule.isSupported) return false;

        const now = Date.now();
        const timeSinceLast = now - VoiceModule.lastSpokenTime;
        
        // Check cooldown (skip if force=true)
        if (!options.force && timeSinceLast < CONFIG.cooldownDuration) {
            console.log('[Voice] Cooldown active, skipping:', text);
            return false;
        }

        // Check duplicate announcement
        const key = text.toLowerCase();
        if (!options.force) {
            const lastTime = VoiceModule.lastAnnounced.get(key);
            if (lastTime && now - lastTime < CONFIG.cooldownDuration * 3) {
                console.log('[Voice] Duplicate blocked:', text);
                return false;
            }
        }

        try {
            // Cancel current speech before new one
            if (VoiceModule.synthesis.speaking) {
                VoiceModule.synthesis.cancel();
            }

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = CONFIG.rate;
            utterance.pitch = CONFIG.pitch;
            utterance.volume = CONFIG.volume;
            utterance.lang = CONFIG.preferredLang;

            utterance.onstart = function() {
                VoiceModule.isSpeaking = true;
            };

            utterance.onend = function() {
                VoiceModule.isSpeaking = false;
                VoiceModule.lastSpokenTime = Date.now();
                VoiceModule.lastAnnounced.set(key, Date.now());
            };

            utterance.onerror = function() {
                VoiceModule.isSpeaking = false;
            };

            VoiceModule.synthesis.speak(utterance);
            
            if (typeof logEvent === 'function') {
                logEvent('INFO', 'Speaking: ' + text);
            }
            
            return true;

        } catch (e) {
            console.error('[Voice] Error:', e);
            return false;
        }
    }

    function announceObjectDetected(className, distance) {
        let text = className + ' detected';
        if (distance && distance > 0) {
            if (distance < 1) {
                text += ', ' + Math.round(distance * 100) + ' centimeters away';
            } else {
                text += ', ' + distance.toFixed(1) + ' meters away';
            }
        }
        return speak(text);
    }

    function announceObjectLeft(className) {
        return speak(className + ' no longer visible');
    }

    function announceStatus(status) {
        return speak(status, { force: true });
    }

    function stopSpeaking() {
        if (VoiceModule.synthesis) {
            VoiceModule.synthesis.cancel();
            VoiceModule.isSpeaking = false;
        }
    }

    function isSpeaking() {
        return VoiceModule.isSpeaking;
    }

    function clearHistory() {
        VoiceModule.lastAnnounced.clear();
    }

    global.voice = {
        init: init,
        speak: speak,
        stopSpeaking: stopSpeaking,
        isSpeaking: isSpeaking,
        announceObjectDetected: announceObjectDetected,
        announceObjectLeft: announceObjectLeft,
        announceStatus: announceStatus,
        clearHistory: clearHistory
    };

})(window);

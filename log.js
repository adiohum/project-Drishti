/**
 * Project Drishti - Log Module
 * Handles event logging with floating console panel
 * 
 * Features:
 * - Floating, draggable console panel
 * - Color-coded log levels
 * - Timestamp for each entry
 * - Error resilience (won't break system if panel removed)
 * - Max entries limit to prevent memory issues
 */

(function(global) {
    'use strict';

    // ============================================
    // LOG MODULE STATE
    // ============================================
    const LogModule = {
        panel: null,
        content: null,
        isVisible: true,
        entryCount: 0,
        isDragging: false,
        dragOffset: { x: 0, y: 0 }
    };

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        // Maximum entries before auto-cleanup
        maxEntries: 200,
        
        // Auto-scroll to bottom
        autoScroll: true,
        
        // Panel dimensions
        panelWidth: '350px',
        panelHeight: '250px',
        
        // Initial position
        initialPosition: {
            bottom: '20px',
            left: '20px'
        },
        
        // Log level colors
        colors: {
            INFO: '#00ffff',
            SUCCESS: '#00ff00',
            WARN: '#ffaa00',
            ERROR: '#ff0055',
            DEBUG: '#888888'
        },
        
        // Prefixes for log levels
        prefixes: {
            INFO: '[INFO]',
            SUCCESS: '[OK]',
            WARN: '[WARN]',
            ERROR: '[ERR]',
            DEBUG: '[DBG]'
        }
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    
    /**
     * Initialize log module and create panel
     */
    function init() {
        try {
            createPanel();
            
            // Log initialization
            logEvent('SUCCESS', 'Log system initialized');
            
            return true;
        } catch (error) {
            console.error('[Log] Initialization error:', error);
            return false;
        }
    }

    // ============================================
    // PANEL CREATION
    // ============================================
    
    /**
     * Create the floating log panel
     */
    function createPanel() {
        // Check if panel already exists
        if (document.getElementById('logPanel')) {
            LogModule.panel = document.getElementById('logPanel');
            LogModule.content = document.getElementById('logContent');
            return;
        }

        // Create panel container
        LogModule.panel = document.createElement('div');
        LogModule.panel.id = 'logPanel';
        LogModule.panel.style.cssText = `
            position: fixed;
            bottom: ${CONFIG.initialPosition.bottom};
            left: ${CONFIG.initialPosition.left};
            width: ${CONFIG.panelWidth};
            height: ${CONFIG.panelHeight};
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(0, 255, 255, 0.3);
            border-radius: 8px;
            z-index: 9999;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 11px;
            box-shadow: 0 0 20px rgba(0, 255, 255, 0.2);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            resize: both;
            min-width: 200px;
            min-height: 100px;
        `;

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            background: rgba(0, 255, 255, 0.1);
            padding: 8px 12px;
            border-bottom: 1px solid rgba(0, 255, 255, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        `;
        header.innerHTML = `
            <span style="color: #00ffff; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">
                System Log
            </span>
            <div style="display: flex; gap: 8px;">
                <button id="logClearBtn" style="
                    background: transparent;
                    border: 1px solid rgba(255, 170, 0, 0.5);
                    color: #ffaa00;
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                ">CLEAR</button>
                <button id="logToggleBtn" style="
                    background: transparent;
                    border: 1px solid rgba(0, 255, 255, 0.5);
                    color: #00ffff;
                    padding: 2px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 10px;
                ">_</button>
            </div>
        `;

        // Create content area
        LogModule.content = document.createElement('div');
        LogModule.content.id = 'logContent';
        LogModule.content.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            scrollbar-width: thin;
            scrollbar-color: rgba(0, 255, 255, 0.3) transparent;
        `;

        // Add scrollbar styles
        const style = document.createElement('style');
        style.textContent = `
            #logContent::-webkit-scrollbar {
                width: 6px;
            }
            #logContent::-webkit-scrollbar-track {
                background: transparent;
            }
            #logContent::-webkit-scrollbar-thumb {
                background: rgba(0, 255, 255, 0.3);
                border-radius: 3px;
            }
            #logContent::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 255, 255, 0.5);
            }
            .log-entry {
                padding: 3px 0;
                border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                line-height: 1.4;
            }
            .log-entry:last-child {
                border-bottom: none;
            }
            .log-time {
                color: #666;
                margin-right: 8px;
            }
            .log-prefix {
                font-weight: bold;
                margin-right: 8px;
            }
            .log-message {
                color: #ccc;
            }
        `;
        document.head.appendChild(style);

        // Assemble panel
        LogModule.panel.appendChild(header);
        LogModule.panel.appendChild(LogModule.content);
        document.body.appendChild(LogModule.panel);

        // Add event listeners
        setupEventListeners(header);
    }

    // ============================================
    // EVENT LISTENERS
    // ============================================
    
    /**
     * Setup event listeners for panel interactions
     * @param {HTMLElement} header - Panel header element
     */
    function setupEventListeners(header) {
        // Clear button
        const clearBtn = document.getElementById('logClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                clearLog();
            });
        }

        // Toggle button
        const toggleBtn = document.getElementById('logToggleBtn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleVisibility();
            });
        }

        // Dragging
        header.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);

        // Touch support for mobile
        header.addEventListener('touchstart', startDragTouch, { passive: false });
        document.addEventListener('touchmove', dragTouch, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    // ============================================
    // DRAG HANDLING
    // ============================================
    
    function startDrag(e) {
        if (e.target.tagName === 'BUTTON') return;
        
        LogModule.isDragging = true;
        const rect = LogModule.panel.getBoundingClientRect();
        LogModule.dragOffset.x = e.clientX - rect.left;
        LogModule.dragOffset.y = e.clientY - rect.top;
        
        LogModule.panel.style.right = 'auto';
        LogModule.panel.style.bottom = 'auto';
    }

    function startDragTouch(e) {
        if (e.target.tagName === 'BUTTON') return;
        
        e.preventDefault();
        LogModule.isDragging = true;
        const touch = e.touches[0];
        const rect = LogModule.panel.getBoundingClientRect();
        LogModule.dragOffset.x = touch.clientX - rect.left;
        LogModule.dragOffset.y = touch.clientY - rect.top;
        
        LogModule.panel.style.right = 'auto';
        LogModule.panel.style.bottom = 'auto';
    }

    function drag(e) {
        if (!LogModule.isDragging) return;
        
        const x = e.clientX - LogModule.dragOffset.x;
        const y = e.clientY - LogModule.dragOffset.y;
        
        // Keep within viewport
        const maxX = window.innerWidth - LogModule.panel.offsetWidth;
        const maxY = window.innerHeight - LogModule.panel.offsetHeight;
        
        LogModule.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        LogModule.panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    }

    function dragTouch(e) {
        if (!LogModule.isDragging) return;
        
        e.preventDefault();
        const touch = e.touches[0];
        const x = touch.clientX - LogModule.dragOffset.x;
        const y = touch.clientY - LogModule.dragOffset.y;
        
        const maxX = window.innerWidth - LogModule.panel.offsetWidth;
        const maxY = window.innerHeight - LogModule.panel.offsetHeight;
        
        LogModule.panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        LogModule.panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    }

    function stopDrag() {
        LogModule.isDragging = false;
    }

    // ============================================
    // LOG FUNCTIONS
    // ============================================
    
    /**
     * Log an event
     * @param {string} level - Log level (INFO, SUCCESS, WARN, ERROR, DEBUG)
     * @param {string} message - Log message
     */
    function logEvent(level, message) {
        // Always log to console as backup
        const consoleMethod = level === 'ERROR' ? 'error' : 
                             level === 'WARN' ? 'warn' : 'log';
        console[consoleMethod](`[${level}] ${message}`);

        // Try to log to panel
        try {
            if (!LogModule.content) return;

            // Create entry element
            const entry = document.createElement('div');
            entry.className = 'log-entry';

            // Get timestamp
            const now = new Date();
            const time = now.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            });

            // Get color for level
            const color = CONFIG.colors[level] || CONFIG.colors.INFO;
            const prefix = CONFIG.prefixes[level] || '[LOG]';

            entry.innerHTML = `
                <span class="log-time">${time}</span>
                <span class="log-prefix" style="color: ${color}">${prefix}</span>
                <span class="log-message">${escapeHtml(message)}</span>
            `;

            // Add to content
            LogModule.content.appendChild(entry);
            LogModule.entryCount++;

            // Auto-cleanup old entries
            if (LogModule.entryCount > CONFIG.maxEntries) {
                const entries = LogModule.content.querySelectorAll('.log-entry');
                if (entries.length > CONFIG.maxEntries / 2) {
                    for (let i = 0; i < entries.length - CONFIG.maxEntries / 2; i++) {
                        entries[i].remove();
                    }
                    LogModule.entryCount = LogModule.content.querySelectorAll('.log-entry').length;
                }
            }

            // Auto-scroll to bottom
            if (CONFIG.autoScroll) {
                LogModule.content.scrollTop = LogModule.content.scrollHeight;
            }

        } catch (error) {
            // Don't let logging errors break the system
            console.error('[Log] Panel error:', error);
        }
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clear all log entries
     */
    function clearLog() {
        if (LogModule.content) {
            LogModule.content.innerHTML = '';
            LogModule.entryCount = 0;
        }
    }

    /**
     * Toggle panel visibility
     */
    function toggleVisibility() {
        if (!LogModule.panel) return;
        
        LogModule.isVisible = !LogModule.isVisible;
        LogModule.panel.style.display = LogModule.isVisible ? 'flex' : 'none';
        
        const toggleBtn = document.getElementById('logToggleBtn');
        if (toggleBtn) {
            toggleBtn.textContent = LogModule.isVisible ? '_' : '□';
        }
    }

    /**
     * Show panel
     */
    function show() {
        if (!LogModule.panel) return;
        LogModule.isVisible = true;
        LogModule.panel.style.display = 'flex';
    }

    /**
     * Hide panel
     */
    function hide() {
        if (!LogModule.panel) return;
        LogModule.isVisible = false;
        LogModule.panel.style.display = 'none';
    }

    /**
     * Get log entries as text
     * @returns {string} All log entries
     */
    function getLogText() {
        if (!LogModule.content) return '';
        
        const entries = LogModule.content.querySelectorAll('.log-entry');
        return Array.from(entries).map(entry => entry.textContent).join('\n');
    }

    // ============================================
    // EXPOSE TO GLOBAL
    // ============================================
    global.logEvent = logEvent;
    
    global.logModule = {
        init: init,
        clear: clearLog,
        show: show,
        hide: hide,
        toggle: toggleVisibility,
        getText: getLogText,
        log: logEvent
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})(window);

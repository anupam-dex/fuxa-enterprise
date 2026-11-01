/**
 * FUXA Enterprise - Custom URL & Project Name Manager
 * Integrated directly inside the Settings (⚙️) Setup Card with native FUXA styling
 */

(function () {
    console.log('[FUXA-Enterprise] Settings Custom URL & Project Manager active.');

    let liveProjectName = localStorage.getItem('fuxa_project_name') || '';

    function getBasePath() {
        if (window.__BASE_PATH__) return window.__BASE_PATH__;
        const match = window.location.pathname.match(/^(\/p\d+\/[^/]+\/[^/]+)/);
        if (match) return match[1];
        return localStorage.getItem('fuxa_base_path') || '/p9/div6/l1';
    }

    function setBasePath(newPath) {
        let clean = '/' + newPath.replace(/^\/+|\/+$/g, '');
        window.__BASE_PATH__ = clean;
        localStorage.setItem('fuxa_base_path', clean);
        return clean;
    }

    function getTargetPort() {
        if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
            const p = parseInt(window.location.port, 10);
            localStorage.setItem('fuxa_target_port', p);
            return p;
        }
        return parseInt(localStorage.getItem('fuxa_target_port') || '9610', 10);
    }

    function updateHeaderBadge(name) {
        if (!name) return;
        document.title = `${name} - FUXA SCADA`;
        const headerPanel = document.querySelector('app-header .header-panel, .header-panel');
        if (headerPanel) {
            let badge = document.getElementById('fuxa-header-project-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.id = 'fuxa-header-project-badge';
                badge.style.cssText = 'display: inline-flex; align-items: center; gap: 8px; margin-left: 12px; padding: 4px 12px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 4px; color: #38bdf8; font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600; cursor: default; user-select: none; -webkit-user-select: none;';
                headerPanel.appendChild(badge);
            }
            badge.innerHTML = `<span style="opacity: 0.65; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase;">Project:</span> <span id="fuxa-header-project-name">${name}</span>`;
        }
    }

    async function fetchLiveProjectName() {
        try {
            const res = await fetch('api/project-name');
            if (res.ok) {
                const data = await res.json();
                if (data.name) {
                    liveProjectName = data.name;
                    localStorage.setItem('fuxa_project_name', liveProjectName);
                    updateHeaderBadge(liveProjectName);
                    return liveProjectName;
                }
            }
        } catch (e) {
            try {
                const res2 = await fetch('/api/project-name');
                if (res2.ok) {
                    const data2 = await res2.json();
                    if (data2.name) {
                        liveProjectName = data2.name;
                        localStorage.setItem('fuxa_project_name', liveProjectName);
                        updateHeaderBadge(liveProjectName);
                        return liveProjectName;
                    }
                }
            } catch (e2) {}
        }
        return liveProjectName || 'SCADA Line';
    }

    async function saveProjectName(newName) {
        if (!newName || !newName.trim()) return;
        const cleanName = newName.trim();
        liveProjectName = cleanName;
        localStorage.setItem('fuxa_project_name', cleanName);
        updateHeaderBadge(cleanName);

        const payload = JSON.stringify({ name: cleanName });
        try {
            await fetch('api/project-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            console.log(`[FUXA] Project Name saved to database: ${cleanName}`);
        } catch (e) {
            try {
                await fetch('/api/project-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
            } catch (e2) {}
        }
    }

    async function syncSubpathToGateway(newSubpath, customPort, customName) {
        const port = customPort || getTargetPort();
        const host = window.location.hostname || '127.0.0.1';
        const payload = JSON.stringify({ subpath: newSubpath, port: port, name: customName });

        if (customName) {
            await saveProjectName(customName);
        }

        // 1. Update same-origin FUXA Server endpoint
        try {
            await fetch('api/custom-subpath', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            console.log(`[FUXA] Same-origin subpath registered: ${newSubpath}`);
        } catch (e) {
            try {
                await fetch('/api/custom-subpath', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
            } catch (e2) {}
        }

        // 2. Update Gateway (Port 80)
        try {
            await fetch(`http://${host}/api/gateway/subpath`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            console.log(`[FUXA-Gateway] Registered route on Port 80: ${newSubpath} -> Port ${port}`);
        } catch (e) {
            console.warn('[FUXA-Gateway] Gateway sync warning:', e);
        }

        // 3. Update Fleet Manager (Port 9000)
        try {
            await fetch(`http://${host}:9000/api/update-subpath`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            console.log(`[FUXA-Manager] Registered route on Port 9000: ${newSubpath} -> Port ${port}`);
        } catch (e) {
            console.warn('[FUXA-Manager] Manager sync warning:', e);
        }
    }

    function getHostUrl() {
        return `${window.location.protocol}//${window.location.hostname}`;
    }

    function getCurrentViewName() {
        const parts = window.location.pathname.split('/');
        const last = parts[parts.length - 1];
        if (last && last !== 'editor' && last !== 'home' && last !== '') {
            return last;
        }
        const activeTab = document.querySelector('.mat-mdc-tab.mdc-tab--active, .mat-tab-label-active');
        if (activeTab) {
            return activeTab.textContent.trim();
        }
        return '';
    }

    // Remove any legacy/stale Page URL button from the main header toolbar
    function removeHeaderPageUrlButton() {
        const btns = document.querySelectorAll('button, a, div');
        btns.forEach(btn => {
            if (btn.id === 'fuxa-header-page-url-btn' || 
                (btn.textContent && btn.textContent.trim().includes('Page URL') && !btn.closest('.custom-url-setting-field'))) {
                if (btn.closest('app-header') || btn.closest('.header-left') || btn.closest('.header-right') || btn.closest('.my-toolbar') || btn.parentNode === document.querySelector('.header-left')) {
                    btn.remove();
                }
            }
        });
        updateHeaderBadge(liveProjectName);
    }

    // Observe Settings Dialog (⚙️) to inject Custom Subpath & Page URLs card
    function observeSettingsDialog() {
        removeHeaderPageUrlButton();
        const observer = new MutationObserver(() => {
            removeHeaderPageUrlButton();
            const dialog = document.querySelector('app-app-settings, .mat-mdc-dialog-container');
            if (dialog && !dialog.querySelector('.custom-url-setting-field')) {
                const portInput = dialog.querySelector('input[numberonly], input[disabled]');
                if (portInput) {
                    const portContainer = portInput.closest('.my-form-field') || portInput.parentElement;
                    if (portContainer) {
                        const customDiv = document.createElement('div');
                        customDiv.className = 'custom-url-setting-field';
                        customDiv.style.cssText = 'width: 320px;';
                        
                        const currentSubpath = getBasePath();
                        const currentProjectName = liveProjectName || 'EMS';
                        const hostUrl = getHostUrl();
                        const viewName = getCurrentViewName();
                        const fullViewUrl = viewName ? `${hostUrl}${currentSubpath}/home/${viewName}` : `${hostUrl}${currentSubpath}/home`;
                        const fullEditorUrl = `${hostUrl}${currentSubpath}/editor`;

                        customDiv.innerHTML = `
                            <!-- Project Name Setting -->
                            <div class="my-form-field block mt15 system-input">
                                <span>Project Name</span>
                                <div style="display: flex; gap: 6px; align-items: center; width: 320px;">
                                    <input id="fuxa-project-name-input" type="text" value="${currentProjectName}" placeholder="e.g. EMS" 
                                           style="flex: 1; height: 32px; padding: 4px 8px; font-size: 13px; font-family: inherit; border: none; border-radius: 2px; background-color: var(--formInputBackground, rgba(255,255,255,0.06)); color: var(--formInputColor, inherit); box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important; cursor: text !important;" />
                                </div>
                            </div>

                            <!-- Custom URL / Subpath Setting -->
                            <div class="my-form-field block mt15 system-input">
                                <span>Custom URL / Subpath</span>
                                <div style="display: flex; gap: 6px; align-items: center; width: 320px;">
                                    <input id="fuxa-subpath-input" type="text" value="${currentSubpath}" placeholder="/p9/ps/ems" 
                                           style="flex: 1; height: 32px; padding: 4px 8px; font-size: 13px; font-family: monospace; border: none; border-radius: 2px; background-color: var(--formInputBackground, rgba(255,255,255,0.06)); color: var(--formInputColor, inherit); box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important; cursor: text !important;" />
                                    <button id="fuxa-subpath-save-btn" type="button" 
                                            style="height: 32px; padding: 0 14px; font-size: 12px; font-weight: 500; border: none; border-radius: 2px; background: #3f51b5; color: #fff; cursor: pointer; white-space: nowrap; transition: background 0.2s;">
                                        Apply
                                    </button>
                                </div>
                            </div>

                            <!-- Operator View URL -->
                            <div class="my-form-field block mt15 system-input">
                                <span>Operator View URL (Port 80)</span>
                                <div style="display: flex; gap: 6px; align-items: center; width: 320px;">
                                    <input id="fuxa-view-url-text" readonly type="text" value="${fullViewUrl}" 
                                           style="flex: 1; height: 28px; padding: 2px 8px; font-size: 11px; font-family: monospace; border: none; border-radius: 2px; background-color: var(--formInputBackground, rgba(255,255,255,0.04)); color: var(--formInputColor, inherit); opacity: 0.85; box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important;" />
                                    <button id="fuxa-btn-copy-view" type="button" 
                                            style="height: 28px; padding: 0 10px; font-size: 11px; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 2px; background: transparent; color: inherit; cursor: pointer; white-space: nowrap;">
                                        Copy
                                    </button>
                                    <a id="fuxa-link-open-view" href="${fullViewUrl}" target="_blank" 
                                        style="height: 28px; padding: 0 10px; font-size: 11px; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 2px; background: transparent; color: inherit; text-decoration: none; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center;">
                                        Open ↗
                                    </a>
                                </div>
                            </div>

                            <!-- Editor Clean URL -->
                            <div class="my-form-field block mt10 system-input">
                                <span>Editor Clean URL (Port 80)</span>
                                <div style="display: flex; gap: 6px; align-items: center; width: 320px;">
                                    <input id="fuxa-editor-url-text" readonly type="text" value="${fullEditorUrl}" 
                                           style="flex: 1; height: 28px; padding: 2px 8px; font-size: 11px; font-family: monospace; border: none; border-radius: 2px; background-color: var(--formInputBackground, rgba(255,255,255,0.04)); color: var(--formInputColor, inherit); opacity: 0.85; box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important;" />
                                    <button id="fuxa-btn-copy-editor" type="button" 
                                            style="height: 28px; padding: 0 10px; font-size: 11px; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 2px; background: transparent; color: inherit; cursor: pointer; white-space: nowrap;">
                                        Copy
                                    </button>
                                </div>
                            </div>
                        `;

                        portContainer.parentNode.insertBefore(customDiv, portContainer.nextSibling);

                        // Attach event listeners
                        const saveBtn = customDiv.querySelector('#fuxa-subpath-save-btn');
                        const input = customDiv.querySelector('#fuxa-subpath-input');
                        const nameInput = customDiv.querySelector('#fuxa-project-name-input');
                        const viewInput = customDiv.querySelector('#fuxa-view-url-text');
                        const editorInput = customDiv.querySelector('#fuxa-editor-url-text');
                        const openLink = customDiv.querySelector('#fuxa-link-open-view');
                        const copyViewBtn = customDiv.querySelector('#fuxa-btn-copy-view');
                        const copyEditorBtn = customDiv.querySelector('#fuxa-btn-copy-editor');

                        // Stop FUXA / SVG editor from intercepting keystrokes and clicks
                        ['keydown', 'keyup', 'keypress', 'input', 'mousedown', 'pointerdown'].forEach(evt => {
                            input.addEventListener(evt, (e) => e.stopPropagation(), true);
                            if (nameInput) nameInput.addEventListener(evt, (e) => e.stopPropagation(), true);
                            viewInput.addEventListener(evt, (e) => e.stopPropagation(), true);
                            editorInput.addEventListener(evt, (e) => e.stopPropagation(), true);
                        });

                        input.addEventListener('click', (e) => {
                            e.stopPropagation();
                            input.focus();
                        });

                        if (nameInput) {
                            nameInput.addEventListener('click', (e) => {
                                e.stopPropagation();
                                nameInput.focus();
                            });
                        }

                        async function doSaveSettings() {
                            const val = input.value.trim();
                            const updatedName = nameInput ? nameInput.value.trim() : '';

                            if (updatedName) {
                                await saveProjectName(updatedName);
                            }

                            if (val) {
                                const clean = setBasePath(val);
                                saveBtn.textContent = 'Applying...';
                                
                                const detectedPort = parseInt(portInput.value, 10) || getTargetPort();
                                localStorage.setItem('fuxa_target_port', detectedPort);
                                
                                await syncSubpathToGateway(clean, detectedPort, updatedName);
                                
                                const updatedViewUrl = viewName ? `${hostUrl}${clean}/home/${viewName}` : `${hostUrl}${clean}/home`;
                                const updatedEditorUrl = `${hostUrl}${clean}/editor`;

                                viewInput.value = updatedViewUrl;
                                editorInput.value = updatedEditorUrl;
                                openLink.href = updatedViewUrl;

                                saveBtn.textContent = 'Active! ✓';
                                saveBtn.style.borderColor = '#2e7d32';
                                saveBtn.style.background = '#2e7d32';
                                setTimeout(() => {
                                    saveBtn.textContent = 'Apply';
                                    saveBtn.style.borderColor = '#3f51b5';
                                    saveBtn.style.background = '#3f51b5';
                                }, 2000);
                            }
                        }

                        saveBtn.addEventListener('click', doSaveSettings);

                        // Hook into native Dialog OK button so closing Settings also persists Project Name & Subpath!
                        const dialogOkBtn = dialog.querySelector('.dialog-action button[color="primary"], mat-dialog-actions button:last-child, button[cdkfocusinitial]');
                        if (dialogOkBtn) {
                            dialogOkBtn.addEventListener('click', () => {
                                doSaveSettings();
                            });
                        }

                        copyViewBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(viewInput.value);
                            copyViewBtn.textContent = 'Copied! ✓';
                            copyViewBtn.style.borderColor = '#2e7d32';
                            setTimeout(() => {
                                copyViewBtn.textContent = 'Copy';
                                copyViewBtn.style.borderColor = '#aaa';
                            }, 2000);
                        });

                        copyEditorBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(editorInput.value);
                            copyEditorBtn.textContent = 'Copied! ✓';
                            copyEditorBtn.style.borderColor = '#2e7d32';
                            setTimeout(() => {
                                copyEditorBtn.textContent = 'Copy';
                                copyEditorBtn.style.borderColor = '#aaa';
                            }, 2000);
                        });
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Init
    fetchLiveProjectName();
    window.addEventListener('DOMContentLoaded', () => {
        fetchLiveProjectName();
        observeSettingsDialog();
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        fetchLiveProjectName();
        observeSettingsDialog();
    }
})();

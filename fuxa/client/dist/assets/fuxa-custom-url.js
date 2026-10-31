/**
 * FUXA Enterprise - Custom URL & Direct Page URL Manager
 * Integrated directly inside the Settings (⚙️) Setup Card with native FUXA styling
 */

(function () {
    console.log('[FUXA-Enterprise] Settings Custom URL Manager active.');

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

    async function syncSubpathToGateway(newSubpath) {
        const port = getTargetPort();
        try {
            const gatewayUrl = `${window.location.protocol}//${window.location.hostname}${window.location.port === '80' || !window.location.port ? '' : ':80'}/api/gateway/subpath`;
            await fetch(gatewayUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subpath: newSubpath, port: port })
            });
            console.log(`[FUXA-Gateway] Registered route: ${newSubpath} -> Port ${port}`);
        } catch (e) {
            console.warn('[FUXA-Gateway] Could not sync subpath to gateway:', e);
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

    // Observe Settings Dialog (⚙️) to inject Custom Subpath & Page URLs card
    function observeSettingsDialog() {
        const observer = new MutationObserver(() => {
            const dialog = document.querySelector('app-app-settings, .mat-mdc-dialog-container');
            if (dialog && !dialog.querySelector('.custom-url-setting-field')) {
                const portInput = dialog.querySelector('input[numberonly], input[disabled]');
                if (portInput) {
                    const portContainer = portInput.closest('.my-form-field') || portInput.parentElement;
                    if (portContainer) {
                        const customDiv = document.createElement('div');
                        customDiv.className = 'my-form-field block mt15 custom-url-setting-field';
                        // Subtle, neat outline matching FUXA Material theme with indigo accent bar
                        customDiv.style.cssText = 'margin-top: 15px; width: 320px; box-sizing: border-box; padding: 10px 12px; background: rgba(0, 0, 0, 0.02); border: 1px solid rgba(63, 81, 181, 0.2); border-left: 3px solid #3f51b5; border-radius: 3px;';
                        
                        const currentSubpath = getBasePath();
                        const hostUrl = getHostUrl();
                        const viewName = getCurrentViewName();
                        const fullViewUrl = viewName ? `${hostUrl}${currentSubpath}/home/${viewName}` : `${hostUrl}${currentSubpath}/home`;
                        const fullEditorUrl = `${hostUrl}${currentSubpath}/editor`;

                        customDiv.innerHTML = `
                            <!-- Subpath Editing Section -->
                            <div style="margin-bottom: 10px;">
                                <span style="display: block; font-size: 12px; font-weight: 500; opacity: 0.85; margin-bottom: 4px; color: inherit;">
                                    Custom URL / Subpath
                                </span>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input id="fuxa-subpath-input" type="text" value="${currentSubpath}" placeholder="/p9/ps/ems" 
                                           style="flex: 1; height: 28px; padding: 3px 6px; font-size: 13px; font-family: inherit; border: 1px solid #ccc; border-radius: 2px; background-color: var(--formInputBackground, #fff); color: var(--formInputColor, #111); box-sizing: border-box; user-select: text !important; -webkit-user-select: text !important; pointer-events: auto !important; cursor: text !important;" />
                                    <button id="fuxa-subpath-save-btn" type="button" 
                                            style="height: 28px; padding: 0 10px; font-size: 12px; font-weight: 500; border: 1px solid #3f51b5; border-radius: 2px; background: #3f51b5; color: #fff; cursor: pointer; line-height: 26px; white-space: nowrap;">
                                        Apply
                                    </button>
                                </div>
                                <span style="display: block; font-size: 10px; opacity: 0.55; margin-top: 3px;">
                                    Port 80 clean OT subpath (e.g. /p9/ps/ems)
                                </span>
                            </div>

                            <!-- Direct Page URLs Section -->
                            <div style="border-top: 1px solid rgba(0, 0, 0, 0.08); padding-top: 8px; margin-top: 8px;">
                                <span style="display: block; font-size: 11px; opacity: 0.7; margin-bottom: 3px;">
                                    Operator View URL
                                </span>
                                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 6px;">
                                    <input id="fuxa-view-url-text" readonly type="text" value="${fullViewUrl}" 
                                           style="flex: 1; height: 26px; padding: 2px 6px; font-size: 11px; font-family: monospace; border: 1px solid #ddd; border-radius: 2px; background: rgba(0, 0, 0, 0.03); color: inherit; box-sizing: border-box; user-select: text !important; -webkit-user-select: text !important;" />
                                    <button id="fuxa-btn-copy-view" type="button" 
                                            style="height: 26px; padding: 0 8px; font-size: 11px; border: 1px solid #aaa; border-radius: 2px; background: transparent; color: inherit; cursor: pointer; white-space: nowrap;">
                                        Copy
                                    </button>
                                    <a id="fuxa-link-open-view" href="${fullViewUrl}" target="_blank" 
                                       style="height: 26px; padding: 0 8px; font-size: 11px; border: 1px solid #aaa; border-radius: 2px; background: transparent; color: inherit; text-decoration: none; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center;">
                                        Open ↗
                                    </a>
                                </div>

                                <span style="display: block; font-size: 11px; opacity: 0.7; margin-bottom: 3px;">
                                    Editor URL
                                </span>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input id="fuxa-editor-url-text" readonly type="text" value="${fullEditorUrl}" 
                                           style="flex: 1; height: 26px; padding: 2px 6px; font-size: 11px; font-family: monospace; border: 1px solid #ddd; border-radius: 2px; background: rgba(0, 0, 0, 0.03); color: inherit; box-sizing: border-box; user-select: text !important; -webkit-user-select: text !important;" />
                                    <button id="fuxa-btn-copy-editor" type="button" 
                                            style="height: 26px; padding: 0 8px; font-size: 11px; border: 1px solid #aaa; border-radius: 2px; background: transparent; color: inherit; cursor: pointer; white-space: nowrap;">
                                        Copy
                                    </button>
                                </div>
                            </div>
                        `;

                        portContainer.parentNode.insertBefore(customDiv, portContainer.nextSibling);

                        // Attach event listeners
                        const saveBtn = customDiv.querySelector('#fuxa-subpath-save-btn');
                        const input = customDiv.querySelector('#fuxa-subpath-input');
                        const viewInput = customDiv.querySelector('#fuxa-view-url-text');
                        const editorInput = customDiv.querySelector('#fuxa-editor-url-text');
                        const openLink = customDiv.querySelector('#fuxa-link-open-view');
                        const copyViewBtn = customDiv.querySelector('#fuxa-btn-copy-view');
                        const copyEditorBtn = customDiv.querySelector('#fuxa-btn-copy-editor');

                        // Stop FUXA / SVG editor from intercepting keystrokes and clicks
                        ['keydown', 'keyup', 'keypress', 'input', 'mousedown', 'pointerdown'].forEach(evt => {
                            input.addEventListener(evt, (e) => {
                                e.stopPropagation();
                            }, true);
                            viewInput.addEventListener(evt, (e) => {
                                e.stopPropagation();
                            }, true);
                            editorInput.addEventListener(evt, (e) => {
                                e.stopPropagation();
                            }, true);
                        });

                        input.addEventListener('click', (e) => {
                            e.stopPropagation();
                            input.focus();
                        });

                        saveBtn.addEventListener('click', async () => {
                            const val = input.value.trim();
                            if (val) {
                                const clean = setBasePath(val);
                                saveBtn.textContent = 'Applying...';
                                await syncSubpathToGateway(clean);
                                
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
                        });

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
    window.addEventListener('DOMContentLoaded', observeSettingsDialog);
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        observeSettingsDialog();
    }
})();

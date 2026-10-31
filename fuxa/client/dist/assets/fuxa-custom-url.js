/**
 * FUXA Enterprise - Custom URL & Direct Page URL Manager
 * Integrated directly inside the Settings (⚙️) Setup Card
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
                        customDiv.style.cssText = 'margin-top: 15px; padding: 14px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);';
                        
                        const currentSubpath = getBasePath();
                        const hostUrl = getHostUrl();
                        const viewName = getCurrentViewName();
                        const fullViewUrl = viewName ? `${hostUrl}${currentSubpath}/home/${viewName}` : `${hostUrl}${currentSubpath}/home`;
                        const fullEditorUrl = `${hostUrl}${currentSubpath}/editor`;

                        customDiv.innerHTML = `
                            <!-- Subpath Editing Section -->
                            <div style="margin-bottom: 12px;">
                                <span style="font-weight: 600; color: #0284c7; display: block; margin-bottom: 6px; font-size: 13px;">
                                    🌐 Custom URL / Subpath (Port 80 OT Reverse Proxy)
                                </span>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <input id="fuxa-subpath-input" type="text" value="${currentSubpath}" placeholder="/p9/ps/ems" 
                                           style="width: 240px; padding: 6px 10px; border: 1px solid #94a3b8; border-radius: 4px; font-family: monospace; font-size: 13px; background: white;" />
                                    <button id="fuxa-subpath-save-btn" type="button" 
                                            style="background: #0284c7; color: white; border: none; padding: 7px 14px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; white-space: nowrap;">
                                        Apply & Route
                                    </button>
                                </div>
                                <small style="color: #64748b; display: block; margin-top: 4px; font-size: 11px;">
                                    Dynamically routes this instance to Port 80 without external Nginx.
                                </small>
                            </div>

                            <!-- Direct Page URLs Section -->
                            <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; margin-top: 10px;">
                                <div style="font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                                    📱 Direct Operator View URL:
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 8px;">
                                    <input id="fuxa-view-url-text" readonly type="text" value="${fullViewUrl}" 
                                           style="width: 240px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 11px; background: white; color: #0f172a;" />
                                    <button id="fuxa-btn-copy-view" type="button" 
                                            style="background: #0284c7; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;">
                                        📋 Copy
                                    </button>
                                    <a id="fuxa-link-open-view" href="${fullViewUrl}" target="_blank" 
                                       style="background: #e2e8f0; color: #334155; text-decoration: none; padding: 5px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap;">
                                        ↗ Open
                                    </a>
                                </div>

                                <div style="font-size: 12px; font-weight: 600; color: #334155; margin-bottom: 4px;">
                                    🛠️ Direct Editor Clean URL:
                                </div>
                                <div style="display: flex; gap: 6px; align-items: center;">
                                    <input id="fuxa-editor-url-text" readonly type="text" value="${fullEditorUrl}" 
                                           style="width: 240px; padding: 5px 8px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 11px; background: white; color: #0f172a;" />
                                    <button id="fuxa-btn-copy-editor" type="button" 
                                            style="background: #64748b; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; white-space: nowrap;">
                                        📋 Copy
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

                        saveBtn.addEventListener('click', async () => {
                            const val = input.value.trim();
                            if (val) {
                                const clean = setBasePath(val);
                                saveBtn.textContent = 'Routing...';
                                await syncSubpathToGateway(clean);
                                
                                const updatedViewUrl = viewName ? `${hostUrl}${clean}/home/${viewName}` : `${hostUrl}${clean}/home`;
                                const updatedEditorUrl = `${hostUrl}${clean}/editor`;

                                viewInput.value = updatedViewUrl;
                                editorInput.value = updatedEditorUrl;
                                openLink.href = updatedViewUrl;

                                saveBtn.textContent = 'Active! ✓';
                                saveBtn.style.background = '#16a34a';
                                setTimeout(() => {
                                    saveBtn.textContent = 'Apply & Route';
                                    saveBtn.style.background = '#0284c7';
                                }, 2000);
                            }
                        });

                        copyViewBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(viewInput.value);
                            copyViewBtn.textContent = 'Copied! ✓';
                            copyViewBtn.style.background = '#16a34a';
                            setTimeout(() => {
                                copyViewBtn.textContent = '📋 Copy';
                                copyViewBtn.style.background = '#0284c7';
                            }, 2000);
                        });

                        copyEditorBtn.addEventListener('click', () => {
                            navigator.clipboard.writeText(editorInput.value);
                            copyEditorBtn.textContent = 'Copied! ✓';
                            copyEditorBtn.style.background = '#16a34a';
                            setTimeout(() => {
                                copyEditorBtn.textContent = '📋 Copy';
                                copyEditorBtn.style.background = '#64748b';
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

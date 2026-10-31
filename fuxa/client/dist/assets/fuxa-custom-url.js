/**
 * FUXA Enterprise - Custom URL & Direct Page URL Manager
 * Injected into FUXA Editor & View Runtime
 */

(function () {
    console.log('[FUXA-Enterprise] Custom URL Manager active.');

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
            console.log(`[FUXA-Gateway] Successfully registered route: ${newSubpath} -> Port ${port}`);
        } catch (e) {
            console.warn('[FUXA-Gateway] Could not sync subpath to gateway:', e);
        }
    }

    function getHostUrl() {
        // Standard Port 80 for clean OT URLs
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

    // 1. Observe Settings Dialog (⚙️) to inject Custom Subpath field
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
                        customDiv.style.cssText = 'margin-top: 15px; padding: 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px;';
                        
                        const currentSubpath = getBasePath();
                        
                        customDiv.innerHTML = `
                            <span style="font-weight: 600; color: #0284c7; display: block; margin-bottom: 6px; font-size: 13px;">
                                🌐 Custom URL / Subpath (Port 80 OT Reverse Proxy)
                            </span>
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <input id="fuxa-subpath-input" type="text" value="${currentSubpath}" placeholder="/p9/ps/ems" 
                                       style="flex: 1; padding: 6px 10px; border: 1px solid #94a3b8; border-radius: 4px; font-family: monospace; font-size: 13px; background: white;" />
                                <button id="fuxa-subpath-save-btn" type="button" 
                                        style="background: #0284c7; color: white; border: none; padding: 7px 14px; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px;">
                                    Save & Route
                                </button>
                            </div>
                            <small style="color: #64748b; display: block; margin-top: 6px; font-size: 11px;">
                                Instantly creates clean subpath on Port 80 without external Nginx.
                            </small>
                        `;

                        portContainer.parentNode.insertBefore(customDiv, portContainer.nextSibling);

                        // Attach save listener
                        const saveBtn = customDiv.querySelector('#fuxa-subpath-save-btn');
                        const input = customDiv.querySelector('#fuxa-subpath-input');
                        saveBtn.addEventListener('click', async () => {
                            const val = input.value.trim();
                            if (val) {
                                const clean = setBasePath(val);
                                saveBtn.textContent = 'Saving...';
                                await syncSubpathToGateway(clean);
                                saveBtn.textContent = 'Saved! ✓';
                                saveBtn.style.background = '#16a34a';
                                setTimeout(() => {
                                    saveBtn.textContent = 'Save & Route';
                                    saveBtn.style.background = '#0284c7';
                                }, 2000);
                            }
                        });
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // 2. Add "[🔗 Page URL]" Button to Top Header Toolbar
    function injectHeaderToolbarButton() {
        setInterval(() => {
            const header = document.querySelector('.header-panel');
            if (header && !document.getElementById('btn-fuxa-page-url')) {
                const btn = document.createElement('button');
                btn.id = 'btn-fuxa-page-url';
                btn.type = 'button';
                btn.title = 'View and Copy Direct Page / View URLs';
                btn.style.cssText = 'background: #0284c7; color: white; border: none; border-radius: 4px; padding: 5px 12px; margin-left: 10px; font-size: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; vertical-align: middle; height: 32px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);';
                btn.innerHTML = '<span>🔗</span><span>Page URL</span>';
                
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openUrlModal();
                });

                header.appendChild(btn);
            }
        }, 1000);
    }

    // 3. Modal to View, Copy, and Edit Page URLs
    function openUrlModal() {
        let modal = document.getElementById('fuxa-url-modal');
        if (modal) modal.remove();

        const subpath = getBasePath();
        const hostUrl = getHostUrl();
        const viewName = getCurrentViewName();
        
        const fullViewUrl = viewName ? `${hostUrl}${subpath}/home/${viewName}` : `${hostUrl}${subpath}/home`;
        const fullEditorUrl = `${hostUrl}${subpath}/editor`;

        modal = document.createElement('div');
        modal.id = 'fuxa-url-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); z-index: 100000; display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
        
        modal.innerHTML = `
            <div style="background: white; border-radius: 8px; width: 560px; max-width: 95%; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); overflow: hidden;">
                <div style="background: #0f172a; color: white; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                        <span>🔗</span> Direct Page & View URLs (Port 80)
                    </h3>
                    <button id="modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; line-height: 1;">&times;</button>
                </div>
                <div style="padding: 20px;">
                    <!-- Subpath configuration -->
                    <div style="margin-bottom: 16px;">
                        <label style="font-size: 12px; font-weight: 600; color: #475569; display: block; margin-bottom: 4px;">
                            Active OT Subpath:
                        </label>
                        <div style="display: flex; gap: 8px;">
                            <input id="modal-subpath-input" type="text" value="${subpath}" 
                                   style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 13px;" />
                            <button id="modal-subpath-apply" style="background: #0284c7; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                Apply & Route
                            </button>
                        </div>
                    </div>

                    <!-- Direct View URL -->
                    <div style="margin-bottom: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
                        <div style="font-size: 12px; font-weight: 600; color: #0284c7; margin-bottom: 4px;">
                            📱 Operator Direct View URL ${viewName ? `(View: <b>${viewName}</b>)` : ''}:
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input id="view-url-text" readonly type="text" value="${fullViewUrl}" 
                                   style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 12px; background: white; color: #0f172a;" />
                            <button id="btn-copy-view-url" style="background: #0284c7; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;">
                                📋 Copy URL
                            </button>
                            <a id="link-open-view" href="${fullViewUrl}" target="_blank" style="background: #e2e8f0; color: #334155; text-decoration: none; padding: 8px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap;">
                                ↗ Open
                            </a>
                        </div>
                    </div>

                    <!-- Direct Editor URL -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
                        <div style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 4px;">
                            🛠️ Editor Clean URL:
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input id="editor-url-text" readonly type="text" value="${fullEditorUrl}" 
                                   style="flex: 1; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 4px; font-family: monospace; font-size: 12px; background: white; color: #0f172a;" />
                            <button id="btn-copy-editor-url" style="background: #64748b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; white-space: nowrap;">
                                📋 Copy
                            </button>
                        </div>
                    </div>
                </div>
                <div style="background: #f1f5f9; padding: 12px 20px; display: flex; justify-content: flex-end;">
                    <button id="modal-done-btn" style="background: #0284c7; color: white; border: none; padding: 8px 18px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 600;">
                        Done
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Events
        modal.querySelector('#modal-close-btn').onclick = () => modal.remove();
        modal.querySelector('#modal-done-btn').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

        const copyBtn = modal.querySelector('#btn-copy-view-url');
        const viewInput = modal.querySelector('#view-url-text');
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(viewInput.value);
            copyBtn.textContent = 'Copied! ✓';
            copyBtn.style.background = '#16a34a';
            setTimeout(() => {
                copyBtn.textContent = '📋 Copy URL';
                copyBtn.style.background = '#0284c7';
            }, 2000);
        };

        const copyEditorBtn = modal.querySelector('#btn-copy-editor-url');
        const editorInput = modal.querySelector('#editor-url-text');
        copyEditorBtn.onclick = () => {
            navigator.clipboard.writeText(editorInput.value);
            copyEditorBtn.textContent = 'Copied! ✓';
            copyEditorBtn.style.background = '#16a34a';
            setTimeout(() => {
                copyEditorBtn.textContent = '📋 Copy';
                copyEditorBtn.style.background = '#64748b';
            }, 2000);
        };

        const applyBtn = modal.querySelector('#modal-subpath-apply');
        const subInput = modal.querySelector('#modal-subpath-input');
        const openLink = modal.querySelector('#link-open-view');
        applyBtn.onclick = async () => {
            const raw = subInput.value.trim();
            if (!raw) return;
            const newPath = setBasePath(raw);
            applyBtn.textContent = 'Routing...';
            await syncSubpathToGateway(newPath);

            const updatedViewUrl = viewName ? `${hostUrl}${newPath}/home/${viewName}` : `${hostUrl}${newPath}/home`;
            const updatedEditorUrl = `${hostUrl}${newPath}/editor`;

            viewInput.value = updatedViewUrl;
            editorInput.value = updatedEditorUrl;
            openLink.href = updatedViewUrl;

            applyBtn.textContent = 'Active! ✓';
            applyBtn.style.background = '#16a34a';
            setTimeout(() => { 
                applyBtn.textContent = 'Apply & Route';
                applyBtn.style.background = '#0284c7';
            }, 2000);
        };
    }

    // Init
    window.addEventListener('DOMContentLoaded', () => {
        observeSettingsDialog();
        injectHeaderToolbarButton();
    });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        observeSettingsDialog();
        injectHeaderToolbarButton();
    }
})();

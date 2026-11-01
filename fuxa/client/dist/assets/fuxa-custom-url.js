/**
 * FUXA Enterprise - Custom URL & Project Name Manager
 * Integrated directly inside the Settings (⚙️) Setup Card with native FUXA styling
 */

(function () {
    console.log('[FUXA-Enterprise] Settings Custom URL & Project Manager active.');

    // Reload loop circuit breaker: prevents UI flickering / infinite reload loops
    try {
        const RELOAD_KEY = 'fuxa_reload_window';
        const now = Date.now();
        let history = JSON.parse(sessionStorage.getItem(RELOAD_KEY) || '[]');
        history = history.filter(ts => (now - ts) < 15000);
        history.push(now);
        sessionStorage.setItem(RELOAD_KEY, JSON.stringify(history));
        if (history.length > 3) {
            console.warn('[FUXA] Infinite reload loop detected! Throttling window.location.reload to maintain UI stability.');
            const origReload = window.location.reload.bind(window.location);
            window.location.reload = function() {
                console.warn('[FUXA] Suppressed window.location.reload() to stop page flickering loop.');
            };
        }
    } catch (e) {}

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

    function ensureTvsHeaderLogo() {
        // 1. Editor / Device / Settings top header bar
        const headerPanel = document.querySelector('app-header .header-panel, .header-panel');
        if (headerPanel && !document.getElementById('fuxa-header-tvs-logo')) {
            const tvsLogo = document.createElement('div');
            tvsLogo.id = 'fuxa-header-tvs-logo';
            tvsLogo.style.cssText = 'display: inline-flex; align-items: center; margin-right: 14px; margin-left: 8px; height: 32px; cursor: default; user-select: none; -webkit-user-select: none;';
            tvsLogo.title = 'TVS SCADA Enterprise';
            tvsLogo.innerHTML = `
                <img src="assets/images/tvs-logo.svg" alt="TVS" style="height: 24px; width: auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.4));" 
                     onerror="this.src='/_images/Common/tvs-logo.svg'" />
            `;
            headerPanel.prepend(tvsLogo);
        }

        // 2. Runtime / HMI View top header bar
        const runtimeHeader = document.querySelector('.header, app-home .header');
        if (runtimeHeader && !document.getElementById('fuxa-runtime-tvs-logo')) {
            const logoDiv = document.createElement('div');
            logoDiv.id = 'fuxa-runtime-tvs-logo';
            logoDiv.style.cssText = 'position: absolute; left: 16px; top: 0; bottom: 0; display: inline-flex; align-items: center; z-index: 10; cursor: default; user-select: none;';
            logoDiv.title = 'TVS SCADA Enterprise';
            logoDiv.innerHTML = `
                <img src="assets/images/tvs-logo.svg" alt="TVS" style="height: 26px; width: auto; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));" 
                     onerror="this.src='/_images/Common/tvs-logo.svg'" />
            `;
            runtimeHeader.prepend(logoDiv);
        }

        ensureRuntimeDashboardHeadline();
    }

    function getFormattedHeadline(rawName) {
        if (!rawName) return 'Plant Monitoring Dashboard';
        const trimmed = rawName.trim();
        if (/dashboard/i.test(trimmed)) return trimmed;
        return `${trimmed} Monitoring Dashboard`;
    }

    function ensureRuntimeDashboardHeadline() {
        const itemsContainer = document.querySelector('.header-items-button, app-home .header-items-button');
        if (!itemsContainer) return;

        // Force center alignment for the header items container
        itemsContainer.style.setProperty('justify-content', 'center', 'important');
        itemsContainer.style.setProperty('text-align', 'center', 'important');
        itemsContainer.style.setProperty('flex', '1', 'important');

        const currentHeadline = getFormattedHeadline(liveProjectName);

        // Check if there is an existing headline element or label item
        let headlineEl = itemsContainer.querySelector('#header_headline, #fuxa-runtime-headline');
        if (headlineEl) {
            headlineEl.textContent = currentHeadline;
            headlineEl.style.cssText = 'display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: #ffffff !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; pointer-events: default; background: transparent !important; border: none !important; box-shadow: none !important;';
        } else {
            // Check if there are other label items in itemsContainer
            const firstButton = itemsContainer.querySelector('button.mat-button, button');
            if (firstButton && (firstButton.textContent.trim().toLowerCase().includes('dashboard') || firstButton.id === 'header_headline')) {
                firstButton.textContent = currentHeadline;
                firstButton.style.cssText = 'display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: #ffffff !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; background: transparent !important; border: none !important; box-shadow: none !important;';
            } else {
                headlineEl = document.createElement('div');
                headlineEl.id = 'fuxa-runtime-headline';
                headlineEl.textContent = currentHeadline;
                headlineEl.style.cssText = 'display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: #ffffff !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; margin: 0 12px;';
                itemsContainer.appendChild(headlineEl);
            }
        }
    }

    function updateHeaderBadge(name) {
        ensureTvsHeaderLogo();
        if (!name) return;
        document.title = `${name} - TVS SCADA`;
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

    const STATUTORY_WARNING_TEXT = "Adding connections facility is no longer supported; redirect to storage server instance for adding field PLC or gateway device. Once they added in respective storage server, device will be listed to the view page server automatically.";

    function showStatutoryWarningModal() {
        if (document.getElementById('fuxa-statutory-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'fuxa-statutory-modal-backdrop';
        backdrop.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(4px); z-index: 9999999; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif; padding: 20px;';
        
        const host = window.location.hostname || 'localhost';
        const storageManagerUrl = `http://${host}:9000`;
        const viewDeviceUrl = `${getBasePath()}/device`;

        backdrop.innerHTML = `
            <div style="background: #1e293b; border: 1.5px solid #eab308; border-radius: 8px; width: 620px; max-width: 95vw; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); overflow: hidden;">
                <div style="background: rgba(234, 179, 8, 0.16); border-bottom: 1px solid rgba(234, 179, 8, 0.3); padding: 18px 22px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span style="font-size: 26px;">⚠️</span>
                        <div>
                            <h3 style="margin: 0; font-size: 16px; font-weight: 700; color: #facc15; letter-spacing: 0.5px;">Statutory Notice: Connection Facility Restricted</h3>
                            <span style="font-size: 11px; color: #94a3b8;">FUXA Enterprise SCADA &bull; View Server Policy</span>
                        </div>
                    </div>
                    <button id="fuxa-statutory-x-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 8px;">✕</button>
                </div>
                <div style="padding: 24px 22px; color: #f1f5f9; font-size: 14px; line-height: 1.6;">
                    <div style="background: rgba(15, 23, 42, 0.7); border-left: 4px solid #eab308; padding: 16px 18px; border-radius: 0 6px 6px 0; margin-bottom: 16px; font-size: 14px; color: #fef08a;">
                        <strong>Adding connections facility is no longer supported;</strong> redirect to storage server instance for adding field PLC or gateway device. Once they added in respective storage server, device will be listed to the view page server automatically.
                    </div>
                    <p style="margin: 0; font-size: 13px; color: #cbd5e1;">
                        View servers operate in display-only mode. Field PLC / Gateway devices cannot be added locally. All connections and tags are synchronized automatically through the Central Storage OPC-UA Bridge.
                    </p>
                </div>
                <div style="background: #0f172a; padding: 16px 22px; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
                    <button id="fuxa-statutory-close-btn" style="padding: 8px 16px; background: transparent; border: 1px solid #475569; color: #cbd5e1; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">
                        Dismiss
                    </button>
                    <a href="${storageManagerUrl}" target="_blank" rel="noopener noreferrer" style="padding: 8px 16px; background: #334155; border: 1px solid #64748b; color: #f8fafc; border-radius: 4px; font-size: 13px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
                        Open Storage Fleet Manager (:9000) ↗
                    </a>
                    <button id="fuxa-statutory-view-btn" style="padding: 8px 18px; background: #0284c7; border: none; color: #fff; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">
                        View Mapped Connections (Read-Only)
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);

        const close = () => backdrop.remove();
        backdrop.querySelector('#fuxa-statutory-close-btn').addEventListener('click', close);
        backdrop.querySelector('#fuxa-statutory-x-btn').addEventListener('click', close);
        backdrop.querySelector('#fuxa-statutory-view-btn').addEventListener('click', () => {
            close();
            window.location.href = viewDeviceUrl;
        });
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) close();
        });
    }

    function enforceViewServerRestrictions() {
        // 1. Remove "Plugins" button card from Setup / Settings dialog
        document.querySelectorAll('app-setup .btn-card, .dlg-container .btn-card').forEach(card => {
            const btn = card.querySelector('button');
            if (!btn) return;
            const text = btn.textContent ? btn.textContent.toLowerCase() : '';
            const icon = card.querySelector('mat-icon');
            const iconText = icon ? icon.textContent.trim().toLowerCase() : '';
            if (text.includes('plugin') || iconText === 'extension') {
                card.style.setProperty('display', 'none', 'important');
            }
        });

        // 2. Intercept "Connections" button in Setup / Settings dialog with Statutory Warning
        document.querySelectorAll('app-setup .btn-card, .dlg-container .btn-card').forEach(card => {
            const btn = card.querySelector('button');
            if (!btn) return;
            const text = btn.textContent ? btn.textContent.toLowerCase() : '';
            const icon = card.querySelector('mat-icon');
            const iconText = icon ? icon.textContent.trim().toLowerCase() : '';
            if (text.includes('connection') || iconText === 'lan') {
                if (!btn.dataset.statutoryHooked) {
                    btn.dataset.statutoryHooked = 'true';
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Close setup dialog
                        const closeBtn = document.querySelector('app-setup .dialog-close-btn, .dlg-container .dialog-close-btn');
                        if (closeBtn) closeBtn.click();
                        showStatutoryWarningModal();
                    }, true);
                }
            }
        });

        // 3. In /device view (Connections page)
        if (window.location.pathname.includes('/device')) {
            // Hide floating "Add Item / Device" FAB button
            document.querySelectorAll('.fab-add, button.fab-add, mat-fab').forEach(el => {
                el.style.setProperty('display', 'none', 'important');
            });
            // Hide table add buttons in device list
            document.querySelectorAll('button[mattooltip*="add"], button[mattooltip*="Add"], button[mattooltip*="aggiungi"]').forEach(el => {
                if (el.closest('app-device-map, app-device-list, app-device')) {
                    el.style.setProperty('display', 'none', 'important');
                }
            });
            // Hide any plugin notice or open-plugin banner in /device
            document.querySelectorAll('.device-plugins-notice, .plugins-notice').forEach(el => {
                el.style.setProperty('display', 'none', 'important');
            });

            // Inject Statutory Warning Banner at top of /device if not present
            const workPanel = document.querySelector('app-device .work-panel, app-device');
            if (workPanel && !document.getElementById('fuxa-statutory-device-banner')) {
                const banner = document.createElement('div');
                banner.id = 'fuxa-statutory-device-banner';
                banner.style.cssText = 'background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 6px; padding: 12px 18px; margin: 12px 16px; display: flex; align-items: center; gap: 12px; color: #fef08a; font-size: 13px; font-weight: 500; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 100;';
                banner.innerHTML = `
                    <span style="font-size: 22px; line-height: 1;">⚠️</span>
                    <div style="flex: 1; line-height: 1.5;">
                        <strong style="color: #facc15; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Statutory Restriction: Read-Only Mapped View</strong>
                        Adding connections facility is no longer supported; redirect to storage server instance for adding field PLC or gateway device. Once they added in respective storage server, device will be listed to the view page server automatically.
                    </div>
                `;
                workPanel.prepend(banner);
            }
        }

        // 4. If URL ends with /plugins, redirect to /editor and display warning
        if (window.location.pathname.includes('/plugins')) {
            window.location.href = getBasePath() + '/editor';
            setTimeout(showStatutoryWarningModal, 400);
        }
    }

    // Observe Settings Dialog (⚙️) to inject Custom Subpath & Page URLs card
    function observeSettingsDialog() {
        removeHeaderPageUrlButton();
        enforceViewServerRestrictions();
        const observer = new MutationObserver(() => {
            removeHeaderPageUrlButton();
            enforceViewServerRestrictions();
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

            // Observe Layout Property Dialog (to edit Dashboard Headline directly from the Layout menu)
            const layoutDialog = document.querySelector('app-layout-property');
            if (layoutDialog && !layoutDialog.querySelector('#fuxa-layout-headline-field')) {
                const configRight = layoutDialog.querySelector('.config-right');
                if (configRight) {
                    const headlineDiv = document.createElement('div');
                    headlineDiv.id = 'fuxa-layout-headline-field';
                    headlineDiv.className = 'my-form-field block mb15';
                    headlineDiv.style.cssText = 'margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.12);';
                    
                    const currentHeadline = getFormattedHeadline(liveProjectName);
                    headlineDiv.innerHTML = `
                        <span style="display: block; font-size: 12px; font-weight: 600; color: #38bdf8; margin-bottom: 4px;">Dashboard Headline</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <input id="fuxa-layout-headline-input" type="text" value="${currentHeadline}" 
                                   placeholder="e.g. Plant 9 TC Monitoring Dashboard" 
                                   style="width: 250px; height: 32px; padding: 4px 8px; font-size: 13px; border-radius: 3px; background: rgba(255,255,255,0.08); color: #fff; border: 1px solid #475569; outline: none; box-sizing: border-box;" />
                            <button id="fuxa-layout-headline-apply-btn" type="button"
                                    style="height: 32px; padding: 0 12px; background: #0284c7; color: #fff; border: none; border-radius: 3px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap;">
                                Apply
                            </button>
                        </div>
                    `;
                    configRight.prepend(headlineDiv);

                    const headlineInput = headlineDiv.querySelector('#fuxa-layout-headline-input');
                    const headlineApplyBtn = headlineDiv.querySelector('#fuxa-layout-headline-apply-btn');

                    const saveHeadline = async () => {
                        const newText = (headlineInput.value || '').trim();
                        if (!newText) return;

                        // Update dialog header preview
                        const previewHeader = layoutDialog.querySelector('.header-items-button');
                        if (previewHeader) {
                            previewHeader.style.setProperty('justify-content', 'center', 'important');
                            let btn = previewHeader.querySelector('button, span, div');
                            if (btn) btn.textContent = newText;
                        }

                        // Save to backend via /api/project-name
                        try {
                            const res = await fetch('api/project-name', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: newText })
                            });
                            if (res.ok) {
                                liveProjectName = newText;
                                updateHeaderBadge(newText);
                                ensureRuntimeDashboardHeadline();
                                headlineApplyBtn.textContent = 'Saved! ✓';
                                headlineApplyBtn.style.background = '#16a34a';
                                setTimeout(() => {
                                    headlineApplyBtn.textContent = 'Apply';
                                    headlineApplyBtn.style.background = '#0284c7';
                                }, 2000);
                            }
                        } catch (err) {}
                    };

                    headlineApplyBtn.addEventListener('click', saveHeadline);
                    headlineInput.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') saveHeadline();
                    });

                    // Also hook into native Dialog OK button so clicking OK saves the headline too
                    const layoutOkBtn = layoutDialog.querySelector('.dialog-action button[color="primary"], button[cdkfocusinitial]');
                    if (layoutOkBtn) {
                        layoutOkBtn.addEventListener('click', saveHeadline);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Init
    ensureTvsHeaderLogo();
    enforceViewServerRestrictions();
    fetchLiveProjectName();
    setInterval(() => {
        ensureTvsHeaderLogo();
        enforceViewServerRestrictions();
    }, 1200);

    window.addEventListener('DOMContentLoaded', () => {
        ensureTvsHeaderLogo();
        enforceViewServerRestrictions();
        fetchLiveProjectName();
        observeSettingsDialog();
    });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        ensureTvsHeaderLogo();
        enforceViewServerRestrictions();
        fetchLiveProjectName();
        observeSettingsDialog();
    }
})();

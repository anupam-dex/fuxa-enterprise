/**
 * FUXA Enterprise - Custom URL & Project Name Manager
 * Integrated directly inside the Settings (⚙️) Setup Card with native FUXA styling
 */

(function () {
    if (window.__FUXA_CUSTOM_URL_LOADED__) {
        return;
    }
    window.__FUXA_CUSTOM_URL_LOADED__ = true;

    console.log('[FUXA-Enterprise] Custom URL, Layout & View Header Manager active.');

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
            window.location.reload = function() {
                console.warn('[FUXA] Suppressed window.location.reload() to stop page flickering loop.');
            };
        }
    } catch (e) {}

    let liveProjectName = localStorage.getItem('fuxa_project_name') || '';
    let isMutating = false;

    // Self-contained high-resolution inline TVS vector logo (TVS Blue text + Red running horse)
    const TVS_LOGO_INLINE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0.5 0 146.7 26.44" style="height: 26px; width: auto; display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.22));"><path d="M5.7302 21.8458H2.84895L1.72575 25.9985H15.6925L16.7669 21.8458H13.3973L16.7669 8.02006H19.0621L18.8668 10.3162H23.7014L25.6548 3.03691H2.40944L0.504883 10.3162H5.53487L6.5604 7.9712H9.05097L5.7302 21.8458ZM42.1609 3.03691H52.9534L38.5472 25.9985H29.5127L28.243 7.18953H26.3873L27.4617 3.03691H39.4262L38.3518 7.18953H36.3008L36.2519 18.9634L43.1376 7.18953H40.8424L42.1609 3.03691ZM69.8503 9.82767C69.8503 7.53151 70.5828 5.47963 71.5107 3.3789C67.4574 2.64608 63.0622 2.35295 59.0578 3.3789C56.8114 3.96515 54.4673 5.38192 53.1976 7.38495C51.7326 9.63225 52.0744 12.5147 53.8813 14.42C54.8092 15.3482 55.9324 15.9833 57.1044 16.5207C58.0323 16.9604 59.6438 17.6444 59.888 18.7192C60.5717 21.455 56.1765 21.6993 54.4673 21.1619V19.0123H49.8768L48.1188 25.4122C52.2209 26.4381 56.5184 26.7801 60.6693 25.8519C63.1599 25.2656 65.4063 23.9954 67.0667 21.9924C68.4341 20.2825 69.2154 17.107 67.7504 15.2505C66.9202 14.2246 65.9923 13.4429 64.8691 12.8078C63.7948 12.1727 62.6227 11.7818 61.646 11.049C60.474 10.1696 60.474 8.80173 61.7437 8.02006C62.7204 7.38495 64.3319 7.67808 65.4063 7.87349L65.6016 9.77881H69.8503V9.82767Z" fill="#183883"/><path d="M132.845 3.47782C130.94 2.745 129.133 2.79386 127.18 3.2824C125.275 3.77094 123.908 4.84574 122.394 6.01824C120.88 7.19075 119.269 8.36325 117.511 9.14492C115.704 9.92659 113.653 10.7571 111.699 9.97544C113.116 10.0243 114.434 9.73117 115.655 8.9495C116.583 8.36325 118.194 7.14189 118.536 6.01824H116.925C118.097 4.74803 119.562 3.77094 121.173 3.18469L120.392 2.25646C122.541 0.79083 124.885 0.106869 127.473 0.00916019C128.694 -0.0396941 129.915 0.106869 131.038 0.448849C132.259 0.790829 133.187 1.37708 134.066 2.25646L132.845 3.47782ZM101.932 8.60752C101.249 8.60752 100.663 8.65638 99.9789 8.85179C99.3441 9.04721 98.7581 9.29148 98.1232 9.53575C96.9512 10.0243 95.828 10.6594 94.7048 11.2457C94.2164 11.4899 93.6304 11.7831 93.0932 11.8808C92.5072 11.9785 91.7259 11.9785 91.1887 11.7342C90.6027 11.4411 90.1143 11.1479 89.626 10.7083C89.1376 10.2686 88.6493 9.82888 88.1609 9.4869C87.6237 9.14492 87.0866 8.90065 86.5494 8.55867C86.7936 8.55867 88.0633 8.50981 87.7214 7.97242C87.4284 7.53273 86.7447 7.33731 86.2075 7.2396C84.9867 6.99533 83.7658 6.99533 82.5449 6.99533C83.5705 6.11595 84.6937 5.67626 86.061 5.67626C87.3307 5.67626 88.3563 6.26251 89.4306 6.89762C89.9678 7.2396 90.6027 7.82585 91.1398 8.16783C91.677 8.50981 92.263 8.70523 92.8491 8.90065C93.9723 9.29148 95.3885 9.09607 96.5117 8.70523C97.4395 8.36325 98.2697 7.97242 99.2953 7.97242C100.223 7.82585 101.102 8.07012 101.932 8.60752Z" fill="#E62D38"/><path d="M92.3615 18.4234C94.3638 18.3257 96.0242 16.3716 97.1474 14.9059C98.3682 13.3426 99.1984 10.9976 101.103 10.1182C103.935 8.848 106.914 9.9228 109.503 11.2907C111.944 12.5121 115.363 12.3167 117.804 11.2419C120.49 10.0694 122.541 8.06633 124.837 6.35643C126.985 4.74424 129.769 3.62059 133.09 4.49997L134.555 2.74121L134.848 5.62362L140.024 10.851L138.999 12.0724H135.678V11.2419C134.701 10.5579 133.676 10.0694 132.455 10.2159C131.185 10.3625 129.818 10.9487 130.013 12.4632C130.16 13.4892 131.625 14.4174 132.357 14.9548C133.383 15.6388 134.457 16.2739 135.531 16.9578C137.729 18.3257 139.829 19.8402 141.88 21.4524C143.785 22.9669 145.738 24.5302 147.203 26.4356L142.71 25.5562C143.54 24.9699 142.564 24.3348 142.027 23.8951C141.343 23.3577 140.659 22.918 139.878 22.4784C138.364 21.6478 136.752 21.2081 135.092 20.8173C131.918 20.0356 127.816 19.5471 125.032 21.5501C124.934 21.599 124.837 21.6967 124.739 21.7455L123.176 20.4265C118.146 22.1364 112.53 21.6967 107.891 19.1563C105.986 20.4753 103.789 20.7685 101.591 21.0127C99.4914 21.257 97.2939 21.1104 95.1451 20.915C90.0175 25.1653 83.0341 27.6569 76.4902 25.4096L80.8854 24.286V25.2631C85.6223 25.2631 89.578 21.941 92.3615 18.4234Z" fill="#E62D38"/></svg>`;

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

    function getFormattedHeadline(rawName) {
        if (!rawName) return 'Plant Monitoring Dashboard';
        const trimmed = rawName.trim();
        if (/dashboard/i.test(trimmed)) return trimmed;
        return `${trimmed} Monitoring Dashboard`;
    }

    function ensureRuntimeDashboardHeadline(runtimeHeader) {
        const header = runtimeHeader || document.querySelector('app-home .header, mat-sidenav-content > .header, .sidenav-container .header');
        if (!header) return;

        const itemsContainer = header.querySelector('.header-items-button');
        if (!itemsContainer) return;

        const currentHeadline = getFormattedHeadline(liveProjectName);

        // Center align the container
        if (itemsContainer.style.justifyContent !== 'center') {
            itemsContainer.style.setProperty('justify-content', 'center', 'important');
            itemsContainer.style.setProperty('text-align', 'center', 'important');
            itemsContainer.style.setProperty('flex', '1', 'important');
        }

        // Determine text color contrast based on parent header background
        let isLightBg = true;
        try {
            const headerBg = window.getComputedStyle(header).backgroundColor;
            if (headerBg && headerBg !== 'transparent' && !headerBg.includes('rgba(0, 0, 0, 0)')) {
                const rgb = headerBg.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
                    isLightBg = brightness > 128;
                }
            }
        } catch (e) {}

        const headlineColor = isLightBg ? '#0f172a' : '#ffffff';

        let headlineEl = itemsContainer.querySelector('#header_headline, #fuxa-runtime-headline');
        if (headlineEl) {
            if (headlineEl.textContent !== currentHeadline) {
                headlineEl.textContent = currentHeadline;
            }
            headlineEl.style.color = `${headlineColor} !important`;
            if (!headlineEl.dataset.styled) {
                headlineEl.dataset.styled = 'true';
                headlineEl.style.cssText = `display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: ${headlineColor} !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; pointer-events: default; background: transparent !important; border: none !important; box-shadow: none !important;`;
            }
        } else {
            const firstButton = itemsContainer.querySelector('button.mat-button, button');
            if (firstButton && (firstButton.textContent.trim().toLowerCase().includes('dashboard') || firstButton.id === 'header_headline')) {
                if (firstButton.textContent !== currentHeadline) {
                    firstButton.textContent = currentHeadline;
                }
                firstButton.style.color = `${headlineColor} !important`;
                if (!firstButton.dataset.styled) {
                    firstButton.dataset.styled = 'true';
                    firstButton.style.cssText = `display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: ${headlineColor} !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; background: transparent !important; border: none !important; box-shadow: none !important;`;
                }
            } else {
                headlineEl = document.createElement('div');
                headlineEl.id = 'fuxa-runtime-headline';
                headlineEl.textContent = currentHeadline;
                headlineEl.dataset.styled = 'true';
                headlineEl.style.cssText = `display: inline-flex; align-items: center; font-size: 16px !important; font-weight: 700 !important; color: ${headlineColor} !important; letter-spacing: 0.6px !important; text-transform: uppercase !important; font-family: system-ui, -apple-system, sans-serif !important; user-select: none; margin: 0 12px;`;
                itemsContainer.appendChild(headlineEl);
            }
        }
    }

    function ensureTvsHeaderLogo() {
        if (isMutating) return;
        isMutating = true;
        try {
            // 1. In Editor page: STRICTLY REMOVE any TVS logo!
            const editorLogo = document.getElementById('fuxa-header-tvs-logo');
            if (editorLogo) {
                editorLogo.remove();
            }

            // 2. In View / Runtime page: Target specifically the header inside app-home / mat-sidenav-content
            const runtimeHeader = document.querySelector('app-home .header, mat-sidenav-content > .header, .sidenav-container .header');
            
            // If we are not on the View page, remove any runtime logo and exit
            if (!runtimeHeader) {
                const strayLogo = document.getElementById('fuxa-runtime-tvs-logo');
                if (strayLogo) strayLogo.remove();
                return;
            }

            // Locate the hamburger menu button
            const headerMenu = runtimeHeader.querySelector('.header-menu');
            let logoDiv = document.getElementById('fuxa-runtime-tvs-logo');

            if (!logoDiv) {
                logoDiv = document.createElement('div');
                logoDiv.id = 'fuxa-runtime-tvs-logo';
                logoDiv.style.cssText = 'display: inline-flex; align-items: center; margin-left: 10px; margin-right: 18px; height: 100%; cursor: default; user-select: none; z-index: 10; flex-shrink: 0; transition: transform 0.28s cubic-bezier(0.25, 0.8, 0.25, 1); will-change: transform;';
                logoDiv.title = 'TVS SCADA Enterprise';
                logoDiv.innerHTML = TVS_LOGO_INLINE_SVG;

                if (headerMenu && headerMenu.parentNode === runtimeHeader) {
                    runtimeHeader.insertBefore(logoDiv, headerMenu.nextSibling);
                } else {
                    runtimeHeader.prepend(logoDiv);
                }
            } else {
                // Ensure correct positioning directly after hamburger menu
                if (headerMenu && headerMenu.parentNode === runtimeHeader && logoDiv.previousElementSibling !== headerMenu) {
                    runtimeHeader.insertBefore(logoDiv, headerMenu.nextSibling);
                } else if (!headerMenu && logoDiv.parentNode !== runtimeHeader) {
                    runtimeHeader.prepend(logoDiv);
                }
            }

            observeSidenavDrawer(runtimeHeader);
            ensureRuntimeDashboardHeadline(runtimeHeader);
        } finally {
            isMutating = false;
        }
    }

    function observeSidenavDrawer(runtimeHeader) {
        const sidenav = document.querySelector('mat-sidenav, .sidenav');
        const logoDiv = document.getElementById('fuxa-runtime-tvs-logo');
        if (!sidenav || !logoDiv) return;

        const updateLogoShift = () => {
            const isOpen = sidenav.classList.contains('mat-drawer-opened') || 
                           (sidenav.style.visibility === 'visible' && sidenav.offsetWidth > 60) ||
                           (sidenav.offsetWidth > 60 && !sidenav.classList.contains('mat-drawer-closed'));
            
            if (isOpen) {
                const shiftWidth = (sidenav.offsetWidth > 60 ? sidenav.offsetWidth : 210) + 12;
                logoDiv.style.transform = `translateX(${shiftWidth}px)`;
            } else {
                logoDiv.style.transform = 'translateX(0px)';
            }
        };

        if (!sidenav.dataset.observerAttached) {
            sidenav.dataset.observerAttached = 'true';

            const drawerObserver = new MutationObserver(() => {
                updateLogoShift();
            });

            drawerObserver.observe(sidenav, {
                attributes: true,
                attributeFilter: ['class', 'style', 'visibility']
            });

            window.addEventListener('click', () => {
                setTimeout(updateLogoShift, 60);
                setTimeout(updateLogoShift, 200);
            }, true);
        }

        const menuBtn = runtimeHeader ? runtimeHeader.querySelector('.header-menu button') : null;
        if (menuBtn && !menuBtn.dataset.shiftHooked) {
            menuBtn.dataset.shiftHooked = 'true';
            menuBtn.addEventListener('click', () => {
                setTimeout(updateLogoShift, 50);
                setTimeout(updateLogoShift, 150);
                setTimeout(updateLogoShift, 300);
            });
        }

        updateLogoShift();
    }

    function updateHeaderBadge(name) {
        ensureTvsHeaderLogo();
        if (!name) return;
        document.title = `${name} - TVS SCADA`;
        const headerPanel = document.querySelector('app-header .header-panel');
        if (headerPanel) {
            let badge = headerPanel.querySelector('#fuxa-header-project-badge');
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

    function removeHeaderPageUrlButton() {
        const btn = document.getElementById('fuxa-header-page-url-btn');
        if (btn) {
            btn.remove();
        }
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
        if (isMutating) return;
        isMutating = true;
        try {
            // 1. Remove "Plugins" button card from Setup / Settings dialog
            const cards = document.querySelectorAll('app-setup .btn-card, .dlg-container .btn-card');
            for (let i = 0; i < cards.length; i++) {
                const card = cards[i];
                if (card.dataset.restrictedChecked) continue;
                card.dataset.restrictedChecked = 'true';
                const btn = card.querySelector('button');
                if (!btn) continue;
                const text = (btn.textContent || '').toLowerCase();
                const icon = card.querySelector('mat-icon');
                const iconText = icon ? icon.textContent.trim().toLowerCase() : '';
                if (text.includes('plugin') || iconText === 'extension') {
                    card.style.setProperty('display', 'none', 'important');
                } else if (text.includes('connection') || iconText === 'lan') {
                    if (!btn.dataset.statutoryHooked) {
                        btn.dataset.statutoryHooked = 'true';
                        btn.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const closeBtn = document.querySelector('app-setup .dialog-close-btn, .dlg-container .dialog-close-btn');
                            if (closeBtn) closeBtn.click();
                            showStatutoryWarningModal();
                        }, true);
                    }
                }
            }

            // 2. In /device view (Connections page)
            if (window.location.pathname.includes('/device')) {
                const addBtns = document.querySelectorAll('.fab-add, button.fab-add, mat-fab, button[mattooltip*="add"], button[mattooltip*="Add"], button[mattooltip*="aggiungi"]');
                for (let i = 0; i < addBtns.length; i++) {
                    if (addBtns[i].style.display !== 'none') {
                        addBtns[i].style.setProperty('display', 'none', 'important');
                    }
                }
                const notices = document.querySelectorAll('.device-plugins-notice, .plugins-notice');
                for (let i = 0; i < notices.length; i++) {
                    if (notices[i].style.display !== 'none') {
                        notices[i].style.setProperty('display', 'none', 'important');
                    }
                }

                const workPanel = document.querySelector('app-device .work-panel, app-device');
                if (workPanel && !document.getElementById('fuxa-statutory-device-banner')) {
                    const banner = document.createElement('div');
                    banner.id = 'fuxa-statutory-device-banner';
                    banner.style.cssText = 'background: rgba(234, 179, 8, 0.12); border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 6px; padding: 12px 18px; margin: 12px 16px; display: flex; align-items: center; gap: 12px; color: #fef08a; font-size: 13px; font-weight: 500; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); z-index: 100;';
                    banner.innerHTML = `
                        <span style="font-size: 22px; line-height: 1;">⚠️</span>
                        <div style="flex: 1; line-height: 1.5;">
                            <strong style="color: #facc15; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px;">Statutory Restriction: Read-Only Mapped View</strong>
                            ${STATUTORY_WARNING_TEXT}
                        </div>
                    `;
                    workPanel.prepend(banner);
                }
            }

            // 3. If URL ends with /plugins, redirect to /editor
            if (window.location.pathname.includes('/plugins')) {
                window.location.href = getBasePath() + '/editor';
                setTimeout(showStatutoryWarningModal, 400);
            }
        } finally {
            isMutating = false;
        }
    }

    function injectAppSettingsCard() {
        const dialog = document.querySelector('app-app-settings, .mat-mdc-dialog-container');
        if (!dialog || dialog.querySelector('.custom-url-setting-field')) return;

        const portInput = dialog.querySelector('input[numberonly], input[disabled]');
        if (!portInput) return;
        const portContainer = portInput.closest('.my-form-field') || portInput.parentElement;
        if (!portContainer) return;

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

    function injectLayoutHeadlineField() {
        const layoutDialog = document.querySelector('app-layout-property');
        if (!layoutDialog || layoutDialog.querySelector('#fuxa-layout-headline-field')) return;

        const configRight = layoutDialog.querySelector('.config-right');
        if (!configRight) return;

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

            const previewHeader = layoutDialog.querySelector('.header-items-button');
            if (previewHeader) {
                previewHeader.style.setProperty('justify-content', 'center', 'important');
                let btn = previewHeader.querySelector('button, span, div');
                if (btn) btn.textContent = newText;
            }

            try {
                const res = await fetch('api/project-name', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newText })
                });
                if (res.ok) {
                    liveProjectName = newText;
                    updateHeaderBadge(newText);
                    ensureTvsHeaderLogo();
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

        const layoutOkBtn = layoutDialog.querySelector('.dialog-action button[color="primary"], button[cdkfocusinitial]');
        if (layoutOkBtn) {
            layoutOkBtn.addEventListener('click', saveHeadline);
        }
    }

    let observerInitialized = false;
    function observeSettingsDialog() {
        if (observerInitialized) return;
        observerInitialized = true;

        removeHeaderPageUrlButton();
        enforceViewServerRestrictions();

        const checkAndInject = () => {
            if (isMutating) return;
            isMutating = true;
            try {
                enforceViewServerRestrictions();
                injectAppSettingsCard();
                injectLayoutHeadlineField();
            } finally {
                isMutating = false;
            }
        };

        // MutationObserver scoped to detect modal dialog appearance (NO heavy subtree loops)
        const observer = new MutationObserver((mutations) => {
            if (isMutating) return;
            let hasAddedNodes = false;
            for (let i = 0; i < mutations.length; i++) {
                if (mutations[i].addedNodes && mutations[i].addedNodes.length > 0) {
                    hasAddedNodes = true;
                    break;
                }
            }
            if (hasAddedNodes) {
                checkAndInject();
            }
        });

        // Observe only dialog overlay containers
        const overlayContainer = document.querySelector('.cdk-overlay-container') || document.body;
        observer.observe(overlayContainer, { childList: true });

        // If overlay container is created later on body, listen for it once
        if (overlayContainer === document.body) {
            const bodyObs = new MutationObserver(() => {
                const newOverlay = document.querySelector('.cdk-overlay-container');
                if (newOverlay) {
                    bodyObs.disconnect();
                    observer.disconnect();
                    observer.observe(newOverlay, { childList: true });
                }
            });
            bodyObs.observe(document.body, { childList: true });
        }
    }

    // Intercept client-side routing to update header immediately when switching between editor & view
    const wrapHistoryMethod = (type) => {
        const orig = history[type];
        return function () {
            const result = orig.apply(this, arguments);
            setTimeout(ensureTvsHeaderLogo, 50);
            return result;
        };
    };
    history.pushState = wrapHistoryMethod('pushState');
    history.replaceState = wrapHistoryMethod('replaceState');
    window.addEventListener('popstate', () => setTimeout(ensureTvsHeaderLogo, 50));

    // Safe Single-Run Initialization
    function init() {
        removeHeaderPageUrlButton();
        ensureTvsHeaderLogo();
        enforceViewServerRestrictions();
        fetchLiveProjectName();
        observeSettingsDialog();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    // Heartbeat check (every 800ms) to guarantee View header elements persist across Angular route switches
    setInterval(() => {
        ensureTvsHeaderLogo();
        enforceViewServerRestrictions();
    }, 800);

})();

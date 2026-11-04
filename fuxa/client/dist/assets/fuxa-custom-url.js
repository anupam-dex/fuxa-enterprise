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

    // Ensure direct navigation to /home/:viewName normalizes to /home?viewName=... for 100% universal compatibility
    try {
        const pName = window.location.pathname;
        const viewMatch = pName.match(/^(.*\/home)\/([^/?#]+)$/);
        if (viewMatch && !window.location.search.includes('viewName=')) {
            const homeBase = viewMatch[1];
            const targetView = decodeURIComponent(viewMatch[2]);
            const newUrl = homeBase + '?viewName=' + encodeURIComponent(targetView) + (window.location.hash || '');
            window.location.replace(newUrl);
        }
    } catch (e) {}

    let liveProjectName = localStorage.getItem('fuxa_project_name') || '';
    let currentInstancePort = null;
    let isMutating = false;

    // Permanently suppress plugins notice popup via global CSS
    try {
        if (!document.getElementById('fuxa-suppress-plugins-notice-style')) {
            const style = document.createElement('style');
            style.id = 'fuxa-suppress-plugins-notice-style';
            style.textContent = `
                app-section-message-dialog,
                .cdk-overlay-pane:has(app-section-message-dialog),
                .mat-mdc-dialog-container:has(app-section-message-dialog),
                .device-plugins-notice,
                .plugins-notice {
                    display: none !important;
                    visibility: hidden !important;
                    opacity: 0 !important;
                    pointer-events: none !important;
                }

                /* View Properties dialog restored to normal 760px width */
                .cdk-overlay-pane:has(app-view-property),
                .mat-mdc-dialog-container:has(app-view-property),
                app-view-property,
                app-view-property .container,
                app-view-property form.container {
                    width: 760px !important;
                    max-width: 95vw !important;
                    box-sizing: border-box !important;
                }
                app-view-property .property-container,
                app-view-property .mat-tab-container {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                app-view-property .my-form-field.block,
                app-view-property .my-form-field.block input[type="text"] {
                    width: 100% !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                }
                app-app-settings .custom-url-setting-field,
                app-app-settings .custom-url-setting-field .my-form-field {
                    width: 320px !important;
                    max-width: 320px !important;
                    box-sizing: border-box !important;
                }
                app-view-property mat-select,
                app-view-property .my-form-field.block input {
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                /* Live Date & Time badge in header */
                app-header .header-right {
                    width: auto !important;
                    min-width: 120px !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: flex-end !important;
                }
                .fuxa-header-datetime-badge {
                    user-select: none !important;
                    white-space: nowrap !important;
                    font-variant-numeric: tabular-nums !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        }
    } catch (e) {}

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
        if (currentInstancePort && currentInstancePort > 1024) return currentInstancePort;
        if (window.location.port && window.location.port !== '80' && window.location.port !== '443') {
            const p = parseInt(window.location.port, 10);
            if (!isNaN(p) && p > 1024) {
                currentInstancePort = p;
                localStorage.setItem('fuxa_target_port', p);
                return p;
            }
        }
        const pInput = document.querySelector('app-app-settings input[numberonly], app-app-settings .tab-system input');
        if (pInput && pInput.value) {
            const pVal = parseInt(pInput.value, 10);
            if (!isNaN(pVal) && pVal > 1024) {
                currentInstancePort = pVal;
                return pVal;
            }
        }
        const saved = parseInt(localStorage.getItem('fuxa_target_port') || '0', 10);
        if (saved && saved > 1024) {
            currentInstancePort = saved;
            return saved;
        }
        return 9610;
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
            // 1. In Editor page: STRICTLY REMOVE any TVS logo or stray project badge!
            const editorLogo = document.getElementById('fuxa-header-tvs-logo');
            if (editorLogo) editorLogo.remove();
            const editorBadge = document.getElementById('fuxa-header-project-badge');
            if (editorBadge) editorBadge.remove();

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
            ensureRuntimeFooter();
            ensureHeaderLiveDateTime();
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

    function ensureRuntimeFooter() {
        const isEditor = window.location.pathname.includes('/editor');
        const runtimeHeader = document.querySelector('app-home .header, mat-sidenav-content > .header, .sidenav-container .header');
        const isViewPage = !isEditor && (!!runtimeHeader || !!document.querySelector('app-home'));

        if (!isViewPage) {
            const staleFooter = document.getElementById('fuxa-runtime-footer');
            if (staleFooter) staleFooter.remove();
            return;
        }

        let footer = document.getElementById('fuxa-runtime-footer');
        const footerHtml = `<span>Developed and Maintained by <strong style="font-weight: 700; color: #183883;">Plant Engineering</strong> &bull; v1.3</span>`;
        if (!footer) {
            footer = document.createElement('div');
            footer.id = 'fuxa-runtime-footer';
            footer.style.cssText = 'position: fixed; bottom: 0; left: 0; right: 0; height: 26px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.94); backdrop-filter: blur(6px); border-top: 1px solid rgba(24, 56, 131, 0.16); box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.05); color: #183883; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 11.5px; letter-spacing: 0.3px; z-index: 9990; user-select: none; pointer-events: none;';
            footer.innerHTML = footerHtml;
            document.body.appendChild(footer);
        } else if (footer.innerHTML !== footerHtml) {
            footer.innerHTML = footerHtml;
        }
    }

    function formatLiveDateTime(d) {
        const pad = (n) => String(n).padStart(2, '0');
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const day = pad(d.getDate());
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = pad(d.getHours());
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());
        return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
    }

    let liveDateTimeInterval = null;
    function startLiveDateTimeTicker() {
        if (liveDateTimeInterval) return;
        liveDateTimeInterval = setInterval(updateAllLiveDateTimes, 1000);
    }

    function updateAllLiveDateTimes() {
        const now = new Date();
        const formatted = formatLiveDateTime(now);
        const elements = document.querySelectorAll('.fuxa-live-datetime-text');
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].textContent !== formatted) {
                elements[i].textContent = formatted;
            }
        }
    }

    function ensureHeaderLiveDateTime() {
        startLiveDateTimeTicker();
        const now = new Date();
        const formatted = formatLiveDateTime(now);

        // 1. In View / Runtime page (app-home .header)
        const runtimeHeader = document.querySelector('app-home .header, mat-sidenav-content > .header, .sidenav-container .header');
        if (runtimeHeader) {
            let viewDateTime = document.getElementById('fuxa-view-header-datetime');
            const notifyContainer = runtimeHeader.querySelector('.header-notify-button');
            const targetParent = notifyContainer || runtimeHeader;

            // Check if Angular native header-date-time exists and has non-empty text
            const nativeDateTime = runtimeHeader.querySelector('.header-date-time:not(#fuxa-view-header-datetime)');
            if (nativeDateTime && nativeDateTime.textContent.trim().length > 3) {
                if (viewDateTime) viewDateTime.remove();
            } else {
                if (!viewDateTime) {
                    viewDateTime = document.createElement('div');
                    viewDateTime.id = 'fuxa-view-header-datetime';
                    viewDateTime.className = 'header-date-time fuxa-header-datetime-badge';
                    viewDateTime.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; margin-left: 8px; border-left: 1px solid rgba(255,255,255,0.22); font-size: 13px; font-weight: 500; font-family: monospace, sans-serif; letter-spacing: 0.3px; color: inherit; user-select: none; white-space: nowrap; height: 100%;';
                    viewDateTime.innerHTML = `
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.85; flex-shrink: 0;">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <span class="fuxa-live-datetime-text">${formatted}</span>
                    `;
                    targetParent.appendChild(viewDateTime);
                } else if (viewDateTime.parentNode !== targetParent) {
                    targetParent.appendChild(viewDateTime);
                }
            }
        }

        // 2. In Editor page (app-header .header-right)
        const editorHeaderRight = document.querySelector('app-header .header-right');
        if (editorHeaderRight) {
            let editorDateTime = document.getElementById('fuxa-editor-header-datetime');
            if (!editorDateTime) {
                editorDateTime = document.createElement('div');
                editorDateTime.id = 'fuxa-editor-header-datetime';
                editorDateTime.className = 'fuxa-header-datetime-badge';
                editorDateTime.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; margin-right: 10px; border-left: 1px solid rgba(255,255,255,0.18); font-size: 13px; font-weight: 500; font-family: monospace, sans-serif; letter-spacing: 0.3px; color: rgba(255,255,255,0.88); user-select: none; white-space: nowrap; height: 100%;';
                editorDateTime.innerHTML = `
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.85; flex-shrink: 0;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span class="fuxa-live-datetime-text">${formatted}</span>
                `;
                const helpDiv = editorHeaderRight.querySelector('.header-help');
                if (helpDiv) {
                    editorHeaderRight.insertBefore(editorDateTime, helpDiv);
                } else {
                    editorHeaderRight.prepend(editorDateTime);
                }
            } else {
                const helpDiv = editorHeaderRight.querySelector('.header-help');
                if (helpDiv && editorDateTime.nextElementSibling !== helpDiv) {
                    editorHeaderRight.insertBefore(editorDateTime, helpDiv);
                }
            }
        }
    }

    function updateHeaderBadge(name) {
        ensureTvsHeaderLogo();
        const badge = document.getElementById('fuxa-header-project-badge');
        if (badge) badge.remove();
        if (!name) return;
        document.title = `${name} - TVS SCADA`;
    }

    async function fetchLiveProjectName() {
        try {
            const res = await fetch('api/project-name');
            if (res.ok) {
                const data = await res.json();
                if (data.port) {
                    currentInstancePort = data.port;
                    localStorage.setItem('fuxa_target_port', data.port);
                }
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
                    if (data2.port) {
                        currentInstancePort = data2.port;
                        localStorage.setItem('fuxa_target_port', data2.port);
                    }
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

        const currentPort = getTargetPort();
        const currentSub = getBasePath();
        const payload = JSON.stringify({ name: cleanName, port: currentPort, subpath: currentSub });
        const host = window.location.hostname || '127.0.0.1';

        // 1. Save to FUXA Server DB
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

        // 2. Sync to Fleet Manager (Port 9000) so Fleet Manager card updates immediately
        try {
            await fetch(`http://${host}:9000/api/update-subpath`, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            });
            console.log(`[FUXA-Manager] Synced project name to Fleet Manager: ${cleanName}`);
        } catch (e3) {}
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

        // 2. Update Fleet Manager (Port 9000) - Fleet Manager will update Gateway atomically
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

    function getPlantId() {
        const m = window.location.pathname.match(/\/p(\d+)/);
        if (m) return parseInt(m[1], 10);
        const subpath = getBasePath();
        const m2 = subpath.match(/\/p(\d+)/);
        if (m2) return parseInt(m2[1], 10);
        return 9;
    }

    function showSuccessToast(message) {
        let toast = document.getElementById('fuxa-success-toast');
        if (toast) toast.remove();
        toast = document.createElement('div');
        toast.id = 'fuxa-success-toast';
        toast.style.cssText = 'position: fixed; top: 24px; left: 50%; transform: translateX(-50%); background: #15803d; color: #ffffff; padding: 12px 24px; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); font-size: 13.5px; font-weight: 600; z-index: 100000; display: flex; align-items: center; gap: 10px; font-family: system-ui, -apple-system, sans-serif; border: 1px solid #22c55e;';
        toast.innerHTML = `<span style="font-size: 18px; font-weight: 900;">✓</span> <span>${message}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 4000);
    }

    const STORAGE_DEVICES_PRESETS = {
        1: [
            {
                device_key: 'Boiler_01',
                id: 'dev_p1_boiler_01',
                name: 'Boiler 01',
                division: 'Boiler House',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p1_Steam_Pressure_Bar': { id: 'tag_p1_Steam_Pressure_Bar', name: 'Steam_Pressure_Bar', label: 'Steam Pressure (Bar)', type: 'number', address: 'ns=2;s=Plant_1.Boiler_House.Boiler_01.Steam_Pressure_Bar' },
                    'tag_p1_Steam_Temp_C': { id: 'tag_p1_Steam_Temp_C', name: 'Steam_Temp_C', label: 'Steam Temperature (°C)', type: 'number', address: 'ns=2;s=Plant_1.Boiler_House.Boiler_01.Steam_Temp_C' },
                    'tag_p1_Burner_Status': { id: 'tag_p1_Burner_Status', name: 'Burner_Status', label: 'Boiler Burner Status', type: 'boolean', address: 'ns=2;s=Plant_1.Boiler_House.Boiler_01.Burner_Status' }
                }
            },
            {
                device_key: 'Feed_Water_Pump',
                id: 'dev_p1_feed_water_pump',
                name: 'Feed Water Pump',
                division: 'Boiler House',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p1_Flow_Rate_M3H': { id: 'tag_p1_Flow_Rate_M3H', name: 'Flow_Rate_M3H', label: 'Feed Water Flow Rate (m³/h)', type: 'number', address: 'ns=2;s=Plant_1.Boiler_House.Feed_Water_Pump.Flow_Rate_M3H' },
                    'tag_p1_Pump_Running': { id: 'tag_p1_Pump_Running', name: 'Pump_Running', label: 'Feed Water Pump State', type: 'boolean', address: 'ns=2;s=Plant_1.Boiler_House.Feed_Water_Pump.Pump_Running' }
                }
            }
        ],
        2: [
            {
                device_key: 'Press_Line_A',
                id: 'dev_p2_press_line_a',
                name: 'Press Line A',
                division: 'Stamping Shop',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p2_Tonnage_Ton': { id: 'tag_p2_Tonnage_Ton', name: 'Tonnage_Ton', label: 'Main Ram Tonnage (Ton)', type: 'number', address: 'ns=2;s=Plant_2.Stamping_Shop.Press_Line_A.Tonnage_Ton' },
                    'tag_p2_Cycle_Count': { id: 'tag_p2_Cycle_Count', name: 'Cycle_Count', label: 'Press Cycle Count', type: 'number', address: 'ns=2;s=Plant_2.Stamping_Shop.Press_Line_A.Cycle_Count' },
                    'tag_p2_Clutch_Engaged': { id: 'tag_p2_Clutch_Engaged', name: 'Clutch_Engaged', label: 'Flywheel Clutch State', type: 'boolean', address: 'ns=2;s=Plant_2.Stamping_Shop.Press_Line_A.Clutch_Engaged' }
                }
            }
        ],
        3: [
            {
                device_key: 'Conveyor_Main',
                id: 'dev_p3_conveyor_main',
                name: 'Conveyor Main',
                division: 'Assembly Shop',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p3_Line_Speed_MPM': { id: 'tag_p3_Line_Speed_MPM', name: 'Line_Speed_MPM', label: 'Conveyor Line Speed (m/min)', type: 'number', address: 'ns=2;s=Plant_3.Assembly_Shop.Conveyor_Main.Line_Speed_MPM' },
                    'tag_p3_E_Stop_Active': { id: 'tag_p3_E_Stop_Active', name: 'E_Stop_Active', label: 'Emergency Stop Line Circuit', type: 'boolean', address: 'ns=2;s=Plant_3.Assembly_Shop.Conveyor_Main.E_Stop_Active' },
                    'tag_p3_Takt_Time_Sec': { id: 'tag_p3_Takt_Time_Sec', name: 'Takt_Time_Sec', label: 'Takt Time Target (s)', type: 'number', address: 'ns=2;s=Plant_3.Assembly_Shop.Conveyor_Main.Takt_Time_Sec' }
                }
            }
        ],
        4: [
            {
                device_key: 'Chiller_Line_1',
                id: 'dev_p4_chiller_line_1',
                name: 'Chiller Line 1',
                division: 'Facility Utilities',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p4_Chiller_Temp_C': { id: 'tag_p4_Chiller_Temp_C', name: 'Chiller_Temp_C', label: 'Chilled Water Supply (°C)', type: 'number', address: 'ns=2;s=Plant_4.Facility_Utilities.Chiller_Line_1.Chiller_Temp_C' },
                    'tag_p4_Compressor_Current_A': { id: 'tag_p4_Compressor_Current_A', name: 'Compressor_Current_A', label: 'Compressor Current Draw (A)', type: 'number', address: 'ns=2;s=Plant_4.Facility_Utilities.Chiller_Line_1.Compressor_Current_A' },
                    'tag_p4_Chiller_Running': { id: 'tag_p4_Chiller_Running', name: 'Chiller_Running', label: 'Chiller Active State', type: 'boolean', address: 'ns=2;s=Plant_4.Facility_Utilities.Chiller_Line_1.Chiller_Running' }
                }
            },
            {
                device_key: 'Air_Compressor',
                id: 'dev_p4_air_compressor',
                name: 'Air Compressor',
                division: 'Facility Utilities',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p4_Header_Pressure_Bar': { id: 'tag_p4_Header_Pressure_Bar', name: 'Header_Pressure_Bar', label: 'Main Air Header Pressure (Bar)', type: 'number', address: 'ns=2;s=Plant_4.Facility_Utilities.Air_Compressor.Header_Pressure_Bar' },
                    'tag_p4_Motor_Speed_RPM': { id: 'tag_p4_Motor_Speed_RPM', name: 'Motor_Speed_RPM', label: 'Compressor Motor Speed (RPM)', type: 'number', address: 'ns=2;s=Plant_4.Facility_Utilities.Air_Compressor.Motor_Speed_RPM' }
                }
            }
        ],
        9: [
            {
                device_key: 'Oven_Line_1',
                id: 'dev_p9_oven_line_1',
                name: 'Oven Line 1',
                division: 'Paintshop Division 6',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p9_Zone1_Temperature_C': { id: 'tag_p9_Zone1_Temperature_C', name: 'Zone1_Temperature_C', label: 'Curing Oven Zone 1 Temp (°C)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Oven_Line_1.Zone1_Temperature_C' },
                    'tag_p9_Zone2_Temperature_C': { id: 'tag_p9_Zone2_Temperature_C', name: 'Zone2_Temperature_C', label: 'Curing Oven Zone 2 Temp (°C)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Oven_Line_1.Zone2_Temperature_C' },
                    'tag_p9_Exhaust_Fan_Running': { id: 'tag_p9_Exhaust_Fan_Running', name: 'Exhaust_Fan_Running', label: 'Exhaust Draft Fan State', type: 'boolean', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Oven_Line_1.Exhaust_Fan_Running' },
                    'tag_p9_Oven_Burner_Fault': { id: 'tag_p9_Oven_Burner_Fault', name: 'Oven_Burner_Fault', label: 'Burner Flame Safety Status', type: 'boolean', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Oven_Line_1.Oven_Burner_Fault' }
                }
            },
            {
                device_key: 'Spray_Booth_Line_1',
                id: 'dev_p9_spray_booth_line_1',
                name: 'Spray Booth Line 1',
                division: 'Paintshop Division 6',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p9_Booth_Static_Pressure_Pa': { id: 'tag_p9_Booth_Static_Pressure_Pa', name: 'Booth_Static_Pressure_Pa', label: 'Spray Booth Air Balance (Pa)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Spray_Booth_Line_1.Booth_Static_Pressure_Pa' },
                    'tag_p9_Paint_Flow_CC_Min': { id: 'tag_p9_Paint_Flow_CC_Min', name: 'Paint_Flow_CC_Min', label: 'Atomizer Paint Delivery (cc/min)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Spray_Booth_Line_1.Paint_Flow_CC_Min' },
                    'tag_p9_Robot_Armed': { id: 'tag_p9_Robot_Armed', name: 'Robot_Armed', label: 'Bell Applicator Robot Armed', type: 'boolean', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Spray_Booth_Line_1.Robot_Armed' },
                    'tag_p9_Downdraft_Velocity_MPS': { id: 'tag_p9_Downdraft_Velocity_MPS', name: 'Downdraft_Velocity_MPS', label: 'Booth Downdraft Airflow (m/s)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Spray_Booth_Line_1.Downdraft_Velocity_MPS' }
                }
            },
            {
                device_key: 'Pre_Treatment_Line_1',
                id: 'dev_p9_pre_treatment_line_1',
                name: 'Pre-Treatment Line 1',
                division: 'Paintshop Division 6',
                type: 'OPCUA',
                influxdb_logging: true,
                tags: {
                    'tag_p9_Degreasing_Tank_Temp_C': { id: 'tag_p9_Degreasing_Tank_Temp_C', name: 'Degreasing_Tank_Temp_C', label: 'Alkaline Degreasing Temp (°C)', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Pre_Treatment_Line_1.Degreasing_Tank_Temp_C' },
                    'tag_p9_Rinse_Tank_pH': { id: 'tag_p9_Rinse_Tank_pH', name: 'Rinse_Tank_pH', label: 'Demineralized Rinse Water pH', type: 'number', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Pre_Treatment_Line_1.Rinse_Tank_pH' },
                    'tag_p9_Circulation_Pump_Running': { id: 'tag_p9_Circulation_Pump_Running', name: 'Circulation_Pump_Running', label: 'Dip Tank Circulation Pump State', type: 'boolean', address: 'ns=2;s=Plant_9.Paintshop_Division_6.Pre_Treatment_Line_1.Circulation_Pump_Running' }
                }
            }
        ]
    };

    function openAddStorageDeviceModal() {
        if (document.getElementById('fuxa-storage-device-modal')) return;

        const plantId = getPlantId();
        const currentBasePath = getBasePath();

        // 1. Gather existing device names from the page canvas / table
        const existingDeviceNames = new Set();
        document.querySelectorAll('.map-container .node-flow .device-header, .map-container [class*="node"] .device-header, .table-wrapper mat-row mat-cell:nth-child(2)').forEach(el => {
            const txt = (el.textContent || '').trim().toLowerCase();
            if (txt && txt !== 'fuxa server') {
                existingDeviceNames.add(txt);
            }
        });

        // 2. Build overlay modal DOM
        const overlay = document.createElement('div');
        overlay.id = 'fuxa-storage-device-modal';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(6px); z-index: 99999; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: #1e293b; border: 1.5px solid #334155; border-radius: 10px; width: 560px; max-width: 94vw; box-shadow: 0 20px 40px rgba(0,0,0,0.5); overflow: hidden; display: flex; flex-direction: column; color: #f8fafc;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'padding: 16px 20px; background: #0f172a; border-bottom: 1px solid #334155; display: flex; align-items: center; justify-content: space-between;';
        header.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 32px; height: 32px; border-radius: 6px; background: #183883; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 900; color: #ffffff;">+</div>
                <div>
                    <div style="font-size: 15px; font-weight: 700; color: #f8fafc; letter-spacing: 0.3px;">Add Device from Central Storage</div>
                    <div style="font-size: 11.5px; color: #94a3b8; margin-top: 1px;">
                        <span style="color: #4ade80; font-weight: 600;">● InfluxDB Historical Logging Active</span> • Zero Duplicate Field Polling
                    </div>
                </div>
            </div>
            <button id="fuxa-modal-close-btn" style="background: transparent; border: none; color: #94a3b8; font-size: 20px; cursor: pointer; padding: 4px 8px; border-radius: 4px; line-height: 1;">✕</button>
        `;

        // Body
        const body = document.createElement('div');
        body.style.cssText = 'padding: 18px 20px; overflow-y: auto; max-height: 72vh;';

        // Info Banner
        const infoBanner = document.createElement('div');
        infoBanner.style.cssText = 'background: rgba(30, 41, 59, 0.7); border: 1px solid #3b82f6; border-left: 4px solid #3b82f6; border-radius: 5px; padding: 10px 14px; font-size: 12.5px; color: #cbd5e1; line-height: 1.45; margin-bottom: 16px;';
        infoBanner.innerHTML = `
            Physical factory devices are connected and logged to InfluxDB by the <strong>Plant ${plantId} Storage Master</strong>. 
            Select an industrial device below to stream its tags directly into this SCADA view via the high-speed OPC-UA bridge without polling physical PLCs twice.
        `;
        body.appendChild(infoBanner);

        // Dropdown Form Group
        const formGroup = document.createElement('div');
        formGroup.style.cssText = 'margin-bottom: 14px;';
        formGroup.innerHTML = `
            <label style="display: block; font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 6px;">Select Device Connected to InfluxDB:</label>
            <select id="fuxa-device-dropdown-select" style="width: 100%; height: 38px; background: #0f172a; border: 1px solid #475569; border-radius: 6px; color: #f8fafc; font-size: 13.5px; padding: 0 10px; outline: none; cursor: pointer;">
                <option value="">-- Choose a Storage Device --</option>
            </select>
        `;
        body.appendChild(formGroup);

        // Preview Container
        const previewContainer = document.createElement('div');
        previewContainer.id = 'fuxa-device-preview-card';
        previewContainer.style.cssText = 'background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 14px; display: none;';
        body.appendChild(previewContainer);

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 14px 20px; background: #0f172a; border-top: 1px solid #334155; display: flex; justify-content: flex-end; gap: 10px; align-items: center;';
        footer.innerHTML = `
            <button id="fuxa-modal-cancel-btn" style="padding: 7px 16px; background: #334155; color: #e2e8f0; border: 1px solid #475569; border-radius: 5px; font-size: 13px; font-weight: 600; cursor: pointer;">Cancel</button>
            <button id="fuxa-modal-connect-btn" disabled style="padding: 7px 20px; background: #475569; color: #94a3b8; border: 1px solid #64748b; border-radius: 5px; font-size: 13px; font-weight: 700; cursor: not-allowed; display: inline-flex; align-items: center; gap: 6px;">
                <span>⚡</span> Connect & Stream Device
            </button>
        `;

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const selectEl = modal.querySelector('#fuxa-device-dropdown-select');
        const connectBtn = modal.querySelector('#fuxa-modal-connect-btn');
        const cancelBtn = modal.querySelector('#fuxa-modal-cancel-btn');
        const closeBtn = modal.querySelector('#fuxa-modal-close-btn');

        const closeModal = () => {
            overlay.remove();
        };

        cancelBtn.onclick = closeModal;
        closeBtn.onclick = closeModal;
        overlay.onclick = (e) => {
            if (e.target === overlay) closeModal();
        };

        // Populate Dropdown from API or presets
        let availableDevices = STORAGE_DEVICES_PRESETS[plantId] || STORAGE_DEVICES_PRESETS[9] || [];
        
        function renderOptions(devices) {
            selectEl.innerHTML = '';
            devices.forEach((dev, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                const tagCount = dev.tag_count || Object.keys(dev.tags || {}).length;
                const isAlready = existingDeviceNames.has(dev.name.toLowerCase()) || existingDeviceNames.has(dev.id.toLowerCase());
                opt.textContent = `${dev.name} (${tagCount} Tags • InfluxDB Logged)${isAlready ? ' — [Already Connected]' : ''}`;
                selectEl.appendChild(opt);
            });
            updatePreview(0, devices);
        }

        function updatePreview(idx, devices) {
            const dev = devices[idx];
            if (!dev) {
                previewContainer.style.display = 'none';
                connectBtn.disabled = true;
                connectBtn.style.background = '#475569';
                connectBtn.style.color = '#94a3b8';
                connectBtn.style.cursor = 'not-allowed';
                return;
            }

            previewContainer.style.display = 'block';
            const tagKeys = Object.keys(dev.tags || {});
            const tagRows = tagKeys.map(k => {
                const t = dev.tags[k];
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; border-bottom: 1px solid #334155; font-size: 11.5px; font-family: monospace;">
                        <span style="color: #60a5fa; font-weight: 600;">${t.name}</span>
                        <span style="color: #94a3b8; font-size: 10.5px; background: #1e293b; padding: 1px 6px; border-radius: 3px;">${t.type || 'number'}</span>
                        <span style="color: #64748b; font-size: 10.5px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.address || ''}</span>
                    </div>
                `;
            }).join('');

            const isAlready = existingDeviceNames.has(dev.name.toLowerCase()) || existingDeviceNames.has(dev.id.toLowerCase());

            previewContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 14px; font-weight: 700; color: #f8fafc;">${dev.name}</div>
                    <span style="background: #14532d; color: #4ade80; border: 1px solid #22c55e; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 700;">
                        ● Active in InfluxDB
                    </span>
                </div>
                <div style="font-size: 12px; color: #94a3b8; margin-bottom: 10px; line-height: 1.45;">
                    <div><strong>Plant / Division:</strong> ${dev.division || 'Paintshop Complex'}</div>
                    <div><strong>OPC-UA Bridge Address:</strong> <code style="color: #cbd5e1; font-size: 11px;">opc.tcp://127.0.0.1:4845/fuxa/server/</code></div>
                    <div><strong>Data Transmission:</strong> <span style="color: #38bdf8;">Streaming via Central Bridge (Zero PLC Overload)</span></div>
                </div>
                <div style="font-size: 11.5px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">Available Tags to Stream (${tagKeys.length}):</div>
                <div style="max-height: 140px; overflow-y: auto; background: #131d2e; border: 1px solid #334155; border-radius: 4px; padding: 4px;">
                    ${tagRows}
                </div>
            `;

            connectBtn.disabled = false;
            connectBtn.style.cursor = 'pointer';
            if (isAlready) {
                connectBtn.style.background = '#0284c7';
                connectBtn.style.borderColor = '#38bdf8';
                connectBtn.style.color = '#ffffff';
                connectBtn.innerHTML = `<span>🔄</span> Re-sync & Update Device Tags`;
            } else {
                connectBtn.style.background = '#183883';
                connectBtn.style.borderColor = '#3b82f6';
                connectBtn.style.color = '#ffffff';
                connectBtn.innerHTML = `<span>⚡</span> Connect & Stream Device`;
            }

            connectBtn.onclick = () => {
                connectBtn.disabled = true;
                connectBtn.innerHTML = `Connecting... ⏳`;

                const devPayload = {
                    id: dev.id,
                    name: dev.name,
                    type: 'OPCUA',
                    enabled: true,
                    property: {
                        address: 'opc.tcp://127.0.0.1:4845/fuxa/server/',
                        options: {
                            securityMode: 'None',
                            securityPolicy: 'None'
                        }
                    },
                    tags: dev.tags
                };

                const token = window.fuxaAccessToken || (JSON.parse(localStorage.getItem('currentUser') || '{}').token) || '';
                const headers = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = 'Bearer ' + token;

                // 1. Post to local instance projectData
                fetch(currentBasePath + '/api/projectData', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ cmd: 'set-device', data: devPayload })
                }).catch(() => {});

                // 2. Also register on Fleet Manager
                fetch('/api/storage-devices/connect', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plant: plantId,
                        subpath: currentBasePath,
                        device_key: dev.device_key
                    })
                }).catch(() => {});

                showSuccessToast(`Device '${dev.name}' connected! Streaming ${tagKeys.length} tags from Central InfluxDB Storage.`);
                setTimeout(() => {
                    closeModal();
                    window.location.reload();
                }, 850);
            };
        }

        // Try to fetch dynamic list from Fleet Manager
        fetch(`/api/storage-devices?plant=${plantId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data && data.devices && data.devices.length > 0) {
                    availableDevices = data.devices;
                }
                renderOptions(availableDevices);
            })
            .catch(() => {
                renderOptions(availableDevices);
            });

        selectEl.onchange = () => {
            updatePreview(parseInt(selectEl.value, 10), availableDevices);
        };
    }

    function isStorageServer() {
        const port = parseInt(window.location.port, 10) || currentInstancePort || parseInt(localStorage.getItem('fuxa_target_port') || '0', 10);
        if ([5100, 5200, 5300, 5400, 5900].includes(port)) return true;
        const path = (window.location.pathname || '').toLowerCase();
        if (path.includes('/storage')) return true;
        const base = (getBasePath() || '').toLowerCase();
        if (base.includes('/storage')) return true;
        return false;
    }

    let storageTopologyData = null;
    let topoSelectedDivision = 'all';
    let topoSelectedLine = 'all';
    let topoSearchQuery = '';
    let isFetchingTopology = false;

    const TOPO_DIVISIONS = {
        1: "Body Shop",
        2: "Stamping",
        3: "Assembly",
        4: "Quality & Inspection",
        5: "Utility & Boiler",
        6: "Paintshop",
        7: "Robotics & Automation",
        8: "Material Handling"
    };

    function enhanceNativeDeviceNodesWithTelemetry(devicesList) {
        if (!Array.isArray(devicesList)) return;
        const nodes = document.querySelectorAll('app-device-map .node-device, .node-flow');
        nodes.forEach(node => {
            const header = node.querySelector('.device-header');
            if (!header) return;
            const name = header.textContent.trim();
            const dev = devicesList.find(d => d.name === name || (d.property && d.property.address === name));
            if (!dev || !dev.telemetry) return;

            let badge = node.querySelector('.fuxa-native-telem-badge');
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'fuxa-native-telem-badge';
                badge.style.cssText = 'font-size: 10px; color: #94a3b8; margin-top: 4px; line-height: 1.35; font-family: monospace; text-align: left; background: rgba(0,0,0,0.45); padding: 3px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);';
                node.appendChild(badge);
            }
            const telem = dev.telemetry;
            const isConn = !!telem.connected;
            const lastConn = telem.lastConnectedFormatted || (telem.lastConnected ? new Date(telem.lastConnected).toLocaleString() : 'Never');
            const reconns = typeof telem.reconnectCount === 'number' ? telem.reconnectCount : 0;
            badge.innerHTML = `
                <div style="color: ${isConn ? '#4ade80' : (telem.lastConnected ? '#fde047' : '#ef4444')}; font-weight: 600;">🕒 ${lastConn}</div>
                <div style="color: #cbd5e1;">🔄 Reconnects: <strong>${reconns}</strong></div>
            `;
        });
    }

    async function fetchStorageTopology() {
        if (isFetchingTopology) return;
        isFetchingTopology = true;
        try {
            let res = await fetch('api/storage/topology').catch(() => null);
            if (!res || !res.ok) {
                res = await fetch('/api/storage/topology').catch(() => null);
            }
            if (res && res.ok) {
                storageTopologyData = await res.json();
                updateStorageTopologyDOM();
                enhanceNativeDeviceNodesWithTelemetry(storageTopologyData.devices);
            }
        } catch (e) {
            console.error('[STORAGE-TOPOLOGY] Error loading topology:', e);
        } finally {
            isFetchingTopology = false;
        }
    }

    function openAddTopologyDeviceModal(preDivision = null, preLine = null) {
        let existingModal = document.getElementById('fuxa-add-topo-device-modal');
        if (existingModal) existingModal.remove();

        const plantId = (storageTopologyData && storageTopologyData.plant_id) ? storageTopologyData.plant_id : 9;
        const plantName = (storageTopologyData && storageTopologyData.plant_name) ? storageTopologyData.plant_name : `Plant ${plantId}`;
        const divisions = (storageTopologyData && storageTopologyData.divisions) ? storageTopologyData.divisions : TOPO_DIVISIONS;

        const defaultDiv = preDivision || (topoSelectedDivision !== 'all' ? topoSelectedDivision : '6');
        const defaultLine = preLine || (topoSelectedLine !== 'all' ? topoSelectedLine : '1');

        const modal = document.createElement('div');
        modal.id = 'fuxa-add-topo-device-modal';
        modal.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.78); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; font-family: system-ui, -apple-system, sans-serif;';

        modal.innerHTML = `
            <div style="background: #1e293b; border: 1.5px solid rgba(255,255,255,0.14); border-radius: 12px; width: 620px; max-width: 95vw; max-height: 90vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); color: #f8fafc; padding: 24px 28px;">
                <!-- Modal Header -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <div>
                        <div style="font-size: 1.15rem; font-weight: 700; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
                            <span>🔌</span> Add Device to Plant Topology
                        </div>
                        <div style="font-size: 0.82rem; color: #94a3b8; margin-top: 2px;">
                            Map field PLC or gateway to its plant division and line in Central Storage
                        </div>
                    </div>
                    <button id="topo-modal-close" style="background: transparent; border: none; font-size: 22px; color: #94a3b8; cursor: pointer; padding: 4px 8px; border-radius: 4px;">&times;</button>
                </div>

                <!-- Step 1: Topological Location -->
                <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 14px 16px; margin-bottom: 18px;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.8px; color: #38bdf8; display: block; margin-bottom: 10px;">
                        1. Plant Topology Placement
                    </span>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Plant</label>
                            <input readonly value="${plantName}" style="width: 100%; height: 34px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 5px; color: #94a3b8; padding: 0 10px; font-size: 0.85rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Division</label>
                            <select id="topo-input-division" style="width: 100%; height: 34px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 5px; color: #f8fafc; padding: 0 8px; font-size: 0.85rem; box-sizing: border-box; cursor: pointer;">
                                ${Object.entries(divisions).map(([k, name]) => `<option value="${k}" ${String(k) === String(defaultDiv) ? 'selected' : ''}>Div ${k}: ${name}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Production Line</label>
                            <select id="topo-input-line" style="width: 100%; height: 34px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 5px; color: #f8fafc; padding: 0 8px; font-size: 0.85rem; box-sizing: border-box; cursor: pointer;">
                                <option value="1" ${String(defaultLine) === '1' ? 'selected' : ''}>Line 1 (e.g. Line 1)</option>
                                <option value="2" ${String(defaultLine) === '2' ? 'selected' : ''}>Line 2 (e.g. Line 2)</option>
                                <option value="3" ${String(defaultLine) === '3' ? 'selected' : ''}>Line 3 (e.g. Line 3)</option>
                                <option value="4" ${String(defaultLine) === '4' ? 'selected' : ''}>Line 4 (e.g. Line 4)</option>
                                <option value="5" ${String(defaultLine) === '5' ? 'selected' : ''}>Line 5 (e.g. Line 5)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Topological Path Preview</label>
                            <div id="topo-path-preview" style="height: 34px; line-height: 34px; padding: 0 10px; font-family: monospace; font-size: 0.82rem; color: #34d399; background: rgba(52, 211, 153, 0.1); border: 1px dashed rgba(52, 211, 153, 0.3); border-radius: 5px; box-sizing: border-box; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                P${plantId} > Div ${defaultDiv} > Line ${defaultLine}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 2: Device & Protocol -->
                <div style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
                    <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.8px; color: #38bdf8; display: block; margin-bottom: 10px;">
                        2. Field Device & Protocol Settings
                    </span>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Device Name</label>
                            <input id="topo-input-devname" type="text" value="P${plantId}_D${defaultDiv}_L${defaultLine}_PLC" placeholder="e.g. Oven_Burner_PLC" style="width: 100%; height: 34px; background: #0f172a; border: 1px solid rgba(255,255,255,0.2); border-radius: 5px; color: #f8fafc; padding: 0 10px; font-size: 0.85rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 4px; font-weight: 500;">Acquisition Protocol</label>
                            <select id="topo-input-protocol" style="width: 100%; height: 34px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 5px; color: #f8fafc; padding: 0 8px; font-size: 0.85rem; box-sizing: border-box; cursor: pointer;">
                                <option value="SiemensS7">🔌 Siemens S7 (S7-300 / 400 / 1200 / 1500)</option>
                                <option value="Modbus">📟 Modbus TCP (Ethernet)</option>
                                <option value="OPCUA">⚡ OPC-UA Client (opc.tcp://)</option>
                                <option value="MQTT">📡 MQTT Client (Broker / Topic)</option>
                                <option value="EthernetIP">🖧 EtherNet/IP (Allen-Bradley / Omron)</option>
                                <option value="BACnet">🌐 BACnet IP</option>
                            </select>
                        </div>
                    </div>

                    <!-- Dynamic Protocol Parameters -->
                    <div id="topo-proto-fields" style="background: rgba(0,0,0,0.25); border-radius: 6px; padding: 12px; margin-top: 10px;">
                        <!-- Injected dynamically by JS -->
                    </div>
                </div>

                <!-- Footer Actions -->
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="topo-modal-cancel" type="button" style="padding: 9px 18px; font-size: 0.85rem; font-weight: 500; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: #cbd5e1; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                    <button id="topo-modal-submit" type="button" style="padding: 9px 24px; font-size: 0.85rem; font-weight: 600; border: none; background: linear-gradient(135deg, #10b981, #059669); color: #fff; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
                        Add Device to Plant Topology
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const divSelect = modal.querySelector('#topo-input-division');
        const lineSelect = modal.querySelector('#topo-input-line');
        const pathPreview = modal.querySelector('#topo-path-preview');
        const nameInput = modal.querySelector('#topo-input-devname');
        const protoSelect = modal.querySelector('#topo-input-protocol');
        const protoFields = modal.querySelector('#topo-proto-fields');

        function updatePathAndName() {
            const d = divSelect.value;
            const l = lineSelect.value;
            const divLabel = divisions[d] || `Div ${d}`;
            pathPreview.textContent = `P${plantId} > ${divLabel} > Line ${l}`;
            if (nameInput.dataset.manual !== 'true') {
                nameInput.value = `P${plantId}_D${d}_L${l}_PLC`;
            }
        }

        nameInput.addEventListener('input', () => {
            nameInput.dataset.manual = 'true';
        });

        divSelect.addEventListener('change', updatePathAndName);
        lineSelect.addEventListener('change', updatePathAndName);

        function renderProtocolFields() {
            const proto = protoSelect.value;
            if (proto === 'SiemensS7') {
                protoFields.innerHTML = `
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">PLC IP Address</label>
                            <input id="proto-s7-host" type="text" value="192.168.1.10" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Port</label>
                            <input id="proto-s7-port" type="number" value="102" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Rack</label>
                            <input id="proto-s7-rack" type="number" value="0" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Slot</label>
                            <input id="proto-s7-slot" type="number" value="2" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                    </div>
                `;
            } else if (proto === 'Modbus') {
                protoFields.innerHTML = `
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Modbus Slave IP</label>
                            <input id="proto-mb-host" type="text" value="192.168.1.20" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Port</label>
                            <input id="proto-mb-port" type="number" value="502" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Slave ID</label>
                            <input id="proto-mb-slave" type="number" value="1" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                    </div>
                `;
            } else if (proto === 'OPCUA') {
                protoFields.innerHTML = `
                    <div>
                        <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">OPC-UA Endpoint URL</label>
                        <input id="proto-opc-url" type="text" value="opc.tcp://127.0.0.1:4845/fuxa/server/" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                    </div>
                `;
            } else if (proto === 'MQTT') {
                protoFields.innerHTML = `
                    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Broker URL</label>
                            <input id="proto-mqtt-url" type="text" value="mqtt://127.0.0.1:1883" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Topic Prefix</label>
                            <input id="proto-mqtt-topic" type="text" value="tvs/plant9/#" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                    </div>
                `;
            } else if (proto === 'EthernetIP') {
                protoFields.innerHTML = `
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">PLC IP Address</label>
                            <input id="proto-eip-host" type="text" value="192.168.1.30" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Port</label>
                            <input id="proto-eip-port" type="number" value="44818" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Slot</label>
                            <input id="proto-eip-slot" type="number" value="0" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                    </div>
                `;
            } else {
                protoFields.innerHTML = `
                    <div style="display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 10px;">
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">BACnet IP Address</label>
                            <input id="proto-bac-host" type="text" value="192.168.1.40" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Port</label>
                            <input id="proto-bac-port" type="number" value="47808" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                        <div>
                            <label style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 2px;">Device ID</label>
                            <input id="proto-bac-id" type="number" value="1001" style="width: 100%; height: 30px; background: #0f172a; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: #fff; padding: 0 8px; font-size: 0.8rem; box-sizing: border-box;" />
                        </div>
                    </div>
                `;
            }
        }

        protoSelect.addEventListener('change', renderProtocolFields);
        renderProtocolFields();

        // Close handlers
        modal.querySelector('#topo-modal-close').onclick = () => modal.remove();
        modal.querySelector('#topo-modal-cancel').onclick = () => modal.remove();

        // Submit handler
        const submitBtn = modal.querySelector('#topo-modal-submit');
        submitBtn.onclick = async () => {
            const devName = (nameInput.value || '').trim();
            if (!devName) {
                alert('Please enter a valid Device Name');
                return;
            }

            const pType = protoSelect.value;
            const divVal = parseInt(divSelect.value, 10);
            const lineVal = parseInt(lineSelect.value, 10);

            let property = {};
            if (pType === 'SiemensS7') {
                property = {
                    address: modal.querySelector('#proto-s7-host')?.value || '192.168.1.10',
                    port: parseInt(modal.querySelector('#proto-s7-port')?.value || '102', 10),
                    rack: parseInt(modal.querySelector('#proto-s7-rack')?.value || '0', 10),
                    slot: parseInt(modal.querySelector('#proto-s7-slot')?.value || '2', 10)
                };
            } else if (pType === 'Modbus') {
                property = {
                    address: modal.querySelector('#proto-mb-host')?.value || '192.168.1.20',
                    port: parseInt(modal.querySelector('#proto-mb-port')?.value || '502', 10),
                    slaveid: parseInt(modal.querySelector('#proto-mb-slave')?.value || '1', 10)
                };
            } else if (pType === 'OPCUA') {
                property = {
                    address: modal.querySelector('#proto-opc-url')?.value || 'opc.tcp://127.0.0.1:4845',
                    options: { securityMode: 'None', securityPolicy: 'None' }
                };
            } else if (pType === 'MQTT') {
                property = {
                    url: modal.querySelector('#proto-mqtt-url')?.value || 'mqtt://127.0.0.1:1883',
                    topic: modal.querySelector('#proto-mqtt-topic')?.value || 'tvs/plant9/#'
                };
            } else if (pType === 'EthernetIP') {
                property = {
                    address: modal.querySelector('#proto-eip-host')?.value || '192.168.1.30',
                    port: parseInt(modal.querySelector('#proto-eip-port')?.value || '44818', 10),
                    slot: parseInt(modal.querySelector('#proto-eip-slot')?.value || '0', 10)
                };
            } else {
                property = {
                    address: modal.querySelector('#proto-bac-host')?.value || '192.168.1.40',
                    port: parseInt(modal.querySelector('#proto-bac-port')?.value || '47808', 10),
                    deviceid: parseInt(modal.querySelector('#proto-bac-id')?.value || '1001', 10)
                };
            }

            submitBtn.textContent = 'Adding to Topology...';
            submitBtn.style.opacity = '0.7';

            try {
                const payload = JSON.stringify({
                    name: devName,
                    type: pType,
                    property: property,
                    topology: {
                        plant: plantId,
                        division: divVal,
                        line: lineVal
                    },
                    enabled: true
                });

                let res = await fetch('api/storage/add-topology-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                }).catch(() => null);

                if (!res || !res.ok) {
                    res = await fetch('/api/storage/add-topology-device', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: payload
                    }).catch(() => null);
                }

                if (res && res.ok) {
                    modal.remove();
                    await fetchStorageTopology();
                } else {
                    const err = res ? await res.json().catch(() => ({})) : {};
                    alert('Failed to add device: ' + (err.error || 'Server error'));
                    submitBtn.textContent = 'Add Device to Plant Topology';
                    submitBtn.style.opacity = '1';
                }
            } catch (err) {
                alert('Error adding device: ' + err.message);
                submitBtn.textContent = 'Add Device to Plant Topology';
                submitBtn.style.opacity = '1';
            }
        };
    }

    async function removeTopologyDevice(deviceId, deviceName) {
        if (!confirm(`Are you sure you want to remove device "${deviceName}" from the Plant Topology?`)) return;
        try {
            const payload = JSON.stringify({ id: deviceId });
            let res = await fetch('api/storage/delete-topology-device', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload
            }).catch(() => null);

            if (!res || !res.ok) {
                res = await fetch('/api/storage/delete-topology-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                }).catch(() => null);
            }

            if (res && res.ok) {
                await fetchStorageTopology();
            } else {
                alert('Failed to delete device');
            }
        } catch (e) {
            alert('Error deleting device: ' + e.message);
        }
    }

    function updateStorageTopologyDOM() {
        const hub = document.getElementById('fuxa-storage-topological-hub');
        if (!hub || !storageTopologyData) return;

        const plantId = storageTopologyData.plant_id || 9;
        const plantName = storageTopologyData.plant_name || `Plant ${plantId}`;
        const divisions = storageTopologyData.divisions || TOPO_DIVISIONS;
        const rawDevices = storageTopologyData.devices || [];

        // Telemetry counters
        const totalDevs = rawDevices.length;
        let totalTags = 0;
        rawDevices.forEach(d => {
            totalTags += Object.keys(d.tags || {}).length;
        });

        // 1. Division Pills
        const divPillsContainer = hub.querySelector('#topo-div-pills');
        if (divPillsContainer) {
            let pillsHtml = `
                <button class="topo-pill ${topoSelectedDivision === 'all' ? 'active' : ''}" onclick="window.__setTopoDiv('all')">
                    All Divisions (${totalDevs})
                </button>
            `;
            Object.entries(divisions).forEach(([dId, dName]) => {
                const count = rawDevices.filter(d => {
                    const devDiv = d.topology ? String(d.topology.division) : '';
                    return devDiv === String(dId);
                }).length;
                pillsHtml += `
                    <button class="topo-pill ${topoSelectedDivision === String(dId) ? 'active' : ''}" onclick="window.__setTopoDiv('${dId}')">
                        ${dName} (${count})
                    </button>
                `;
            });
            divPillsContainer.innerHTML = pillsHtml;
        }

        // 2. Line Filter Pills
        const linePillsContainer = hub.querySelector('#topo-line-pills');
        if (linePillsContainer) {
            let linePillsHtml = `
                <button class="topo-pill ${topoSelectedLine === 'all' ? 'active' : ''}" onclick="window.__setTopoLine('all')">
                    All Lines
                </button>
            `;
            [1, 2, 3, 4, 5].forEach(lNum => {
                const count = rawDevices.filter(d => {
                    const devLine = d.topology ? String(d.topology.line) : '';
                    const matchDiv = (topoSelectedDivision === 'all') || (d.topology && String(d.topology.division) === String(topoSelectedDivision));
                    return matchDiv && devLine === String(lNum);
                }).length;
                linePillsHtml += `
                    <button class="topo-pill ${topoSelectedLine === String(lNum) ? 'active' : ''}" onclick="window.__setTopoLine('${lNum}')">
                        Line ${lNum} (${count})
                    </button>
                `;
            });
            linePillsContainer.innerHTML = linePillsHtml;
        }

        // 3. Filter devices
        let filteredDevices = rawDevices;
        if (topoSelectedDivision !== 'all') {
            filteredDevices = filteredDevices.filter(d => d.topology && String(d.topology.division) === String(topoSelectedDivision));
        }
        if (topoSelectedLine !== 'all') {
            filteredDevices = filteredDevices.filter(d => d.topology && String(d.topology.line) === String(topoSelectedLine));
        }
        if (topoSearchQuery) {
            const q = topoSearchQuery.toLowerCase();
            filteredDevices = filteredDevices.filter(d => 
                (d.name && d.name.toLowerCase().includes(q)) ||
                (d.type && d.type.toLowerCase().includes(q)) ||
                (d.property && (JSON.stringify(d.property).toLowerCase().includes(q)))
            );
        }

        // 4. Render Grouped Topological Tree / Hierarchy
        const treeContainer = hub.querySelector('#topo-cards-tree');
        if (!treeContainer) return;

        if (filteredDevices.length === 0) {
            treeContainer.innerHTML = `
                <div style="background: rgba(15, 23, 42, 0.4); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; padding: 32px 20px; text-align: center; color: #94a3b8; margin-top: 10px;">
                    <div style="font-size: 2rem; margin-bottom: 8px;">🔌</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 4px;">No field devices found in this topological branch</div>
                    <div style="font-size: 0.82rem; margin-bottom: 16px;">
                        ${topoSelectedDivision !== 'all' ? `Division ${divisions[topoSelectedDivision] || topoSelectedDivision} currently has no field devices assigned.` : 'Get started by adding your first field PLC, Modbus, or OPC-UA connection to the plant topology.'}
                    </div>
                    <button onclick="window.__openAddTopoDeviceModal()" style="padding: 8px 18px; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 6px; font-size: 0.82rem; font-weight: 600; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                        + Add Device to This Node
                    </button>
                </div>
            `;
            return;
        }

        // Group devices by division and line
        const grouped = {};
        filteredDevices.forEach(d => {
            const divId = (d.topology && d.topology.division) ? String(d.topology.division) : '6';
            const lineId = (d.topology && d.topology.line) ? String(d.topology.line) : '1';
            grouped[divId] = grouped[divId] || {};
            grouped[divId][lineId] = grouped[divId][lineId] || [];
            grouped[divId][lineId].push(d);
        });

        let treeHtml = '';
        Object.entries(grouped).forEach(([dId, linesMap]) => {
            const divTitle = divisions[dId] || `Division ${dId}`;
            treeHtml += `
                <div style="margin-bottom: 22px; background: rgba(15, 23, 42, 0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 16px 18px;">
                    <!-- Division Header -->
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.08);">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 1.1rem;">📁</span>
                            <span style="font-size: 0.95rem; font-weight: 700; color: #38bdf8;">Division ${dId}: ${divTitle}</span>
                        </div>
                        <span style="font-size: 0.72rem; color: #94a3b8; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; font-family: monospace;">
                            Plant ${plantId} &bull; ${Object.values(linesMap).reduce((acc, cur) => acc + cur.length, 0)} Devices
                        </span>
                    </div>
            `;

            Object.entries(linesMap).forEach(([lId, devList]) => {
                treeHtml += `
                    <div style="margin-bottom: 14px; padding-left: 14px; border-left: 2px solid rgba(56, 189, 248, 0.4);">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                            <span style="font-size: 0.85rem; font-weight: 600; color: #6ee7b7; display: flex; align-items: center; gap: 6px;">
                                <span>🔹</span> Line ${lId}
                            </span>
                            <button onclick="window.__openAddTopoDeviceModal('${dId}', '${lId}')" style="background: transparent; border: 1px solid rgba(52, 211, 153, 0.3); color: #34d399; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(52, 211, 153, 0.15)'" onmouseout="this.style.background='transparent'">
                                + Add Device to Line ${lId}
                            </button>
                        </div>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 12px;">
                `;

                devList.forEach(dev => {
                    const tagCount = Object.keys(dev.tags || {}).length;
                    const endpoint = dev.property ? (dev.property.address || dev.property.url || (dev.property.ip ? `${dev.property.ip}:${dev.property.port || ''}` : 'Configured')) : 'Standard';
                    
                    let protoBadge = `<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">${dev.type}</span>`;
                    if (dev.type === 'OPCUA') protoBadge = `<span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">⚡ OPC-UA</span>`;
                    else if (dev.type === 'SiemensS7') protoBadge = `<span style="background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">🔌 Siemens S7</span>`;
                    else if (dev.type === 'Modbus') protoBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">📟 Modbus TCP</span>`;
                    else if (dev.type === 'MQTT') protoBadge = `<span style="background: rgba(236, 72, 153, 0.15); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">📡 MQTT</span>`;

                    const telem = dev.telemetry || {};
                    const isConn = !!telem.connected;
                    const lastConnFormatted = telem.lastConnectedFormatted || (telem.lastConnected ? new Date(telem.lastConnected).toLocaleString() : 'Never connected');
                    const reconnects = typeof telem.reconnectCount === 'number' ? telem.reconnectCount : 0;
                    const dotColor = isConn ? '#10b981' : (telem.lastConnected ? '#f59e0b' : '#ef4444');

                    treeHtml += `
                        <div data-dev-id="${dev.id}" class="topo-dev-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid ${isConn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.1)'}; border-radius: 8px; padding: 12px 14px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); transition: transform 0.2s, border-color 0.2s;" onmouseover="this.style.borderColor='rgba(56, 189, 248, 0.5)'" onmouseout="this.style.borderColor='${isConn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.1)'}'">
                            <div>
                                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                                    <div style="font-weight: 700; font-size: 0.88rem; color: #f1f5f9; display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis;">
                                        <span class="topo-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; box-shadow: 0 0 8px ${dotColor};"></span>
                                        <span title="${dev.name}">${dev.name}</span>
                                    </div>
                                    ${protoBadge}
                                </div>
                                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; font-family: monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${endpoint}">
                                    📍 ${endpoint}
                                </div>
                                <div style="font-size: 0.72rem; color: #64748b; margin-bottom: 8px;">
                                    🏷️ Node: Plant ${plantId} &bull; Div ${dId} &bull; Line ${lId}
                                </div>

                                <!-- Connection Telemetry (Last Connected with Date & Reconnections after restart) -->
                                <div style="background: rgba(15, 23, 42, 0.65); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 0.73rem; line-height: 1.5;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                        <span style="color: #94a3b8; display: flex; align-items: center; gap: 4px;">
                                            <span>🕒</span> Last Connected:
                                        </span>
                                        <span class="topo-last-conn" style="color: ${isConn ? '#4ade80' : (telem.lastConnected ? '#fde047' : '#94a3b8')}; font-family: monospace; font-weight: 600;" title="Last connected timestamp with date">
                                            ${lastConnFormatted}
                                        </span>
                                    </div>
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <span style="color: #94a3b8; display: flex; align-items: center; gap: 4px;">
                                            <span>🔄</span> Reconnections (since restart):
                                        </span>
                                        <span class="topo-reconnects" style="background: ${reconnects > 0 ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255,255,255,0.06)'}; color: ${reconnects > 0 ? '#facc15' : '#cbd5e1'}; border: 1px solid ${reconnects > 0 ? 'rgba(234, 179, 8, 0.35)' : 'rgba(255,255,255,0.1)'}; padding: 1px 7px; border-radius: 10px; font-family: monospace; font-weight: 700;" title="No. of reconnections after the last server restart">
                                            ${reconnects}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
                                <span class="topo-tag-count" style="font-size: 0.72rem; color: #34d399; font-weight: 600;">
                                    ${tagCount > 0 ? `✓ ${tagCount} Tags Active` : 'Ready to map tags'}
                                </span>
                                <button onclick="window.__removeTopoDev('${dev.id}', '${dev.name}')" style="background: transparent; border: none; color: #ef4444; font-size: 0.75rem; cursor: pointer; padding: 2px 6px; border-radius: 4px; opacity: 0.75; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.75'" title="Remove device from Plant Topology">
                                    🗑️ Remove
                                </button>
                            </div>
                        </div>
                    `;
                });

                treeHtml += `
                        </div>
                    </div>
                `;
            });

            treeHtml += `
                </div>
            `;
        });

        // In-place DOM update check to eliminate flickering
        const existingCards = Array.from(treeContainer.querySelectorAll('.topo-dev-card[data-dev-id]'));
        const existingCardIds = existingCards.map(el => el.getAttribute('data-dev-id'));
        const newCardIds = filteredDevices.map(d => String(d.id));
        const idsMatch = existingCardIds.length === newCardIds.length && existingCardIds.every((id, idx) => id === newCardIds[idx]);

        if (idsMatch && existingCards.length > 0) {
            filteredDevices.forEach(dev => {
                const card = treeContainer.querySelector(`.topo-dev-card[data-dev-id="${dev.id}"]`);
                if (!card) return;
                const telem = dev.telemetry || {};
                const isConn = !!telem.connected;
                const lastConnFormatted = telem.lastConnectedFormatted || (telem.lastConnected ? new Date(telem.lastConnected).toLocaleString() : 'Never connected');
                const reconnects = typeof telem.reconnectCount === 'number' ? telem.reconnectCount : 0;
                const dotColor = isConn ? '#10b981' : (telem.lastConnected ? '#f59e0b' : '#ef4444');
                const tagCount = Object.keys(dev.tags || {}).length;

                card.style.borderColor = isConn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(255,255,255,0.1)';
                const dot = card.querySelector('.topo-dot');
                if (dot) {
                    dot.style.background = dotColor;
                    dot.style.boxShadow = `0 0 8px ${dotColor}`;
                }
                const lastConnEl = card.querySelector('.topo-last-conn');
                if (lastConnEl) {
                    lastConnEl.textContent = lastConnFormatted;
                    lastConnEl.style.color = isConn ? '#4ade80' : (telem.lastConnected ? '#fde047' : '#94a3b8');
                }
                const reconnEl = card.querySelector('.topo-reconnects');
                if (reconnEl) {
                    reconnEl.textContent = reconnects;
                    reconnEl.style.background = reconnects > 0 ? 'rgba(234, 179, 8, 0.18)' : 'rgba(255,255,255,0.06)';
                    reconnEl.style.color = reconnects > 0 ? '#facc15' : '#cbd5e1';
                }
                const tagCountEl = card.querySelector('.topo-tag-count');
                if (tagCountEl) {
                    tagCountEl.textContent = tagCount > 0 ? `✓ ${tagCount} Tags Active` : 'Ready to map tags';
                }
            });
            return;
        }

        treeContainer.innerHTML = treeHtml;
    }

    // Expose global bridge functions for onclick handlers
    window.__setTopoDiv = (divId) => {
        topoSelectedDivision = divId;
        updateStorageTopologyDOM();
    };

    window.__setTopoLine = (lineId) => {
        topoSelectedLine = lineId;
        updateStorageTopologyDOM();
    };

    window.__openAddTopoDeviceModal = (divId, lineId) => {
        openAddTopologyDeviceModal(divId, lineId);
    };

    window.__removeTopoDev = (id, name) => {
        removeTopologyDevice(id, name);
    };

    function renderStorageServerTopologicalView() {
        if (!window.location.pathname.includes('/device')) return;
        const workPanel = document.querySelector('app-device .work-panel, app-device');
        if (!workPanel) return;

        if (document.getElementById('fuxa-storage-topological-hub')) {
            return;
        }

        // Remove legacy simple banner if present
        const oldBanner = document.getElementById('fuxa-storage-master-banner');
        if (oldBanner) oldBanner.remove();

        const hub = document.createElement('div');
        hub.id = 'fuxa-storage-topological-hub';
        hub.style.cssText = 'background: #0f172a; border: 1.5px solid rgba(56, 189, 248, 0.35); border-radius: 12px; padding: 20px 24px; margin: 40px 20px 20px 20px; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.4); color: #f8fafc;';

        hub.innerHTML = `
            <!-- Top Hero Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div>
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #10b981; box-shadow: 0 0 10px #10b981;"></span>
                        <span style="font-size: 1.15rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
                            Central Storage Master &bull; Plant Topological Acquisition Hub
                        </span>
                    </div>
                    <div style="font-size: 0.85rem; color: #94a3b8; max-width: 800px; line-height: 1.45;">
                        Full field device acquisition mode active. Add Siemens S7, Modbus TCP, OPC-UA, MQTT, EtherNet/IP, or BACnet field devices organized into the plant topology (Plant &rarr; Division &rarr; Line). Ingested tags automatically log history into InfluxDB and sync to all matching HMI View Servers.
                    </div>
                </div>
                <button id="btn-open-topo-add-modal" style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; font-size: 0.86rem; font-weight: 700; background: linear-gradient(135deg, #10b981, #059669); color: white; border: none; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 6px 18px rgba(16, 185, 129, 0.5)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 14px rgba(16, 185, 129, 0.4)'">
                    <span style="font-size: 16px; font-weight: bold;">+</span> Add Device to Topology
                </button>
            </div>

            <!-- Topological Filters Bar -->
            <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 12px 16px; margin-bottom: 18px;">
                <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #38bdf8;">Divisions:</span>
                        <div id="topo-div-pills" style="display: flex; flex-wrap: wrap; gap: 6px;">
                            <!-- Injected by JS -->
                        </div>
                    </div>
                    <div>
                        <input id="topo-search-input" type="text" placeholder="Filter devices by name, IP, protocol..." style="width: 240px; height: 30px; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.15); border-radius: 5px; color: #f8fafc; padding: 0 10px; font-size: 0.8rem; outline: none;" />
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.06);">
                    <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #6ee7b7;">Lines:</span>
                    <div id="topo-line-pills" style="display: flex; flex-wrap: wrap; gap: 6px;">
                        <!-- Injected by JS -->
                    </div>
                </div>
            </div>

            <!-- Topological Cards Tree / Hierarchy -->
            <div id="topo-cards-tree">
                <div style="text-align: center; padding: 24px; color: #94a3b8; font-size: 0.85rem;">
                    Loading Plant Topology Infrastructure...
                </div>
            </div>
        `;

        // Inject scoped styles for pills
        if (!document.getElementById('fuxa-topo-scoped-styles')) {
            const style = document.createElement('style');
            style.id = 'fuxa-topo-scoped-styles';
            style.textContent = `
                .topo-pill {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    color: #cbd5e1;
                    padding: 3px 10px;
                    border-radius: 5px;
                    font-size: 0.75rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .topo-pill:hover {
                    background: rgba(56, 189, 248, 0.15);
                    border-color: rgba(56, 189, 248, 0.35);
                    color: #f1f5f9;
                }
                .topo-pill.active {
                    background: #0284c7;
                    border-color: #38bdf8;
                    color: #ffffff;
                    font-weight: 600;
                    box-shadow: 0 2px 6px rgba(2, 132, 199, 0.4);
                }
            `;
            document.head.appendChild(style);
        }

        workPanel.prepend(hub);

        // Hook Add Button
        hub.querySelector('#btn-open-topo-add-modal').onclick = () => {
            openAddTopologyDeviceModal();
        };

        // Hook Search Input
        const searchInput = hub.querySelector('#topo-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                topoSearchQuery = e.target.value.trim();
                updateStorageTopologyDOM();
            });
        }

        // Fetch fresh topology from storage server backend
        fetchStorageTopology();
        if (!window.__topoPollTimer) {
            window.__topoPollTimer = setInterval(() => {
                if (window.location.pathname.includes('/device') && isStorageServer()) {
                    fetchStorageTopology();
                }
            }, 3000);
        }
    }

    function enforceViewServerRestrictions() {
        if (isStorageServer()) {
            renderStorageServerTopologicalView();
            return;
        }
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
                // Hook floating plus button and ensure it opens the Central Storage device modal
                const addBtns = document.querySelectorAll('.fab-add, button.fab-add, mat-fab.fab-add');
                for (let i = 0; i < addBtns.length; i++) {
                    const btn = addBtns[i];
                    btn.style.setProperty('display', 'flex', 'important');
                    btn.style.setProperty('background-color', '#183883', 'important');
                    btn.style.setProperty('color', '#ffffff', 'important');
                    btn.setAttribute('mattooltip', 'Add Device from Central Storage & InfluxDB');
                    btn.title = 'Add Device from Central Storage & InfluxDB';
                    if (!btn.dataset.storageAddHooked) {
                        btn.dataset.storageAddHooked = 'true';
                        btn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            openAddStorageDeviceModal();
                        }, true);
                    }
                }

                // Also hook list table add button in list mode
                const listAddBtns = document.querySelectorAll('.table-wrapper button.remove mat-icon, mat-table button mat-icon');
                for (let i = 0; i < listAddBtns.length; i++) {
                    if (listAddBtns[i].textContent.trim() === 'add') {
                        const pBtn = listAddBtns[i].closest('button');
                        if (pBtn && !pBtn.dataset.storageAddHooked) {
                            pBtn.dataset.storageAddHooked = 'true';
                            pBtn.title = 'Add Device from Central Storage & InfluxDB';
                            pBtn.addEventListener('click', function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.stopImmediatePropagation();
                                openAddStorageDeviceModal();
                            }, true);
                        }
                    }
                }

                const notices = document.querySelectorAll('.device-plugins-notice, .plugins-notice');
                for (let i = 0; i < notices.length; i++) {
                    if (notices[i].style.display !== 'none') {
                        notices[i].style.setProperty('display', 'none', 'important');
                    }
                }

                // Destroy any SectionMessageDialogComponent popup ("Connection Drivers via Plugins")
                const pluginDialogs = document.querySelectorAll('app-section-message-dialog');
                for (let i = 0; i < pluginDialogs.length; i++) {
                    const pane = pluginDialogs[i].closest('.cdk-overlay-pane') || pluginDialogs[i];
                    pane.remove();
                    const backdrop = document.querySelector('.cdk-overlay-backdrop');
                    if (backdrop && !document.querySelector('app-app-settings, app-setup, app-layout-property')) {
                        backdrop.remove();
                    }
                }

                const workPanel = document.querySelector('app-device .work-panel, app-device');
                let banner = document.getElementById('fuxa-statutory-device-banner');
                if (workPanel && !banner) {
                    banner = document.createElement('div');
                    banner.id = 'fuxa-statutory-device-banner';
                    banner.style.cssText = 'background: #1e293b; border: 1.5px solid #eab308; border-left: 6px solid #eab308; border-radius: 6px; padding: 14px 20px; margin: 44px 20px 14px 20px; display: flex; align-items: flex-start; gap: 14px; color: #f1f5f9; font-size: 13.5px; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,0.3); z-index: 100;';
                    const host = window.location.hostname || 'localhost';
                    banner.innerHTML = `
                        <span style="font-size: 24px; line-height: 1; margin-top: 2px;">⚠️</span>
                        <div style="flex: 1; line-height: 1.55;">
                            <strong style="color: #facc15; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; display: block; margin-bottom: 4px;">Statutory Restriction: Read-Only Mapped View</strong>
                            <div style="color: #cbd5e1; font-size: 13px; line-height: 1.55;">
                                ${STATUTORY_WARNING_TEXT}
                            </div>
                            <div style="margin-top: 12px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                                <button id="fuxa-btn-add-storage-device" 
                                        style="display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; background: #183883; border: 1px solid #3b82f6; color: #ffffff; border-radius: 4px; font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transition: all 0.2s;">
                                    <span style="font-size: 16px; font-weight: 900; line-height: 1;">+</span> Add Device from Central Storage (InfluxDB)
                                </button>
                                <a href="http://${host}:9000" target="_blank" rel="noopener noreferrer" 
                                   style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; background: #334155; border: 1px solid #64748b; color: #f8fafc; border-radius: 4px; font-size: 12.5px; font-weight: 600; text-decoration: none;">
                                    Open Central Storage Fleet Manager (:9000) ↗
                                </a>
                            </div>
                        </div>
                    `;
                    workPanel.prepend(banner);
                } else if (banner) {
                    banner.style.cssText = 'background: #1e293b; border: 1.5px solid #eab308; border-left: 6px solid #eab308; border-radius: 6px; padding: 14px 20px; margin: 44px 20px 14px 20px; display: flex; align-items: flex-start; gap: 14px; color: #f1f5f9; font-size: 13.5px; font-family: system-ui, -apple-system, sans-serif; box-shadow: 0 4px 14px rgba(0,0,0,0.3); z-index: 100;';
                }

                const btnAddStorage = document.getElementById('fuxa-btn-add-storage-device');
                if (btnAddStorage && !btnAddStorage.dataset.attached) {
                    btnAddStorage.dataset.attached = 'true';
                    btnAddStorage.addEventListener('click', function(e) {
                        e.preventDefault();
                        openAddStorageDeviceModal();
                    });
                }
            }

            // 3. If URL ends with /plugins on View Servers, redirect to /editor
            if (!isStorageServer() && window.location.pathname.includes('/plugins')) {
                window.location.href = getBasePath() + '/editor';
                setTimeout(showStatutoryWarningModal, 400);
            }
        } finally {
            isMutating = false;
        }
    }

    function injectAppSettingsCard() {
        // 1. Immediately remove any stray custom URL / project name fields from View Properties
        const strayInViewProp = document.querySelectorAll('app-view-property .custom-url-setting-field');
        for (let i = 0; i < strayInViewProp.length; i++) {
            strayInViewProp[i].remove();
        }

        // 2. Target STRICTLY the App Settings dialog (app-app-settings)
        const dialog = document.querySelector('app-app-settings');
        if (!dialog) return;

        // 3. Find and lock the "Server is listening on port" input in Settings so users cannot edit it
        const allInputs = dialog.querySelectorAll('.tab-system .my-form-field input, .system-input input, input[numberonly]');
        let portInput = null;
        for (let i = 0; i < allInputs.length; i++) {
            const input = allInputs[i];
            const parentField = input.closest('.my-form-field');
            if ((parentField && parentField.textContent.toLowerCase().includes('port')) || input.hasAttribute('numberonly')) {
                portInput = input;
                portInput.disabled = true;
                portInput.readOnly = true;
                portInput.style.setProperty('opacity', '0.7', 'important');
                portInput.style.setProperty('cursor', 'not-allowed', 'important');
                portInput.style.setProperty('background-color', 'rgba(255, 255, 255, 0.04)', 'important');
                portInput.setAttribute('title', 'Server port is fixed and managed by FUXA Fleet Manager');
                break;
            }
        }

        // 4. Do not duplicate if already injected into Settings
        if (dialog.querySelector('.custom-url-setting-field')) return;
        if (!portInput) return;
        const portContainer = portInput.closest('.my-form-field') || portInput.parentElement;
        if (!portContainer) return;

        const customDiv = document.createElement('div');
        customDiv.className = 'custom-url-setting-field system-input';
        customDiv.style.cssText = 'width: 320px; box-sizing: border-box; display: block; clear: both; margin-top: 15px;';
        
        const currentSubpath = getBasePath();
        const rawProjectName = (liveProjectName || '').trim();
        // Prevent showing a raw port number like "9621" as the project name
        const isPortNumber = /^\d{4,5}$/.test(rawProjectName);
        const currentProjectName = (rawProjectName && !isPortNumber) ? rawProjectName : 'EMS';

        const hostUrl = getHostUrl();
        const viewName = getCurrentViewName();
        const fullViewUrl = viewName ? `${hostUrl}${currentSubpath}/home/${viewName}` : `${hostUrl}${currentSubpath}/home`;
        const fullEditorUrl = `${hostUrl}${currentSubpath}/editor`;

        customDiv.innerHTML = `
            <!-- Project Name Setting -->
            <div class="my-form-field block mt15 system-input" style="width: 320px; box-sizing: border-box;">
                <span style="display: block; margin-bottom: 4px; font-weight: 500;">Project Name</span>
                <div style="display: flex; gap: 8px; align-items: center; width: 320px; box-sizing: border-box;">
                    <input id="fuxa-project-name-input" type="text" value="${currentProjectName}" placeholder="e.g. Plant 9 Paintshop" 
                           style="flex: 1 1 auto; min-width: 0; width: 100%; height: 32px; padding: 4px 10px; font-size: 13px; font-family: inherit; border: none; border-radius: 4px; background-color: var(--formInputBackground, rgba(255,255,255,0.06)); color: var(--formInputColor, inherit); box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important; cursor: text !important;" />
                    <button id="fuxa-project-name-save-btn" type="button" 
                            style="flex-shrink: 0; white-space: nowrap; height: 32px; padding: 0 16px; font-size: 12px; font-weight: 600; border: none; border-radius: 4px; background: #3f51b5; color: #fff; cursor: pointer; transition: background 0.2s;">
                        Apply
                    </button>
                </div>
            </div>

            <!-- Custom URL / Subpath Setting -->
            <div class="my-form-field block mt15 system-input" style="width: 320px; box-sizing: border-box;">
                <span style="display: block; margin-bottom: 4px; font-weight: 500;">Custom URL / Subpath</span>
                <div style="display: flex; gap: 8px; align-items: center; width: 320px; box-sizing: border-box;">
                    <input id="fuxa-subpath-input" type="text" value="${currentSubpath}" placeholder="/p9/ps/ems" 
                           style="flex: 1 1 auto; min-width: 0; width: 100%; height: 32px; padding: 4px 10px; font-size: 12.5px; font-family: monospace; border: none; border-radius: 4px; background-color: var(--formInputBackground, rgba(255,255,255,0.06)); color: var(--formInputColor, inherit); box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important; cursor: text !important;" />
                    <button id="fuxa-subpath-save-btn" type="button" 
                            style="flex-shrink: 0; white-space: nowrap; height: 32px; padding: 0 16px; font-size: 12px; font-weight: 600; border: none; border-radius: 4px; background: #3f51b5; color: #fff; cursor: pointer; transition: background 0.2s;">
                        Apply
                    </button>
                </div>
            </div>

            <!-- Operator View URL -->
            <div class="my-form-field block mt15 system-input" style="width: 320px; box-sizing: border-box;">
                <span style="display: block; margin-bottom: 4px; font-weight: 500;">Operator View URL (Port 80)</span>
                <div style="display: flex; gap: 6px; align-items: center; width: 320px; box-sizing: border-box;">
                    <input id="fuxa-view-url-text" readonly type="text" value="${fullViewUrl}" 
                           style="flex: 1 1 auto; min-width: 0; width: 100%; height: 30px; padding: 2px 8px; font-size: 11px; font-family: monospace; border: none; border-radius: 4px; background-color: var(--formInputBackground, rgba(255,255,255,0.04)); color: var(--formInputColor, inherit); opacity: 0.85; box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important;" />
                    <button id="fuxa-btn-copy-view" type="button" 
                            style="flex-shrink: 0; white-space: nowrap; height: 30px; padding: 0 12px; font-size: 11px; font-weight: 500; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; background: transparent; color: inherit; cursor: pointer;">
                        Copy
                    </button>
                    <a id="fuxa-link-open-view" href="${fullViewUrl}" target="_blank" 
                        style="flex-shrink: 0; white-space: nowrap; height: 30px; padding: 0 12px; font-size: 11px; font-weight: 500; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; background: transparent; color: inherit; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; box-sizing: border-box;">
                        Open ↗
                    </a>
                </div>
            </div>

            <!-- Editor Clean URL -->
            <div class="my-form-field block mt10 system-input" style="width: 320px; box-sizing: border-box;">
                <span style="display: block; margin-bottom: 4px; font-weight: 500;">Editor Clean URL (Port 80)</span>
                <div style="display: flex; gap: 6px; align-items: center; width: 320px; box-sizing: border-box;">
                    <input id="fuxa-editor-url-text" readonly type="text" value="${fullEditorUrl}" 
                           style="flex: 1 1 auto; min-width: 0; width: 100%; height: 30px; padding: 2px 8px; font-size: 11px; font-family: monospace; border: none; border-radius: 4px; background-color: var(--formInputBackground, rgba(255,255,255,0.04)); color: var(--formInputColor, inherit); opacity: 0.85; box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important;" />
                    <button id="fuxa-btn-copy-editor" type="button" 
                            style="flex-shrink: 0; white-space: nowrap; height: 30px; padding: 0 12px; font-size: 11px; font-weight: 500; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; background: transparent; color: inherit; cursor: pointer;">
                        Copy
                    </button>
                </div>
            </div>
        `;

        portContainer.parentNode.insertBefore(customDiv, portContainer.nextSibling);

        // Attach event listeners
        const saveBtn = customDiv.querySelector('#fuxa-subpath-save-btn');
        const nameSaveBtn = customDiv.querySelector('#fuxa-project-name-save-btn');
        const input = customDiv.querySelector('#fuxa-subpath-input');
        const nameInput = customDiv.querySelector('#fuxa-project-name-input');
        const viewInput = customDiv.querySelector('#fuxa-view-url-text');
        const editorInput = customDiv.querySelector('#fuxa-editor-url-text');
        const openLink = customDiv.querySelector('#fuxa-link-open-view');
        const copyViewBtn = customDiv.querySelector('#fuxa-btn-copy-view');
        const copyEditorBtn = customDiv.querySelector('#fuxa-btn-copy-editor');

        // Dynamically fetch actual live project name from backend
        try {
            fetch('api/project-name').then(r => r.ok ? r.json() : null).then(data => {
                if (data && data.name && nameInput) {
                    nameInput.value = data.name;
                    liveProjectName = data.name;
                    updateHeaderBadge(data.name);
                }
            }).catch(() => {});
        } catch (e) {}

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

        async function doSaveProjectName() {
            const updatedName = nameInput ? nameInput.value.trim() : '';
            if (!updatedName) return;
            if (nameSaveBtn) {
                nameSaveBtn.textContent = 'Applying...';
                nameSaveBtn.style.background = '#0284c7';
            }
            await saveProjectName(updatedName);
            document.title = `${updatedName} - TVS SCADA`;
            ensureTvsHeaderLogo();
            if (nameSaveBtn) {
                nameSaveBtn.textContent = 'Active! ✓';
                nameSaveBtn.style.background = '#2e7d32';
                nameSaveBtn.style.borderColor = '#2e7d32';
                setTimeout(() => {
                    nameSaveBtn.textContent = 'Apply';
                    nameSaveBtn.style.background = '#3f51b5';
                    nameSaveBtn.style.borderColor = 'none';
                }, 2000);
            }
        }

        if (nameSaveBtn) {
            nameSaveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                doSaveProjectName();
            });
        }

        if (nameInput) {
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    doSaveProjectName();
                }
            });
        }

        async function doSaveSettings() {
            const val = input.value.trim();
            const updatedName = nameInput ? nameInput.value.trim() : '';

            if (updatedName) {
                await doSaveProjectName();
            }

            if (val) {
                const clean = setBasePath(val);
                saveBtn.textContent = 'Applying...';
                
                const detectedPort = parseInt(portInput.value, 10) || getTargetPort();
                localStorage.setItem('fuxa_target_port', detectedPort);
                
                await syncSubpathToGateway(clean, detectedPort, updatedName);
                
                const updatedViewUrl = viewName ? `${hostUrl}${clean}/home?viewName=${encodeURIComponent(viewName)}` : `${hostUrl}${clean}/home`;
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

        const dialogOkBtn = dialog.querySelector('.dialog-action button[color="primary"], .dialog-action button.mat-primary, mat-dialog-actions button:last-child, button[cdkfocusinitial], .dialog-action button:last-child');
        if (dialogOkBtn) {
            dialogOkBtn.addEventListener('click', () => {
                doSaveSettings();
            });
        }

        function copyText(inputElem, text) {
            let copied = false;
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).catch(() => {});
            }
            if (inputElem) {
                try {
                    inputElem.focus();
                    inputElem.select();
                    inputElem.setSelectionRange(0, 99999);
                    copied = document.execCommand('copy');
                } catch (e) {}
            }
            if (!copied) {
                try {
                    const textArea = document.createElement("textarea");
                    textArea.value = text;
                    textArea.style.position = "fixed";
                    textArea.style.opacity = "0";
                    // Append inside dialog container so Angular FocusTrap does not reject it
                    (dialog || document.body).appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    copied = document.execCommand('copy');
                    textArea.remove();
                } catch (e) {}
            }
            return copied;
        }

        copyViewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyText(viewInput, viewInput.value);
            copyViewBtn.textContent = 'Copied! ✓';
            copyViewBtn.style.borderColor = '#2e7d32';
            copyViewBtn.style.color = '#4ade80';
            setTimeout(() => {
                copyViewBtn.textContent = 'Copy';
                copyViewBtn.style.borderColor = 'rgba(128, 128, 128, 0.4)';
                copyViewBtn.style.color = 'inherit';
            }, 2000);
        });

        copyEditorBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            copyText(editorInput, editorInput.value);
            copyEditorBtn.textContent = 'Copied! ✓';
            copyEditorBtn.style.borderColor = '#2e7d32';
            copyEditorBtn.style.color = '#4ade80';
            setTimeout(() => {
                copyEditorBtn.textContent = 'Copy';
                copyEditorBtn.style.borderColor = 'rgba(128, 128, 128, 0.4)';
                copyEditorBtn.style.color = 'inherit';
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

    function enforceViewPropertyLayout() {
        const viewProp = document.querySelector('app-view-property');
        if (!viewProp) return;

        // Restore View Properties dialog & overlay to normal 760px width
        const overlayPane = viewProp.closest('.cdk-overlay-pane');
        if (overlayPane) {
            overlayPane.style.setProperty('width', '760px', 'important');
            overlayPane.style.setProperty('max-width', '95vw', 'important');
        }
        const matDialogContainer = viewProp.closest('.mat-mdc-dialog-container, mat-dialog-container');
        if (matDialogContainer) {
            matDialogContainer.style.setProperty('width', '760px', 'important');
            matDialogContainer.style.setProperty('max-width', '95vw', 'important');
        }

        viewProp.style.setProperty('display', 'block', 'important');
        viewProp.style.setProperty('width', '760px', 'important');
        viewProp.style.setProperty('max-width', '95vw', 'important');
        viewProp.style.setProperty('box-sizing', 'border-box', 'important');

        const container = viewProp.querySelector('.container, form.container');
        if (container) {
            container.style.setProperty('width', '760px', 'important');
            container.style.setProperty('max-width', '100%', 'important');
            container.style.setProperty('box-sizing', 'border-box', 'important');
        }

        const propContainers = viewProp.querySelectorAll('.property-container, .mat-tab-container');
        propContainers.forEach(el => {
            el.style.setProperty('width', '100%', 'important');
            el.style.setProperty('max-width', '100%', 'important');
            el.style.setProperty('box-sizing', 'border-box', 'important');
        });

        injectSpecificViewUrl(viewProp);
    }

    function injectSpecificViewUrl(viewProp) {
        if (!viewProp || viewProp.querySelector('.fuxa-view-url-field')) return;

        const nameField = viewProp.querySelector('.property-container .my-form-field.block');
        if (!nameField) return;

        const nameInput = nameField.querySelector('input');
        const viewName = (nameInput && nameInput.value.trim()) || getCurrentViewName() || 'MainView';

        const hostUrl = getHostUrl();
        const currentSubpath = getBasePath();
        const fullViewUrl = viewName ? `${hostUrl}${currentSubpath}/home?viewName=${encodeURIComponent(viewName)}` : `${hostUrl}${currentSubpath}/home`;

        const urlDiv = document.createElement('div');
        urlDiv.className = 'my-form-field block mt10 fuxa-view-url-field';
        urlDiv.style.cssText = 'width: 100%; box-sizing: border-box; display: block; margin-top: 10px; margin-bottom: 10px;';

        urlDiv.innerHTML = `
            <span style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">View URL (OT Compliant)</span>
            <div style="display: flex; gap: 8px; align-items: center; width: 100%; box-sizing: border-box;">
                <input id="fuxa-specific-view-url-text" readonly type="text" value="${fullViewUrl}" 
                       style="flex: 1 1 auto; min-width: 0; width: 100%; height: 32px; padding: 4px 10px; font-size: 12px; font-family: monospace; border: 1px solid rgba(128,128,128,0.3); border-radius: 4px; background-color: var(--formInputBackground, rgba(255,255,255,0.06)); color: var(--formInputColor, inherit); opacity: 0.9; box-sizing: border-box; outline: none; user-select: text !important; -webkit-user-select: text !important; cursor: text !important;" />
                <button id="fuxa-btn-copy-specific-view" type="button" 
                        style="flex-shrink: 0; white-space: nowrap; height: 32px; padding: 0 14px; font-size: 12px; font-weight: 600; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #ffffff; cursor: pointer; transition: background 0.2s;">
                    Copy URL
                </button>
                <a id="fuxa-link-open-specific-view" href="${fullViewUrl}" target="_blank" 
                   style="flex-shrink: 0; white-space: nowrap; height: 32px; padding: 0 14px; font-size: 12px; font-weight: 600; border: 1px solid rgba(128, 128, 128, 0.4); border-radius: 4px; background: rgba(255, 255, 255, 0.08); color: #ffffff; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; box-sizing: border-box;">
                    Open ↗
                </a>
            </div>
        `;

        nameField.parentNode.insertBefore(urlDiv, nameField.nextSibling);

        const copyBtn = urlDiv.querySelector('#fuxa-btn-copy-specific-view');
        const inputEl = urlDiv.querySelector('#fuxa-specific-view-url-text');
        const openLink = urlDiv.querySelector('#fuxa-link-open-specific-view');

        function executeCopy(textToCopy) {
            if (navigator.clipboard && window.isSecureContext) {
                return navigator.clipboard.writeText(textToCopy).catch(() => {
                    return fallbackCopy(textToCopy);
                });
            }
            return fallbackCopy(textToCopy);
        }

        function fallbackCopy(textToCopy) {
            try {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                ta.style.position = 'fixed';
                ta.style.top = '-9999px';
                ta.style.left = '-9999px';
                ta.setAttribute('readonly', '');
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                ta.setSelectionRange(0, 99999);
                const successful = document.execCommand('copy');
                document.body.removeChild(ta);
                return successful;
            } catch (err) {
                if (inputEl) {
                    inputEl.focus();
                    inputEl.select();
                    document.execCommand('copy');
                }
                return false;
            }
        }

        if (nameInput) {
            nameInput.addEventListener('input', () => {
                const updatedName = nameInput.value.trim();
                const updatedUrl = updatedName ? `${hostUrl}${currentSubpath}/home?viewName=${encodeURIComponent(updatedName)}` : `${hostUrl}${currentSubpath}/home`;
                if (inputEl) inputEl.value = updatedUrl;
                if (openLink) openLink.href = updatedUrl;
            });
        }

        if (copyBtn && inputEl) {
            ['mousedown', 'pointerdown', 'click'].forEach(evt => {
                copyBtn.addEventListener(evt, (e) => e.stopPropagation(), true);
                if (openLink) openLink.addEventListener(evt, (e) => e.stopPropagation(), true);
            });

            inputEl.addEventListener('click', (e) => {
                e.stopPropagation();
                inputEl.select();
            });

            copyBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = inputEl.value;
                inputEl.focus();
                inputEl.select();
                await executeCopy(url);

                const origText = 'Copy URL';
                copyBtn.textContent = 'Copied! ✓';
                copyBtn.style.borderColor = '#16a34a';
                copyBtn.style.background = '#15803d';
                copyBtn.style.color = '#ffffff';
                setTimeout(() => {
                    copyBtn.textContent = origText;
                    copyBtn.style.borderColor = 'rgba(128, 128, 128, 0.4)';
                    copyBtn.style.background = 'rgba(255, 255, 255, 0.08)';
                    copyBtn.style.color = '#ffffff';
                }, 2000);
            });
        }
    }

    function ensureEditorToolIcons() {
        if (document.getElementById('fuxa-editor-tool-icons-fix')) return;

        const basePath = getBasePath().replace(/\/+$/, '');
        const style = document.createElement('style');
        style.id = 'fuxa-editor-tool-icons-fix';
        style.textContent = `
            /* Fix FUXA Editor Tool Icons under General & Controls for subpath reverse proxy */
            .icon-select { background: url("${basePath}/assets/images/select-pointer.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-pencil { background: url("${basePath}/assets/images/pencil.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-line { background: url("${basePath}/assets/images/line.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-rect { background: url("${basePath}/assets/images/rect.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-circle { background: url("${basePath}/assets/images/circle.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-ellipse { background: url("${basePath}/assets/images/ellipse.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-path { background: url("${basePath}/assets/images/path.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-text { background: url("${basePath}/assets/images/text.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-image { background: url("${basePath}/assets/images/image.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }

            .icon-switch { background: url("${basePath}/assets/images/switch.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-value { background: url("${basePath}/assets/images/value.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-editvalue { background: url("${basePath}/assets/images/editvalue.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-selectvalue { background: url("${basePath}/assets/images/selectvalue.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-progress-v { background: url("${basePath}/assets/images/progress-v.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-semaphore { background: url("${basePath}/assets/images/semaphore.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-button { background: url("${basePath}/assets/images/button.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-chart { background: url("${basePath}/assets/images/chart.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-bag { background: url("${basePath}/assets/images/bag.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-pipe { background: url("${basePath}/assets/images/pipe.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-slider { background: url("${basePath}/assets/images/slider.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-graphbar { background: url("${basePath}/assets/images/graphbar.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-table { background: url("${basePath}/assets/images/table.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-iframe { background: url("${basePath}/assets/images/iframe.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }

            .icon-group { background: url("${basePath}/assets/images/group.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-ungroup { background: url("${basePath}/assets/images/ungroup.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-left { background: url("${basePath}/assets/images/align-left.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-center { background: url("${basePath}/assets/images/align-center.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-right { background: url("${basePath}/assets/images/align-right.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-top { background: url("${basePath}/assets/images/align-top.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-middle { background: url("${basePath}/assets/images/align-middle.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-align-bottom { background: url("${basePath}/assets/images/align-bottom.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-flip-orizontal { background: url("${basePath}/assets/images/flip-orizontal.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
            .icon-flip-vertical { background: url("${basePath}/assets/images/flip-vertical.svg") no-repeat center center !important; background-size: contain !important; width: 30px !important; height: 30px !important; display: inline-block !important; }
        `;
        (document.head || document.documentElement).appendChild(style);
    }

    function ensureAboutDialogCustomization() {
        const infoDialog = document.querySelector('dialog-info, .cdk-overlay-pane:has(dialog-info)');
        if (!infoDialog) return;

        const existingCustom = infoDialog.querySelector('#fuxa-about-custom-text');
        if (existingCustom) {
            existingCustom.style.color = '#ffffff';
            return;
        }

        const content = infoDialog.querySelector('mat-dialog-content, [mat-dialog-content], .mat-mdc-dialog-content');
        if (!content) return;

        const customAbout = document.createElement('div');
        customAbout.id = 'fuxa-about-custom-text';
        customAbout.style.cssText = 'display: block; font-size: 12px; margin-top: 12px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.2); color: #ffffff; font-weight: 600; line-height: 1.4;';
        customAbout.textContent = 'Customised for TVS by Plant engineering 1.3';
        content.appendChild(customAbout);
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
                enforceViewPropertyLayout();
                injectAppSettingsCard();
                injectLayoutHeadlineField();
                ensureAboutDialogCustomization();
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
                    for (let j = 0; j < mutations[i].addedNodes.length; j++) {
                        const node = mutations[i].addedNodes[j];
                        if (node.nodeType === 1) {
                            if (node.tagName === 'APP-SECTION-MESSAGE-DIALOG' || node.querySelector?.('app-section-message-dialog')) {
                                const pane = node.closest('.cdk-overlay-pane') || node;
                                pane.remove();
                                const backdrop = document.querySelector('.cdk-overlay-backdrop');
                                if (backdrop && !document.querySelector('app-app-settings, app-setup, app-layout-property')) {
                                    backdrop.remove();
                                }
                                return;
                            }
                        }
                    }
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
            setTimeout(() => {
                ensureTvsHeaderLogo();
                ensureRuntimeFooter();
            }, 50);
            return result;
        };
    };
    history.pushState = wrapHistoryMethod('pushState');
    history.replaceState = wrapHistoryMethod('replaceState');
    window.addEventListener('popstate', () => setTimeout(() => {
        ensureTvsHeaderLogo();
        ensureRuntimeFooter();
        ensureHeaderLiveDateTime();
    }, 50));

    // Safe Single-Run Initialization
    function init() {
        removeHeaderPageUrlButton();
        const staleBadge = document.getElementById('fuxa-header-project-badge');
        if (staleBadge) staleBadge.remove();
        ensureTvsHeaderLogo();
        ensureRuntimeFooter();
        ensureHeaderLiveDateTime();
        ensureAboutDialogCustomization();
        enforceViewServerRestrictions();
        enforceViewPropertyLayout();
        ensureEditorToolIcons();
        ensureEditorToolIcons();
        fetchLiveProjectName();
        observeSettingsDialog();

        // Ensure hideDevicePluginsNotice is true in backend so Angular never attempts to open it
        try {
            fetch('api/settings')
                .then(res => res.ok ? res.json() : null)
                .then(settings => {
                    if (settings && (!settings.editorSectionMessages || !settings.editorSectionMessages.hideDevicePluginsNotice)) {
                        settings.editorSectionMessages = settings.editorSectionMessages || {};
                        settings.editorSectionMessages.hideDevicePluginsNotice = true;
                        fetch('api/settings', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(settings)
                        }).catch(() => {});
                    }
                }).catch(() => {});
        } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    // Heartbeat check (every 800ms) to guarantee View header & footer persist across Angular route switches
    setInterval(() => {
        ensureTvsHeaderLogo();
        ensureRuntimeFooter();
        ensureHeaderLiveDateTime();
        ensureAboutDialogCustomization();
        enforceViewServerRestrictions();
        enforceViewPropertyLayout();
        ensureEditorToolIcons();

        // Prevent FUXA core socket reconnect from auto-reloading while modal dialogs are open
        if (document.querySelector('.cdk-overlay-pane, mat-dialog-container, app-view-property, app-app-settings')) {
            try {
                sessionStorage.setItem('fuxa_last_safe_reload', String(Date.now()));
            } catch (e) {}
        }
    }, 800);

})();

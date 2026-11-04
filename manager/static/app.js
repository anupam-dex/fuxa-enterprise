// FUXA Fleet Manager - Professional Topological SCADA Orchestrator

let currentMatrix = [];
let allInstancesMap = {};
let selectedPlantFilter = 'all';
let searchQuery = '';

async function loadMatrix() {
    try {
        const res = await fetch('/api/matrix');
        const data = await res.json();
        currentMatrix = data.matrix || [];
        if (data.watchdog) {
            updateWatchdogHeader(data.watchdog);
        }
        renderTopology(currentMatrix);
    } catch (err) {
        console.error("Failed to load matrix:", err);
    }
}

function renderTopology(matrix) {
    allInstancesMap = {};
    let totalInstances = 0;
    const plantStrip = document.getElementById('plant-strip');
    const filterPills = document.getElementById('filter-pills-bar');
    
    plantStrip.innerHTML = '';
    
    // Header Filter Pills setup
    let pillsHtml = `<button class="filter-pill ${selectedPlantFilter === 'all' ? 'active' : ''}" onclick="setPlantFilter('all')">All Plants</button>`;

    matrix.forEach(plant => {
        const pId = plant.plant_id;
        const pCount = (plant.instances || []).length;
        totalInstances += pCount;

        plant.instances.forEach(inst => {
            allInstancesMap[inst.id] = { ...inst, plant_name: plant.name, storage_port: plant.storage_port };
        });

        // Add filter pill
        pillsHtml += `<button class="filter-pill ${selectedPlantFilter === String(pId) ? 'active' : ''}" onclick="setPlantFilter('${pId}')">${plant.name.split(' - ')[0]} (${pCount})</button>`;

        // Plant Strip Card
        const isSelected = selectedPlantFilter === String(pId);
        const card = document.createElement('div');
        card.className = `plant-strip-card ${isSelected ? 'active' : ''}`;
        card.onclick = () => setPlantFilter(isSelected ? 'all' : String(pId));

        card.innerHTML = `
            <div class="plant-strip-top">
                <div>
                    <div class="plant-strip-name">${plant.name}</div>
                    <div class="plant-strip-id">Plant ID: ${pId}</div>
                </div>
                <span class="views-count-pill ${pCount > 0 ? 'has-active' : ''}">${pCount} Active</span>
            </div>
            <div class="plant-strip-bottom">
                <span class="storage-chip" onclick="event.stopPropagation(); window.open('http://' + (window.location.hostname || '127.0.0.1') + ':${plant.storage_port}/editor', '_blank')" title="Click to open Plant ${pId} Storage Server (Field Connections & InfluxDB)" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#38bdf8'" onmouseout="this.style.borderColor=''">
                    <span class="dot live"></span> Storage :${plant.storage_port} ↗
                </span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">InfluxDB Master</span>
            </div>
        `;
        plantStrip.appendChild(card);
    });

    filterPills.innerHTML = pillsHtml;

    // Update global telemetry counters
    document.getElementById('stat-views-total').textContent = totalInstances;
    document.getElementById('pipe-active-count').textContent = `${totalInstances} Deployed Lines`;

    renderInstancesList();
}

function setPlantFilter(plantId) {
    selectedPlantFilter = plantId;
    renderTopology(currentMatrix);
}

function handleSearchInput() {
    searchQuery = (document.getElementById('filter-search')?.value || '').toLowerCase().trim();
    renderInstancesList();
}

function renderInstancesList() {
    const list = document.getElementById('instances-list');
    list.innerHTML = '';

    const host = window.location.hostname || '127.0.0.1';
    const proto = window.location.protocol || 'http:';

    let instances = Object.values(allInstancesMap);

    // Apply plant filter
    if (selectedPlantFilter !== 'all') {
        instances = instances.filter(i => String(i.plant) === String(selectedPlantFilter));
    }

    // Apply search filter
    if (searchQuery) {
        instances = instances.filter(i => 
            (i.name && i.name.toLowerCase().includes(searchQuery)) ||
            (i.subpath && i.subpath.toLowerCase().includes(searchQuery)) ||
            (String(i.port).includes(searchQuery)) ||
            (i.plant_name && i.plant_name.toLowerCase().includes(searchQuery))
        );
    }

    if (instances.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 1.1rem; font-weight: 600; margin-bottom: 6px;">No view servers found matching this view</div>
                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">
                    ${selectedPlantFilter !== 'all' ? `Plant ${selectedPlantFilter} currently has no active HMI view servers deployed.` : 'Get started by creating your first distributed view server.'}
                </div>
                <button class="btn btn-primary btn-sm" onclick="openCreateModal()">+ Create New Project</button>
            </div>
        `;
        return;
    }

    instances.forEach(inst => {
        const row = document.createElement('div');
        row.className = 'instance-card-row';

        // OT Clean URLs without port numbers (Port 80 Reverse Proxy)
        const otEditor = `${proto}//${host}${inst.subpath}/editor`;
        const otView = `${proto}//${host}${inst.subpath}/home`;

        row.innerHTML = `
            <!-- Col 1: Server Identity & Plant -->
            <div class="col-server">
                <div class="title-row">
                    <span class="dot live" title="Instance Live"></span>
                    <span class="name">${inst.name}</span>
                </div>
                <div class="plant-tag">${inst.plant_name || `Plant ${inst.plant}`} &bull; Div ${inst.division || 6} (Line ${inst.line || 1})</div>
            </div>

            <!-- Col 2: Ports & Subpath -->
            <div class="col-routing">
                <div class="port-badge" title="Internal backend process port">Port: ${inst.port}</div>
                <div class="subpath-badge">${inst.subpath}</div>
            </div>

            <!-- Col 3: Data Source -->
            <div class="col-data-source">
                <div class="source-label">Source Bridge</div>
                <div class="source-val">Storage :${inst.storage_port || 5900}</div>
                <div class="tag-badge" title="Active Storage Tags Ingested">🏷️ ${inst.tag_count || 11} Tags</div>
            </div>

            <!-- Col 4: OT Port 80 Clean Reverse Proxy Link -->
            <div class="col-ot-link">
                <a href="${otView}" target="_blank" class="ot-link-pill" title="Open Clean OT View (Port 80 - No Port Number)">
                    <span>🌐</span> ${inst.subpath}/view
                </a>
            </div>

            <!-- Col 5: Actions -->
            <div class="col-actions">
                <a href="${otEditor}" target="_blank" class="btn btn-primary btn-sm" title="Open Editor (Port 80 - No Port Number)">Editor</a>
                <a href="${otView}" target="_blank" class="btn btn-secondary btn-sm" title="Open Operator View (Port 80 - No Port Number)">View</a>
                <button onclick="syncTags('${inst.id}')" class="btn btn-secondary btn-sm" title="Sync Plant Storage Tags into this View Server">🔄 Sync Tags</button>
                <button onclick="editInstance('${inst.id}')" class="btn btn-secondary btn-sm" title="Edit View Server">✏️ Edit</button>
                <button onclick="viewLogs('${inst.id}')" class="btn btn-secondary btn-sm" title="View Logs">Logs</button>
                <button onclick="deleteInstance('${inst.id}')" class="btn btn-danger btn-sm" title="Delete Instance">&#128465;</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function openCreateModal() {
    document.getElementById('create-modal').classList.add('show');
    updatePortPreview();
}

function closeCreateModal() {
    document.getElementById('create-modal').classList.remove('show');
}

function updatePortPreview() {
    const plant = document.getElementById('sel-plant').value;
    const div = document.getElementById('sel-div').value;
    const line = document.getElementById('input-line').value || '1';

    document.getElementById('p-calc-plant').textContent = plant;
    document.getElementById('p-calc-div').textContent = div;
    document.getElementById('p-calc-line').textContent = line;

    const basePort = `${plant}${div}${line}0`;
    const portInput = document.getElementById('input-custom-port');
    if (portInput) {
        portInput.value = basePort;
    }

    const defaultSub = `/p${plant}/div${div}/l${line}`;
    const subInput = document.getElementById('input-subpath');
    if (subInput && (!subInput.value || subInput.value.startsWith('/p'))) {
        subInput.value = defaultSub;
    }
    document.getElementById('subpath-preview').textContent = subInput ? subInput.value : defaultSub;
}

async function submitCreateProject() {
    const plant = parseInt(document.getElementById('sel-plant').value);
    const div = parseInt(document.getElementById('sel-div').value);
    const line = parseInt(document.getElementById('input-line').value || '1');
    const name = document.getElementById('input-name').value || `Plant ${plant} Div ${div} Line ${line}`;
    const customSubpath = (document.getElementById('input-subpath')?.value || '').trim();
    const customPort = parseInt(document.getElementById('input-custom-port')?.value || '0', 10);

    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Provisioning...';

    try {
        const res = await fetch('/api/create-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                plant: plant,
                division: div,
                line: line,
                project_name: name,
                custom_subpath: customSubpath,
                custom_port: customPort > 0 ? customPort : undefined
            })
        });

        const data = await res.json();
        if (data.success) {
            closeCreateModal();
            loadMatrix();
            alert(`Instance Created Successfully!\n\nPort: ${data.instance.port}\nSubpath: ${data.instance.subpath}\n\nPre-loaded with Central OPC-UA Bridge connection!`);
        } else {
            alert('Failed to create instance: ' + (data.detail || 'Unknown error'));
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Launch View Server';
    }
}

async function deleteInstance(id) {
    if (confirm(`Are you sure you want to delete instance ${id}?`)) {
        await fetch(`/api/instances/${id}`, { method: 'DELETE' });
        loadMatrix();
    }
}

function editInstance(id) {
    const inst = allInstancesMap[id];
    if (!inst) return;
    document.getElementById('edit-instance-id').value = id;
    document.getElementById('edit-sel-plant').value = inst.plant !== undefined ? inst.plant : 9;
    document.getElementById('edit-sel-div').value = inst.division !== undefined ? inst.division : 6;
    document.getElementById('edit-input-line').value = inst.line !== undefined ? inst.line : 1;
    document.getElementById('edit-input-name').value = inst.name || '';
    document.getElementById('edit-input-subpath').value = inst.subpath || '';
    const port = inst.port || 9610;
    document.getElementById('edit-input-port').value = port;
    document.getElementById('edit-port-calc-result').textContent = port;
    document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
}

async function submitEditInstance() {
    const id = document.getElementById('edit-instance-id').value;
    const plant = parseInt(document.getElementById('edit-sel-plant').value);
    const div = parseInt(document.getElementById('edit-sel-div').value);
    const line = parseInt(document.getElementById('edit-input-line').value || '1');
    const name = document.getElementById('edit-input-name').value.trim();
    const subpath = document.getElementById('edit-input-subpath').value.trim();
    const port = parseInt(document.getElementById('edit-input-port')?.value || '0', 10);
    const btn = document.getElementById('btn-save-edit');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        const res = await fetch(`/api/instances/${id}/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                subpath: subpath,
                plant: plant,
                division: div,
                line: line,
                port: port > 0 ? port : undefined
            })
        });
        const data = await res.json();
        if (data.success) {
            closeEditModal();
            loadMatrix();
        } else {
            alert('Failed: ' + (data.detail || 'Unknown error'));
        }
    } catch (e) {
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save & Route';
    }
}

async function viewLogs(id) {
    const modal = document.getElementById('logs-modal');
    const content = document.getElementById('logs-content');
    const title = document.getElementById('logs-title');

    modal.classList.add('show');
    title.textContent = `Live Logs: ${id}`;
    content.textContent = 'Loading logs...';

    try {
        const res = await fetch(`/api/instances/${id}/logs`);
        const data = await res.json();
        content.textContent = data.logs || 'No logs available.';
        content.scrollTop = content.scrollHeight;
    } catch (e) {
        content.textContent = 'Error loading logs: ' + e.message;
    }
}

function closeLogsModal() {
    document.getElementById('logs-modal').classList.remove('show');
}

async function syncTags(id) {
    try {
        const res = await fetch(`/api/instances/${id}/sync-tags`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`✓ ${data.message}`);
            loadMatrix();
        } else {
            alert('Failed to sync tags: ' + (data.detail || 'Unknown error'));
        }
    } catch (e) {
        alert('Error syncing tags: ' + e.message);
    }
}

async function syncAllTags() {
    try {
        const res = await fetch('/api/sync-all-tags', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`✓ ${data.message}`);
            loadMatrix();
        } else {
            alert('Failed to sync all tags: ' + (data.detail || 'Unknown error'));
        }
    } catch (e) {
        alert('Error syncing all tags: ' + e.message);
    }
}

// =============================================================================
// OT Reliability: Process Watchdog Functions
// =============================================================================
let currentWatchdogData = null;

function updateWatchdogHeader(wd) {
    currentWatchdogData = wd;
    const textEl = document.getElementById('stat-watchdog-text');
    const dotEl = document.getElementById('dot-watchdog');
    if (!textEl) return;
    if (wd.enabled) {
        textEl.textContent = `Active (${wd.auto_recoveries || 0} Heals)`;
        textEl.style.color = '#10b981';
        if (dotEl) {
            dotEl.className = 'dot live';
        }
    } else {
        textEl.textContent = 'PAUSED';
        textEl.style.color = '#f59e0b';
        if (dotEl) {
            dotEl.className = 'dot';
            dotEl.style.background = '#f59e0b';
        }
    }
}

async function openWatchdogModal() {
    const modal = document.getElementById('watchdog-modal');
    modal.classList.add('show');
    await refreshWatchdogModal();
}

function closeWatchdogModal() {
    document.getElementById('watchdog-modal').classList.remove('show');
}

async function refreshWatchdogModal() {
    try {
        const res = await fetch('/api/watchdog/status');
        const data = await res.json();
        currentWatchdogData = data;
        
        const statusEl = document.getElementById('wd-stat-status');
        if (statusEl) {
            statusEl.textContent = data.enabled ? 'ACTIVE' : 'PAUSED';
            statusEl.style.color = data.enabled ? '#10b981' : '#f59e0b';
        }
        const scansEl = document.getElementById('wd-stat-scans');
        if (scansEl) scansEl.textContent = data.total_checks || 0;
        const recovEl = document.getElementById('wd-stat-recoveries');
        if (recovEl) recovEl.textContent = data.auto_recoveries || 0;
        
        const btnToggle = document.getElementById('btn-toggle-watchdog');
        if (btnToggle) {
            btnToggle.textContent = data.enabled ? 'Pause Watchdog' : 'Resume Watchdog';
        }

        const list = document.getElementById('wd-events-list');
        if (!list) return;
        const events = data.events || [];
        if (events.length === 0) {
            list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding: 18px;">🛡️ All monitored processes healthy. No crash recovery events recorded.</div>';
            return;
        }

        let html = '';
        events.forEach(ev => {
            const isRecov = ev.type.includes('RECOVER') || ev.type === 'RECOVERY';
            const color = isRecov ? '#fbbf24' : (ev.type === 'RESTORE' ? '#38bdf8' : '#94a3b8');
            html += `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 10px;">
                    <div>
                        <span style="color: ${color}; font-weight: 700;">[${ev.type}]</span>
                        <strong style="color: #f1f5f9; margin-left: 6px;">${ev.target}:</strong>
                        <span style="color: #cbd5e1; margin-left: 4px;">${ev.message}</span>
                    </div>
                    <span style="color: var(--text-muted); font-size: 0.72rem; white-space: nowrap; flex-shrink: 0;">${ev.timestamp}</span>
                </div>
            `;
        });
        list.innerHTML = html;
    } catch (e) {
        console.error("Watchdog modal error:", e);
    }
}

async function toggleWatchdog() {
    try {
        const res = await fetch('/api/watchdog/toggle', { method: 'POST' });
        const data = await res.json();
        await refreshWatchdogModal();
        loadMatrix();
    } catch (e) {
        alert("Could not toggle watchdog: " + e.message);
    }
}

// =============================================================================
// OT Reliability: 1-Click Disaster Recovery & Backup Snapshots
// =============================================================================
async function openBackupModal() {
    const modal = document.getElementById('backup-modal');
    modal.classList.add('show');
    await loadBackupsList();
}

function closeBackupModal() {
    document.getElementById('backup-modal').classList.remove('show');
}

async function loadBackupsList() {
    const container = document.getElementById('backup-list-container');
    if (!container) return;
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Loading snapshots...</div>';
    
    try {
        const res = await fetch('/api/backup/list');
        const data = await res.json();
        const backups = data.backups || [];

        if (backups.length === 0) {
            container.innerHTML = `
                <div style="padding: 32px 20px; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 1.8rem; margin-bottom: 6px;">📦</div>
                    <div style="font-size: 0.95rem; font-weight: 600; color: #f1f5f9; margin-bottom: 4px;">No backup snapshots found</div>
                    <div style="font-size: 0.78rem;">Click "+ Snapshot Now" above to create your first full disaster recovery archive.</div>
                </div>
            `;
            return;
        }

        let html = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
                <thead>
                    <tr style="border-bottom: 1px solid #242e3f; color: var(--text-muted); font-size: 0.72rem; text-transform: uppercase;">
                        <th style="padding: 10px 14px;">Snapshot Archive</th>
                        <th style="padding: 10px 14px;">Created</th>
                        <th style="padding: 10px 14px;">Size</th>
                        <th style="padding: 10px 14px;">Instances</th>
                        <th style="padding: 10px 14px; text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        backups.forEach(b => {
            html += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 10px 14px; font-family: monospace; color: #38bdf8; font-weight: 600;">
                        📄 ${b.filename}
                    </td>
                    <td style="padding: 10px 14px; color: #cbd5e1; font-family: monospace; font-size: 0.76rem;">
                        ${b.created_at}
                    </td>
                    <td style="padding: 10px 14px; color: #94a3b8; font-family: monospace;">
                        ${b.size_kb} KB
                    </td>
                    <td style="padding: 10px 14px;">
                        <span style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 600;">
                            ${b.instances_count} Lines
                        </span>
                    </td>
                    <td style="padding: 10px 14px; text-align: right;">
                        <button onclick="downloadBackup('${b.filename}')" class="btn btn-secondary" style="font-size: 0.72rem; padding: 3px 8px; margin-right: 4px;" title="Download archive to local machine">
                            ⬇ Download
                        </button>
                        <button onclick="confirmRestoreBackup('${b.filename}')" class="btn btn-primary" style="font-size: 0.72rem; padding: 3px 10px; margin-right: 4px; background: linear-gradient(135deg, #10b981, #059669);" title="1-Click Safe Disaster Recovery">
                            🔄 Restore
                        </button>
                        <button onclick="deleteBackup('${b.filename}')" style="background: transparent; border: none; color: #ef4444; font-size: 0.85rem; cursor: pointer; padding: 2px 4px; opacity: 0.8;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="Delete Snapshot">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="padding: 20px; color: #ef4444; text-align: center;">Error loading snapshots: ${e.message}</div>`;
    }
}

async function createFleetBackup() {
    const btn = document.getElementById('btn-create-backup');
    btn.disabled = true;
    const oldText = btn.textContent;
    btn.textContent = 'Archiving Fleet...';

    try {
        const res = await fetch('/api/backup/create', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert(`✓ Disaster Recovery Snapshot Created!\n\nFile: ${data.filename}\nSize: ${data.size_kb} KB\nLines Included: ${data.instances_count}`);
            await loadBackupsList();
        } else {
            alert("Backup failed: " + (data.detail || "Unknown error"));
        }
    } catch (e) {
        alert("Error creating snapshot: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = oldText;
    }
}

function downloadBackup(filename) {
    window.open(`/api/backup/download/${filename}`, '_blank');
}

async function handleBackupUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch('/api/backup/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            alert(`✓ Backup archive "${data.filename}" uploaded successfully!`);
            await loadBackupsList();
        } else {
            alert("Upload failed: " + (data.detail || "Unknown error"));
        }
    } catch (e) {
        alert("Error uploading backup: " + e.message);
    } finally {
        event.target.value = '';
    }
}

async function confirmRestoreBackup(filename) {
    const confirmed = confirm(
        `⚠️ WARNING: 1-Click Disaster Recovery Restore\n\n` +
        `Restoring snapshot "${filename}" will safely stop all running lines, replace databases with this snapshot, and re-launch all restored servers.\n\n` +
        `Do you want to proceed with full fleet restore?`
    );

    if (!confirmed) return;

    try {
        const res = await fetch('/api/backup/restore', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });
        const data = await res.json();
        if (data.success) {
            alert(`✓ ${data.message}`);
            closeBackupModal();
            loadMatrix();
        } else {
            alert("Restore failed: " + (data.detail || "Unknown error"));
        }
    } catch (e) {
        alert("Error restoring snapshot: " + e.message);
    }
}

async function deleteBackup(filename) {
    if (!confirm(`Delete snapshot archive "${filename}"?`)) return;

    try {
        const res = await fetch(`/api/backup/${filename}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            await loadBackupsList();
        } else {
            alert("Delete failed: " + (data.detail || "Unknown error"));
        }
    } catch (e) {
        alert("Error deleting snapshot: " + e.message);
    }
}

// Auto-Refresh
loadMatrix();
setInterval(loadMatrix, 5000);

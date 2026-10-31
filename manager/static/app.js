// FUXA Fleet Manager Frontend Logic

async function loadMatrix() {
    try {
        const res = await fetch('/api/matrix');
        const data = await res.json();
        renderPlantGrid(data.matrix);
        document.getElementById('stat-plants').textContent = data.matrix.length;
    } catch (err) {
        console.error("Failed to load matrix:", err);
    }
}

function renderPlantGrid(matrix) {
    const grid = document.getElementById('plant-grid');
    grid.innerHTML = '';

    matrix.forEach(plant => {
        const card = document.createElement('div');
        card.className = 'plant-card';

        const storageStatusClass = plant.storage_online ? 'live' : '';
        const storageText = plant.storage_online ? 'Online' : 'Standby / Sim';

        let instancesHtml = '';
        if (plant.instances.length === 0) {
            instancesHtml = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px 0;">No active view servers created yet.</div>`;
        } else {
            instancesHtml = plant.instances.map(inst => `
                <div class="instance-row">
                    <div class="instance-info">
                        <div class="instance-name">${inst.name}</div>
                        <div class="instance-sub">Port: <strong>${inst.port}</strong> | ${inst.subpath}</div>
                    </div>
                    <div class="instance-actions">
                        <a href="http://127.0.0.1:${inst.port}/editor" target="_blank" class="btn btn-primary btn-sm">Editor</a>
                        <a href="http://127.0.0.1:${inst.port}/home" target="_blank" class="btn btn-secondary btn-sm">View</a>
                        <button onclick="deleteInstance('${inst.id}')" class="btn btn-danger btn-sm">&#128465;</button>
                    </div>
                </div>
            `).join('');
        }

        card.innerHTML = `
            <div class="plant-card-header">
                <div>
                    <div class="plant-title">${plant.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">Plant ID: ${plant.plant_id}</div>
                </div>
                <div class="storage-pill">
                    <span class="dot ${storageStatusClass}"></span>
                    Storage: :${plant.storage_port}
                </div>
            </div>
            <div class="instances-list">
                <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase;">Deployed View Servers:</div>
                ${instancesHtml}
            </div>
        `;
        grid.appendChild(card);
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
    document.getElementById('p-calc-result').textContent = basePort;
    document.getElementById('subpath-preview').textContent = `/p${plant}/div${div}/l${line}`;
}

async function submitCreateProject() {
    const plant = parseInt(document.getElementById('sel-plant').value);
    const div = parseInt(document.getElementById('sel-div').value);
    const line = parseInt(document.getElementById('input-line').value || '1');
    const name = document.getElementById('input-name').value || `Plant ${plant} Div ${div} Line ${line}`;

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
                project_name: name
            })
        });

        const data = await res.json();
        if (data.success) {
            closeCreateModal();
            loadMatrix();
            alert(`Instance Created Successfully!\n\nPort: ${data.instance.port}\nSubpath: ${data.instance.subpath}\n\nPre-loaded with OPC-UA Storage Server connection!`);
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

// Initial load
loadMatrix();
setInterval(loadMatrix, 5000);

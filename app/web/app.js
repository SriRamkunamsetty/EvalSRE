let incidentsData = [];
let selectedIncident = null;

const btnDownloadSuite = document.getElementById('btn-download-suite');
const btnExportMd = document.getElementById('btn-export-md');
const filterSev1 = document.getElementById('filter-sev1');
const tableBody = document.getElementById('incidents-table-body');
const incidentCountSpan = document.getElementById('incident-count');

// KPI elements
const kpiTotal = document.getElementById('kpi-total');
const kpiSev1 = document.getElementById('kpi-sev1');
const kpiResolution = document.getElementById('kpi-resolution');
const kpiTests = document.getElementById('kpi-tests');

// Synthesizer DOM
const synthEmpty = document.getElementById('synth-empty');
const synthBody = document.getElementById('synth-body');
const synthIncId = document.getElementById('synth-inc-id');
const synthTitle = document.getElementById('synth-title');
const synthPrompt = document.getElementById('synth-prompt');
const synthFailing = document.getElementById('synth-failing');
const synthExpected = document.getElementById('synth-expected');
const synthCode = document.getElementById('synth-code');
const btnSynthesize = document.getElementById('btn-synthesize');
const btnCopyCode = document.getElementById('btn-copy-code');

document.addEventListener('DOMContentLoaded', async () => {
  await loadIncidents();
  await loadMetrics();
});

async function loadIncidents() {
  try {
    const res = await fetch('/api/incidents');
    if (!res.ok) throw new Error('Failed to load incidents');
    incidentsData = await res.json();
    renderTable();
  } catch (err) {
    console.error(err);
    alert('Error loading incidents.');
  }
}

async function loadMetrics() {
  try {
    const res = await fetch('/api/metrics');
    if (!res.ok) return;
    const m = await res.json();
    kpiTotal.textContent = m.total_incidents;
    kpiSev1.textContent = m.open_sev1_count;
    kpiSev1.style.color = m.open_sev1_count > 0 ? 'var(--danger)' : 'var(--success)';
    kpiResolution.textContent = `${(m.resolution_rate * 100).toFixed(1)}%`;
    kpiTests.textContent = m.tests_synthesized_count;
  } catch (err) {
    console.error(err);
  }
}

filterSev1.addEventListener('change', () => {
  renderTable();
});

function renderTable() {
  const onlySev1 = filterSev1.checked;
  const filtered = incidentsData.filter(i => {
    if (!onlySev1) return true;
    return i.severity && i.severity.includes('SEV-1');
  });

  incidentCountSpan.textContent = filtered.length;
  tableBody.innerHTML = '';

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No matching production incidents found.</td></tr>`;
    return;
  }

  filtered.forEach(inc => {
    const tr = document.createElement('tr');
    if (selectedIncident && selectedIncident.incident_id === inc.incident_id) {
      tr.classList.add('selected');
    }

    let sevBadge = 'badge-sev3';
    if (inc.severity.includes('SEV-1')) sevBadge = 'badge-sev1';
    else if (inc.severity.includes('SEV-2')) sevBadge = 'badge-sev2';

    const statusBadge = inc.status === 'VERIFIED_RESOLVED' ? 'badge-status-resolved' : 'badge-status';

    tr.innerHTML = `
      <td><code>${inc.incident_id}</code></td>
      <td><span class="badge ${sevBadge}">${escapeHtml(inc.severity)}</span></td>
      <td>${escapeHtml(inc.category)}</td>
      <td><span class="badge ${statusBadge}">${escapeHtml(inc.status)}</span></td>
      <td><code>${(inc.sha256_fingerprint || '--------').substring(0, 8)}</code></td>
    `;

    tr.addEventListener('click', () => {
      selectedIncident = inc;
      renderTable();
      displaySynthesizer(inc);
    });

    tableBody.appendChild(tr);
  });
}

function displaySynthesizer(inc) {
  synthEmpty.classList.add('hidden');
  synthBody.classList.remove('hidden');

  synthIncId.textContent = inc.incident_id;
  synthTitle.textContent = `${inc.title} [${inc.severity}]`;
  synthPrompt.textContent = inc.prompt;
  synthFailing.textContent = inc.failing_response;
  synthExpected.textContent = inc.expected_behavior;

  synthCode.textContent = '# Click "Synthesize Pytest" above to generate regression fixture';
}

btnSynthesize.addEventListener('click', async () => {
  if (!selectedIncident) return;
  try {
    const res = await fetch('/api/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedIncident)
    });
    if (!res.ok) throw new Error('Synthesis failed');
    const testCase = await res.json();
    synthCode.textContent = testCase.pytest_code;
    selectedIncident.status = 'TEST_SYNTHESIZED';
    await loadMetrics();
    renderTable();
  } catch (err) {
    console.error(err);
    alert('Error synthesizing test case: ' + err.message);
  }
});

btnCopyCode.addEventListener('click', () => {
  const code = synthCode.textContent;
  if (!code || code.startsWith('#')) return;
  navigator.clipboard.writeText(code).then(() => {
    btnCopyCode.textContent = 'Copied!';
    setTimeout(() => { btnCopyCode.textContent = 'Copy Code'; }, 2000);
  });
});

btnDownloadSuite.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/export/pytest');
    if (!res.ok) throw new Error('Export failed');
    const code = await res.text();
    downloadFile(code, 'test_production_regressions.py', 'text/x-python');
  } catch (err) {
    console.error(err);
    alert('Error downloading pytest suite.');
  }
});

btnExportMd.addEventListener('click', async () => {
  if (incidentsData.length === 0) {
    alert('No incidents to export.');
    return;
  }
  try {
    const res = await fetch('/api/reports/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentsData)
    });
    if (!res.ok) throw new Error('Markdown generation failed');
    const md = await res.text();
    downloadFile(md, 'evalsre-incident-audit.md', 'text/markdown');
  } catch (err) {
    console.error(err);
    alert('Error exporting markdown report.');
  }
});

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}

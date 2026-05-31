const DICE_STORAGE_KEY = 'fairDieDice';

let chart = null;
let parsedData = null;
let rollCounts = null;
let mode = 'record';


function getDiceList() {
  try {
    const raw = localStorage.getItem(DICE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveDiceList(list) {
  try { localStorage.setItem(DICE_STORAGE_KEY, JSON.stringify(list)); } catch (e) { alert('Storage is full. Delete some saved dice to make room.'); }
}

function autoSaveDie() {
  if (!rollCounts) return;
  const numSides = parseInt(document.getElementById('die-select').value);
  const total = rollCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const entries = getDiceList();
  const idx = entries.findIndex(e => e.sides === numSides && e.id.startsWith('auto_'));

  const entry = {
    id: `auto_${numSides}`,
    name: `D${numSides}`,
    sides: numSides,
    counts: [...rollCounts],
    total,
    savedAt: Date.now()
  };

  if (idx >= 0) entries[idx] = entry;
  else entries.push(entry);

  saveDiceList(entries);
}

function saveDie(name) {
  if (!rollCounts) return;
  const numSides = parseInt(document.getElementById('die-select').value);
  const total = rollCounts.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  let entries = getDiceList();
  // Remove auto-saved entry for this die so it doesn't linger as a duplicate
  entries = entries.filter(e => !(e.sides === numSides && e.id.startsWith('auto_')));

  const safeName = name || `D${numSides}`;
  const existing = entries.findIndex(e => e.name === safeName && e.sides === numSides);

  const entry = {
    id: existing >= 0 ? entries[existing].id : `saved_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: safeName,
    sides: numSides,
    counts: [...rollCounts],
    total,
    savedAt: Date.now()
  };

  if (existing >= 0) entries[existing] = entry;
  else entries.push(entry);

  saveDiceList(entries);
  renderSavedDiceList();
}

function deleteDie(id) {
  saveDiceList(getDiceList().filter(e => e.id !== id));
  renderSavedDiceList();
}

function loadDie(id) {
  const entry = getDiceList().find(e => e.id === id);
  if (!entry) return;

  document.getElementById('die-select').value = entry.sides.toString();
  rollCounts = [...entry.counts];
  mode = 'record';
  setMode('record');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderSavedDiceList() {
  const section = document.getElementById('saved-dice-section');
  const container = document.getElementById('saved-dice-list');
  if (!section || !container) return;
  const entries = getDiceList();

  if (entries.length === 0) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  const shown = entries.filter(e => !e.id.startsWith('auto_'));
  if (shown.length === 0) {
    section.classList.add('hidden');
    return;
  }

  container.innerHTML = shown
    .sort((a, b) => b.savedAt - a.savedAt)
    .map(e => {
      const d = new Date(e.savedAt);
      return `
        <div class="saved-die-entry">
          <div class="saved-die-info">
            <span class="saved-die-name">${escapeHtml(e.name)}</span>
            <span class="saved-die-meta">D${e.sides} &middot; ${e.total} rolls &middot; ${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>
          </div>
          <div class="saved-die-actions">
            <button class="load-die-btn" data-id="${e.id}">Load</button>
            <button class="delete-die-btn" data-id="${e.id}">Delete</button>
          </div>
        </div>`;
    }).join('');

  container.querySelectorAll('.load-die-btn').forEach(b =>
    b.addEventListener('click', () => loadDie(b.dataset.id)));
  container.querySelectorAll('.delete-die-btn').forEach(b =>
    b.addEventListener('click', () => deleteDie(b.dataset.id)));
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart !== 'undefined' && Chart.register) {
    Chart.register({
      id: 'nerdErrorBars',
      afterDraw: function(ch) {
        if (ch._nerdErrorData) {
          drawErrorBars(ch, ch._nerdErrorData.observed, ch._nerdErrorData.total);
        }
      }
    });
  }

  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const dieSelect = document.getElementById('die-select');
  const downloadLink = document.getElementById('download-example');
  const modeBtns = document.querySelectorAll('.mode-btn');
  const clearBtn = document.getElementById('clear-rolls');
  const saveBtn = document.getElementById('save-rolls');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (file) handleFile(file);
  });

  dieSelect.addEventListener('change', () => {
    if (mode === 'record') {
      rollCounts = null;
      generateDiceButtons();
      document.getElementById('results').classList.add('hidden');
      updateTallyDisplay(0);
    } else if (parsedData) {
      processAndDisplay();
    }
  });

  downloadLink.addEventListener('click', (e) => {
    e.preventDefault();
    downloadExample();
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  clearBtn.addEventListener('click', clearRecordedRolls);

  saveBtn.addEventListener('click', () => {
    const numSides = parseInt(document.getElementById('die-select').value);
    const recent = getDiceList()
      .filter(e => e.sides === numSides && !e.id.startsWith('auto_'))
      .sort((a, b) => b.savedAt - a.savedAt)[0];
    const defaultName = recent ? recent.name : `D${numSides}`;
    const name = prompt('Name this die (e.g. "D6 session 1"):', defaultName);
    if (name) saveDie(name.trim());
  });

  setMode('record');

  const entries = getDiceList();
  if (entries.length > 0) {
    const latest = entries.sort((a, b) => b.savedAt - a.savedAt)[0];
    dieSelect.value = latest.sides.toString();
    rollCounts = latest.counts;
    generateDiceButtons();
    updateDieBadges();
    processRecordedData();
  }

  renderSavedDiceList();

  document.getElementById('nerd-toggle').addEventListener('click', () => {
    const btn = document.getElementById('nerd-toggle');
    const panel = document.getElementById('nerd-panel');
    btn.classList.toggle('active');
    panel.classList.toggle('hidden');
    
    if (chart) {
      const ciDataset = chart.data.datasets.find(ds => ds.label === '95% Confidence');
      if (ciDataset) {
        ciDataset.hidden = !btn.classList.contains('active');
      }
      chart.update();
    }
  });
});

function setMode(newMode) {
  mode = newMode;
  document.querySelectorAll('.mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
  document.getElementById('upload-section').classList.toggle('hidden', mode !== 'upload');
  document.getElementById('recorder-section').classList.toggle('hidden', mode !== 'record');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('nerd-stats').classList.add('hidden');
  document.getElementById('nerd-toggle').classList.remove('active');
  document.getElementById('nerd-panel').classList.add('hidden');

  if (mode === 'record') {
    generateDiceButtons();
    if (rollCounts && rollCounts.reduce((a, b) => a + b, 0) > 0) {
      updateDieBadges();
      processRecordedData();
      document.getElementById('results').classList.remove('hidden');
    }
  } else if (parsedData) {
    processAndDisplay();
    document.getElementById('results').classList.remove('hidden');
  }
}

function generateDiceButtons() {
  const numSides = parseInt(document.getElementById('die-select').value);
  const grid = document.getElementById('dice-grid');
  grid.innerHTML = '';

  for (let i = 1; i <= numSides; i++) {
    const btn = document.createElement('button');
    btn.className = 'die-btn';
    btn.textContent = i;
    btn.dataset.face = i;
    btn.addEventListener('click', () => recordRoll(i));
    grid.appendChild(btn);
  }
}

function recordRoll(face) {
  const numSides = parseInt(document.getElementById('die-select').value);

  if (!rollCounts) {
    rollCounts = new Array(numSides).fill(0);
  }

  rollCounts[face - 1]++;
  autoSaveDie();
  updateDieBadges();
  processRecordedData();
}

function updateDieBadges() {
  if (!rollCounts) return;
  document.querySelectorAll('.die-btn').forEach(btn => {
    const face = parseInt(btn.dataset.face);
    const count = rollCounts[face - 1];
    btn.classList.toggle('has-rolls', count > 0);

    let badge = btn.querySelector('.count-badge');
    if (count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'count-badge';
        btn.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  });
}

function processRecordedData() {
  if (!rollCounts) return;
  const total = rollCounts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    document.getElementById('results').classList.add('hidden');
    updateTallyDisplay(total);
    return;
  }

  parsedData = {
    values: [...rollCounts],
    isAggregated: true
  };

  processAndDisplay();
  updateTallyDisplay(total);
}

function updateTallyDisplay(total) {
  const numSides = parseInt(document.getElementById('die-select').value);
  const target = getTarget(numSides);
  const pct = Math.min(100, (total / target) * 100);

  document.getElementById('roll-count').textContent = `${total} rolls`;
  document.getElementById('roll-target').textContent = `/ ${target} recommended`;
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

function getTarget(numSides) {
  return Math.max(100, 20 * numSides);
}

function clearRecordedRolls() {
  const numSides = parseInt(document.getElementById('die-select').value);
  saveDiceList(getDiceList().filter(e => !(e.sides === numSides && e.id.startsWith('auto_'))));
  renderSavedDiceList();
  rollCounts = null;
  document.getElementById('results').classList.add('hidden');
  document.getElementById('nerd-stats').classList.add('hidden');
  document.getElementById('nerd-toggle').classList.remove('active');
  document.getElementById('nerd-panel').classList.add('hidden');
  document.querySelectorAll('.die-btn .count-badge').forEach(b => b.remove());
  document.querySelectorAll('.die-btn').forEach(b => b.classList.remove('has-rolls'));
  updateTallyDisplay(0);
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      parsedData = parseFile(e.target.result, file.name);
      if (mode === 'upload') {
        processAndDisplay();
        document.getElementById('results').classList.remove('hidden');
      }
    } catch (err) {
      showError('Failed to parse file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function parseFile(text, filename) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty file');

  if (trimmed[0] === '[' || trimmed[0] === '{') {
    return parseJSON(trimmed);
  }

  return parseTabular(trimmed);
}

function parseJSON(text) {
  const data = JSON.parse(text);

  if (Array.isArray(data)) {
    const nums = data.filter(v => typeof v === 'number' && !isNaN(v));
    if (nums.length === 0) throw new Error('No numeric values found in JSON array');
    return { values: nums };
  }

  if (typeof data === 'object' && data !== null) {
    if (Array.isArray(data.rolls)) {
      const nums = data.rolls.filter(v => typeof v === 'number' && !isNaN(v));
      if (nums.length === 0) throw new Error('No numeric values in data.rolls');
      return { values: nums };
    }
    if (Array.isArray(data.data)) {
      const nums = data.data.filter(v => typeof v === 'number' && !isNaN(v));
      if (nums.length === 0) throw new Error('No numeric values in data.data');
      return { values: nums };
    }

    const entries = Object.entries(data)
      .filter(([k, v]) => !isNaN(parseInt(k, 10)) && typeof v === 'number')
      .map(([k, v]) => ({ face: parseInt(k, 10), count: Math.round(v) }))
      .filter(e => e.count >= 0)
      .sort((a, b) => a.face - b.face);

    if (entries.length > 0) {
      return {
        values: entries.map(e => e.count),
        isAggregated: true
      };
    }

    throw new Error('Could not parse JSON: expected array or face-to-count object');
  }

  throw new Error('Unexpected JSON structure');
}

function parseTabular(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) throw new Error('No data found in file');

  let startLine = 0;
  if (lines.length > 1) {
    const first = lines[0].split(',')[0].trim();
    if (isNaN(parseFloat(first))) {
      startLine = 1;
    }
  }

  if (lines.length - startLine === 0) throw new Error('No numeric data found');

  const singleLine = lines.length - startLine === 1;
  if (singleLine) {
    const values = lines[startLine].split(',').map(v => {
      const n = parseInt(v.trim(), 10);
      if (isNaN(n)) throw new Error('Non-numeric value found: ' + v.trim());
      return n;
    });
    return { values };
  }

  const firstDataLine = lines[startLine];
  const parts = firstDataLine.split(',').filter(p => p.trim().length > 0);

  if (parts.length >= 2) {
    const pairs = [];
    for (let i = startLine; i < lines.length; i++) {
      const p = lines[i].split(',').map(v => v.trim());
      if (p.length >= 2) {
        const face = parseInt(p[0], 10);
        const count = parseInt(p[1], 10);
        if (!isNaN(face) && !isNaN(count)) {
          pairs.push({ face, count: Math.max(0, count) });
        }
      }
    }
    if (pairs.length > 0) {
      pairs.sort((a, b) => a.face - b.face);
      return {
        values: pairs.map(p => p.count),
        isAggregated: true
      };
    }
  }

  const values = [];
  for (let i = startLine; i < lines.length; i++) {
    const n = parseInt(lines[i], 10);
    if (!isNaN(n)) values.push(n);
  }

  if (values.length === 0) throw new Error('No numeric values found');

  return { values };
}

function processAndDisplay() {
  const numSides = parseInt(document.getElementById('die-select').value);
  const { values, isAggregated } = parsedData;

  let counts;
  let total;
  let detectionNote;

  if (isAggregated) {
    if (values.length !== numSides) {
      showError(`File has ${values.length} values, but a D${numSides} needs ${numSides} face counts. Check your die selection or data file.`);
      return;
    }
    counts = values;
    total = counts.reduce((a, b) => a + b, 0);
    detectionNote = null;
  } else {
    if (values.some(v => v > numSides)) {
      showError(`Values exceed D${numSides} face range (1-${numSides}). Select a larger die or check your data.`);
      return;
    }

    const tallied = new Array(numSides).fill(0);
    let valid = 0;
    for (const v of values) {
      if (v >= 1 && v <= numSides) {
        tallied[v - 1]++;
        valid++;
      }
    }
    if (valid === 0) {
      showError(`No roll values are in range 1-${numSides} for D${numSides}. Check your die selection.`);
      return;
    }

    if (values.length === numSides && values.every(v => v >= 1 && v <= numSides)) {
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum >= numSides * numSides) {
        counts = [...values];
        total = sum;
        detectionNote = 'Auto-detected as aggregated counts per face';
      } else {
        counts = tallied;
        total = valid;
        detectionNote = `File has ${values.length} values matching D${numSides} face range; interpreted as raw rolls. If these are aggregated counts, use JSON object or CSV with face,count columns.`;
      }
    } else {
      counts = tallied;
      total = valid;
      detectionNote = valid < values.length
        ? `${values.length - valid} value(s) outside 1-${numSides} were ignored`
        : null;
    }
  }

  const stats = chiSquaredTest(counts, numSides);
  stats.total = total;

  document.getElementById('results').classList.remove('hidden');
  displayResults(stats, counts, numSides, detectionNote);
  renderChart(counts, stats.expected, numSides);
  renderRanking(counts, numSides);
  renderNerdStats(counts, numSides, total, stats.chiSq);
}

function chiSquaredTest(observed, numSides) {
  const total = observed.reduce((a, b) => a + b, 0);
  if (total === 0) throw new Error('No rolls to analyze');
  const expected = total / numSides;
  let chiSq = 0;
  for (let i = 0; i < numSides; i++) {
    const diff = observed[i] - expected;
    chiSq += (diff * diff) / expected;
  }
  const df = numSides - 1;
  const pValue = 1 - regularizedLowerGammaP(df / 2, chiSq / 2);
  return { chiSq, df, pValue, expected };
}

function regularizedLowerGammaP(a, x) {
  if (x <= 0 || a <= 0) return 0;

  // For very large x, the lower tail probability is essentially 1
  if (x > a + 100) return 1;

  const logGammaA = logGamma(a);

  let sum = 1 / a;
  let term = 1 / a;
  for (let n = 1; n <= 500; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < 1e-15 * Math.abs(sum)) break;
  }

  return Math.exp(-x + a * Math.log(x) - logGammaA) * sum;
}

function logGamma(z) {
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  if (z < 0.5) {
    return logGamma(z + 1) - Math.log(z);
  }

  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }

  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function displayResults(stats, observed, numSides, note) {
  document.getElementById('chi-squared').textContent = stats.chiSq.toFixed(4);
  document.getElementById('df').textContent = stats.df;
  document.getElementById('total-rolls').textContent = stats.total;
  document.getElementById('p-value').textContent = formatPValue(stats.pValue);

  const verdictEl = document.getElementById('verdict');
  const alpha = 0.05;
  if (stats.pValue < alpha) {
    verdictEl.textContent = 'Biased (p < 0.05)';
    verdictEl.className = 'stat-value biased';
  } else {
    verdictEl.textContent = 'Fair (p \u2265 0.05)';
    verdictEl.className = 'stat-value fair';
  }

  const warningEl = document.getElementById('warning-note');
  const warnings = [];

  if (stats.total < 5 * numSides) {
    warnings.push(`Small sample size (${stats.total} rolls). Chi-squared test is unreliable with fewer than ${5 * numSides} rolls (expected < 5 per face).`);
  }

  if (note) {
    warnings.push(note);
  }

  if (warnings.length > 0) {
    warningEl.textContent = warnings.join(' ');
    warningEl.className = 'note ' + (warnings.some(w => w.includes('Small')) ? 'warning' : '');
  } else {
    warningEl.textContent = '';
    warningEl.className = 'note';
  }
}

function formatPValue(p) {
  if (p < 0.0001) return '< 0.0001';
  return p.toFixed(4);
}

function renderChart(observed, expected, numSides) {
  const ctx = document.getElementById('chart').getContext('2d');

  if (chart) {
    chart.destroy();
  }

  const labels = Array.from({ length: numSides }, (_, i) => (i + 1).toString());

  const total = observed.reduce((a, b) => a + b, 0);

  // Calculate the maximum upper confidence interval to ensure the Y-axis has space for the error bars
  let maxUpper = 0;
  for (let i = 0; i < numSides; i++) {
    const upper = wilsonCI(observed[i], total).upper * total;
    if (upper > maxUpper) maxUpper = upper;
  }
  // Ensure the max Y-axis value accommodates the tallest error bar with a little padding
  const suggestedMax = Math.ceil(maxUpper * 1.05);

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Observed',
          data: observed,
          backgroundColor: 'rgba(74, 108, 247, 0.75)',
          borderColor: 'rgba(74, 108, 247, 1)',
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Expected',
          data: Array(numSides).fill(expected),
          backgroundColor: 'rgba(22, 163, 74, 0.4)',
          borderColor: 'rgba(22, 163, 74, 0.8)',
          borderWidth: 1,
          borderRadius: 3,
          borderDash: [4, 3]
        },
        {
          label: '95% Confidence',
          type: 'line',
          data: [], // Empty data so it only shows in the legend
          borderColor: 'rgba(30, 30, 30, 0.8)',
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          borderWidth: 1.5,
          hidden: !document.getElementById('nerd-toggle').classList.contains('active')
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 14,
            padding: 16,
            font: { size: 12 },
            filter: function(item, chart) {
              // Completely hide the confidence interval legend item when disabled
              if (item.text === '95% Confidence') {
                return !item.hidden;
              }
              return true;
            }
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Face',
            font: { size: 12 }
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: true,
          suggestedMax: suggestedMax,
          title: {
            display: true,
            text: 'Frequency',
            font: { size: 12 }
          },
          grid: { color: 'rgba(0,0,0,0.06)' },
          clip: false // Prevents error bars from getting cut off at the edges
        }
      }
    }
  });

  chart._nerdErrorData = { observed, total };
}

function renderRanking(observed, numSides) {
  const container = document.getElementById('ranking-list');
  const maxCount = Math.max(...observed);
  if (maxCount === 0) {
    container.innerHTML = '';
    return;
  }

  const faces = observed.map((count, i) => ({ face: i + 1, count }));
  faces.sort((a, b) => b.count - a.count || a.face - b.face);

  container.innerHTML = faces.map((f, i) => {
    const pct = (f.count / maxCount) * 100;
    const isTop = i < 3;
    return `
      <div class="rank-item">
        <span class="rank-pos${isTop ? ' top' : ''}">${i + 1}</span>
        <span class="rank-face">Face ${f.face}</span>
        <div class="rank-bar-track">
          <div class="rank-bar-fill" style="width: ${pct.toFixed(0)}%"></div>
        </div>
        <span class="rank-count">${f.count}</span>
      </div>`;
  }).join('');
}

function normalCDF(x) {
  if (x < 0) return 1 - normalCDF(-x);
  return 0.5 + 0.5 * regularizedLowerGammaP(0.5, x * x / 2);
}

function wilsonCI(count, total, z) {
  z = z || 1.96;
  const p = count / total;
  const denom = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denom;
  const margin = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denom;
  return { proportion: p, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

function cramersV(chiSq, total, numSides) {
  if (total === 0 || numSides <= 1) return 0;
  return Math.sqrt(chiSq / (total * (numSides - 1)));
}

function betaCI(count, total) {
  const alpha = 1 + count;
  const beta = 1 + (total - count);
  const mean = alpha / (alpha + beta);
  const variance = alpha * beta / ((alpha + beta) ** 2 * (alpha + beta + 1));
  const sd = Math.sqrt(variance);
  return {
    lower: Math.max(0, (mean - 1.96 * sd) * 100),
    upper: Math.min(100, (mean + 1.96 * sd) * 100)
  };
}

function monteCarloP(observed, numSides, obsChiSq) {
  const total = observed.reduce((a, b) => a + b, 0);
  if (total === 0 || numSides <= 1) return null;
  const expected = total / numSides;
  const iterations = Math.min(5000, Math.max(1000, Math.round(200000 / total)));
  let extremes = 0;
  const sim = new Array(numSides);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < numSides; i++) sim[i] = 0;
    for (let i = 0; i < total; i++) {
      sim[Math.floor(Math.random() * numSides)]++;
    }
    let chiSq = 0;
    for (let i = 0; i < numSides; i++) {
      const diff = sim[i] - expected;
      chiSq += (diff * diff) / expected;
    }
    if (chiSq >= obsChiSq) extremes++;
  }

  return (extremes + 1) / (iterations + 1);
}

function drawErrorBars(ch, observed, total) {
  if (!document.getElementById('nerd-toggle').classList.contains('active')) return;
  if (!ch || !ch.ctx || !ch.scales || !ch.scales.y) return;
  const meta = ch.getDatasetMeta(0);
  if (!meta || !meta.data || meta.hidden) return;

  const ctx = ch.ctx;
  const yScale = ch.scales.y;

  ctx.save();
  // Using a darker, more distinct color so it doesn't look like a grey chart bar
  ctx.strokeStyle = 'rgba(30, 30, 30, 0.8)';
  ctx.lineWidth = 1.5;

  for (let i = 0; i < Math.min(observed.length, meta.data.length); i++) {
    const ci = wilsonCI(observed[i], total);
    // Offset the x position slightly to the right so it doesn't cover the data bar directly
    const barWidth = meta.data[i].width || 20;
    const x = meta.data[i].x + (barWidth * 0.25);
    const yTop = yScale.getPixelForValue(Math.round(ci.upper * total));
    const yBottom = yScale.getPixelForValue(Math.round(ci.lower * total));

    // Draw the vertical line
    ctx.beginPath();
    ctx.moveTo(x, yBottom);
    ctx.lineTo(x, yTop);
    ctx.stroke();

    // Draw upper whisker (made wider so it looks clearly like an error bar)
    ctx.beginPath();
    ctx.moveTo(x - 4, yTop);
    ctx.lineTo(x + 4, yTop);
    ctx.stroke();

    // Draw lower whisker
    ctx.beginPath();
    ctx.moveTo(x - 4, yBottom);
    ctx.lineTo(x + 4, yBottom);
    ctx.stroke();
  }

  ctx.restore();
}

function renderNerdStats(observed, numSides, total, chiSq) {
  const section = document.getElementById('nerd-stats');
  const panel = document.getElementById('nerd-panel');

  document.getElementById('cramers-v').textContent = cramersV(chiSq, total, numSides).toFixed(4);

  const mcP = monteCarloP(observed, numSides, chiSq);
  document.getElementById('nerd-monte-carlo').textContent = mcP !== null ? formatPValue(mcP) : '\u2014';

  const expected = total / numSides;
  const p0 = 1 / numSides;
  const z = 1.96;

  const rows = observed.map((count, i) => {
    const face = i + 1;
    const ci = wilsonCI(count, total, z);
    const bci = betaCI(count, total);
    const se = Math.sqrt(total * p0 * (1 - p0));
    let zBinom = 0;
    if (se > 0) {
      zBinom = (Math.abs(count - expected) - 0.5) / se;
    }
    const binomP = 2 * (1 - normalCDF(Math.max(0, zBinom)));
    const sig = binomP < 0.05;

    return {
      face,
      count,
      proportion: (count / total * 100).toFixed(1),
      ciLower: (ci.lower * 100).toFixed(1),
      ciUpper: (ci.upper * 100).toFixed(1),
      bayesLower: bci.lower.toFixed(1),
      bayesUpper: bci.upper.toFixed(1),
      binomP,
      sig
    };
  });

  const tbody = rows.map(r => `
    <tr>
      <td>${r.face}</td>
      <td>${r.count}</td>
      <td>${r.proportion}%</td>
      <td>${r.ciLower}\u2013${r.ciUpper}%</td>
      <td>${r.bayesLower}\u2013${r.bayesUpper}%</td>
      <td class="${r.sig ? 'nerd-sig' : 'nerd-not-sig'}">${formatPValue(r.binomP)}${r.sig ? ' *' : ''}</td>
    </tr>`).join('');

  document.getElementById('nerd-per-face').innerHTML = `
    <table class="nerd-table">
      <thead><tr>
        <th>Face</th><th>Count</th><th>Proportion</th><th>95% CI</th><th>Bayesian 95% CI</th><th>Binomial p</th>
      </tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;

  section.classList.remove('hidden');
  if (!document.getElementById('nerd-toggle').classList.contains('active')) {
    panel.classList.add('hidden');
  }
}

function downloadExample() {
  const lines = [
    'roll',
    ...Array.from({ length: 100 }, () => Math.floor(Math.random() * 20) + 1)
  ];
  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'example_d20_rolls.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function showError(msg) {
  document.getElementById('results').classList.add('hidden');
  const dropZone = document.getElementById('drop-zone');
  const orig = dropZone.querySelector('.drop-text');
  orig.textContent = msg;
  dropZone.style.borderColor = '#dc2626';
  setTimeout(() => {
    orig.textContent = 'Drop a roll file here';
    dropZone.style.borderColor = '';
  }, 4000);
}

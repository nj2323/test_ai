/**
 * DataStats Pro - Main Application Controller
 * Handles 100% in-memory data parsing, statistical workflow, and Plotly interactive visualizations.
 */
(function () {
  'use strict';

  // Global State
  const state = {
    rawData: [],             // Array of row objects
    columns: [],             // All column headers
    numericColumns: [],      // Filtered numeric column headers
    timeColumn: null,        // Time or sequence column
    currentFileName: 'dummy_sensor_data.xlsx',
    currentSheetName: '측정 데이터',
    statsCache: {},          // Cached descriptive stats per numeric column
    activeTab: 'tab-overview',
    corrMethod: 'pearson',
    regOrder: 1              // 1: linear, 2: polynomial
  };

  // Common Plotly Layout Preset
  const plotlyCommonLayout = {
    font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#334155' },
    margin: { l: 50, r: 30, t: 30, b: 40 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#ffffff',
    hovermode: 'closest',
    autosize: true
  };

  const plotlyConfig = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['lasso2d', 'select2d']
  };

  // ==========================================
  // 1. Lifecycle & Initialization
  // ==========================================

  document.addEventListener('DOMContentLoaded', () => {
    initLucide();
    bindEvents();

    // Try loading embedded dummy sample data first
    if (window.SAMPLE_DATA && Array.isArray(window.SAMPLE_DATA) && window.SAMPLE_DATA.length > 0) {
      loadDataRecords(window.SAMPLE_DATA, 'dummy_sensor_data.xlsx', '측정 데이터');
    } else {
      // Fallback: try fetching the xlsx file
      fetchExcelFile('dummy_sensor_data.xlsx');
    }
  });

  function initLucide() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // ==========================================
  // 2. Data Ingestion & In-Memory Parsing
  // ==========================================

  function bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchTab(tabId);
      });
    });

    // Load dummy button
    const btnLoadDummy = document.getElementById('btnLoadDummy');
    if (btnLoadDummy) {
      btnLoadDummy.addEventListener('click', () => {
        if (window.SAMPLE_DATA) {
          loadDataRecords(window.SAMPLE_DATA, 'dummy_sensor_data.xlsx', '측정 데이터');
        } else {
          fetchExcelFile('dummy_sensor_data.xlsx');
        }
      });
    }

    // File input upload
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
      fileInput.addEventListener('change', handleFileInput);
    }

    // Drag and drop zone
    const dropZone = document.getElementById('dropZone');
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        processUploadedFile(e.dataTransfer.files[0]);
      }
    });

    // Export CSV
    const btnExportCsv = document.getElementById('btnExportCsv');
    if (btnExportCsv) {
      btnExportCsv.addEventListener('click', exportCleanCsv);
    }

    // Print Report
    const btnPrintReport = document.getElementById('btnPrintReport');
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => window.print());
    }

    // Tab 2: Distribution variable change
    const distVarSelect = document.getElementById('distVarSelect');
    if (distVarSelect) {
      distVarSelect.addEventListener('change', () => renderDistributionTab());
    }

    // Tab 3: Correlation controls
    const btnMethodPearson = document.getElementById('btnMethodPearson');
    const btnMethodSpearman = document.getElementById('btnMethodSpearman');
    if (btnMethodPearson && btnMethodSpearman) {
      btnMethodPearson.addEventListener('click', () => {
        state.corrMethod = 'pearson';
        btnMethodPearson.className = 'px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-indigo-700 shadow-xs border border-indigo-100';
        btnMethodSpearman.className = 'px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900';
        document.getElementById('corrMethodLabel').innerText = 'Pearson r';
        renderCorrelationTab();
      });
      btnMethodSpearman.addEventListener('click', () => {
        state.corrMethod = 'spearman';
        btnMethodSpearman.className = 'px-3 py-1.5 rounded-md text-xs font-semibold bg-white text-indigo-700 shadow-xs border border-indigo-100';
        btnMethodPearson.className = 'px-3 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:text-slate-900';
        document.getElementById('corrMethodLabel').innerText = 'Spearman ρ';
        renderCorrelationTab();
      });
    }

    const corrVarX = document.getElementById('corrVarX');
    const corrVarY = document.getElementById('corrVarY');
    if (corrVarX && corrVarY) {
      corrVarX.addEventListener('change', () => renderCorrScatter());
      corrVarY.addEventListener('change', () => renderCorrScatter());
    }

    // Tab 4: Regression controls
    const regVarX = document.getElementById('regVarX');
    const regVarY = document.getElementById('regVarY');
    if (regVarX && regVarY) {
      regVarX.addEventListener('change', () => renderRegressionTab());
      regVarY.addEventListener('change', () => renderRegressionTab());
    }

    const btnRegLinear = document.getElementById('btnRegLinear');
    const btnRegPoly2 = document.getElementById('btnRegPoly2');
    if (btnRegLinear && btnRegPoly2) {
      btnRegLinear.addEventListener('click', () => {
        state.regOrder = 1;
        btnRegLinear.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-white text-indigo-700 shadow-xs';
        btnRegPoly2.className = 'px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900';
        renderRegressionTab();
      });
      btnRegPoly2.addEventListener('click', () => {
        state.regOrder = 2;
        btnRegPoly2.className = 'px-2.5 py-1 rounded text-xs font-semibold bg-white text-indigo-700 shadow-xs';
        btnRegLinear.className = 'px-2.5 py-1 rounded text-xs font-medium text-slate-600 hover:text-slate-900';
        renderRegressionTab();
      });
    }

    // Tab 5: Hypothesis subtabs
    bindHypothesisEvents();

    // Tab 6: SPC controls
    const spcVarSelect = document.getElementById('spcVarSelect');
    const chkSma5 = document.getElementById('chkSma5');
    const chkSma20 = document.getElementById('chkSma20');
    if (spcVarSelect) spcVarSelect.addEventListener('change', () => renderSpcTab());
    if (chkSma5) chkSma5.addEventListener('change', () => renderSpcTab());
    if (chkSma20) chkSma20.addEventListener('change', () => renderSpcTab());

    // Window resize handler for Plotly
    window.addEventListener('resize', () => {
      document.querySelectorAll('.chart-container').forEach(el => {
        if (el && el.data) {
          Plotly.Plots.resize(el);
        }
      });
    });
  }

  function switchTab(tabId) {
    state.activeTab = tabId;

    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabId) {
        btn.classList.add('active');
        btn.classList.remove('text-slate-600', 'border-transparent');
      } else {
        btn.classList.remove('active');
        btn.classList.add('text-slate-600', 'border-transparent');
      }
    });

    // Update panels
    document.querySelectorAll('.tab-content').forEach(panel => {
      if (panel.id === tabId) {
        panel.classList.remove('hidden');
        panel.classList.add('block');
      } else {
        panel.classList.add('hidden');
        panel.classList.remove('block');
      }
    });

    // Trigger chart render or resize for the active tab
    renderActiveTab();
  }

  function renderActiveTab() {
    setTimeout(() => {
      switch (state.activeTab) {
        case 'tab-overview':
          renderOverviewTab();
          break;
        case 'tab-distribution':
          renderDistributionTab();
          break;
        case 'tab-correlation':
          renderCorrelationTab();
          break;
        case 'tab-regression':
          renderRegressionTab();
          break;
        case 'tab-hypothesis':
          renderHypothesisTab();
          break;
        case 'tab-spc':
          renderSpcTab();
          break;
        case 'tab-raw':
          renderRawDataTable();
          break;
      }
      initLucide();
    }, 50);
  }

  // Handle uploaded file
  function handleFileInput(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFile(files[0]);
    }
  }

  function processUploadedFile(file) {
    const fileName = file.name;
    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: null });

        if (json.length === 0) {
          alert('선택한 파일에 데이터가 비어 있습니다.');
          return;
        }

        loadDataRecords(json, fileName, sheetName);
      } catch (err) {
        console.error('File parsing error:', err);
        alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Fetch local Excel file (if served via local HTTP server)
  function fetchExcelFile(url) {
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error('Network error');
        return res.arrayBuffer();
      })
      .then(buffer => {
        const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
        loadDataRecords(json, 'dummy_sensor_data.xlsx', sheetName);
      })
      .catch(err => {
        console.log('Direct fetch not possible (file:// mode), checking sample-data fallback...');
        if (window.SAMPLE_DATA) {
          loadDataRecords(window.SAMPLE_DATA, 'dummy_sensor_data.xlsx', '측정 데이터');
        }
      });
  }

  /**
   * Load clean records, filter out trailing summary rows, infer column types
   */
  function loadDataRecords(records, fileName, sheetName) {
    if (!records || records.length === 0) return;

    // Filter out formula/summary rows at bottom (e.g. '평균 (Average)', '최대값 (Max)')
    const cleanRecords = records.filter(row => {
      const keys = Object.keys(row);
      if (keys.length === 0) return false;
      const firstVal = String(row[keys[0]] || '').trim();
      if (firstVal.includes('평균') || firstVal.includes('최대') || firstVal.includes('최소') || firstVal.includes('합계') || firstVal.includes('Average')) {
        return false;
      }
      // Check if at least one column has a valid numeric value
      let hasNumeric = false;
      for (const k of keys) {
        const v = row[k];
        if (typeof v === 'number' && !isNaN(v)) {
          hasNumeric = true;
          break;
        }
      }
      return hasNumeric;
    });

    if (cleanRecords.length === 0) {
      alert('유효한 데이터 행을 찾을 수 없습니다.');
      return;
    }

    state.rawData = cleanRecords;
    state.currentFileName = fileName;
    state.currentSheetName = sheetName;
    state.columns = Object.keys(cleanRecords[0]);

    // Detect numeric and time columns
    state.numericColumns = [];
    state.timeColumn = null;

    state.columns.forEach(col => {
      let numCount = 0;
      let totalCount = 0;
      for (const r of cleanRecords) {
        const val = r[col];
        if (val !== null && val !== undefined && val !== '') {
          totalCount++;
          if (typeof val === 'number' || (!isNaN(parseFloat(val)) && isFinite(val))) {
            numCount++;
          }
        }
      }

      const colLower = col.toLowerCase();
      if (colLower.includes('시각') || colLower.includes('시간') && !colLower.includes('경과') || colLower.includes('date') || colLower.includes('time')) {
        if (!state.timeColumn) state.timeColumn = col;
      }

      if (totalCount > 0 && numCount / totalCount >= 0.7) {
        state.numericColumns.push(col);
      }
    });

    // If no time column detected, use first column or row index
    if (!state.timeColumn) {
      state.timeColumn = state.columns[0];
    }

    // Precompute descriptive stats for each numeric column
    state.statsCache = {};
    state.numericColumns.forEach(col => {
      const values = cleanRecords.map(r => r[col]);
      state.statsCache[col] = StatsEngine.describe(values);
    });

    // Update metadata UI
    updateMetaUI();

    // Populate dropdowns in all tabs
    populateDropdowns();

    // Render active tab
    renderActiveTab();
  }

  function updateMetaUI() {
    document.getElementById('metaFileName').innerText = state.currentFileName;
    document.getElementById('metaSheetName').innerText = state.currentSheetName;
    document.getElementById('metaDataInfo').innerText =
      `총 ${state.rawData.length}개 관측치 · ${state.numericColumns.length}개 수치형 변수 · 하단 요약행 자동 정제 완료`;

    const badgeContainer = document.getElementById('columnBadges');
    badgeContainer.innerHTML = state.numericColumns.map(col => `
      <span class="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono border border-slate-200">${col}</span>
    `).join('');
  }

  function populateDropdowns() {
    // Tab 2: Distribution
    const distVarSelect = document.getElementById('distVarSelect');
    distVarSelect.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    // Select a good default: '온도 참값(°C)' or 4th numeric col
    if (state.numericColumns.includes('온도 참값(°C)')) {
      distVarSelect.value = '온도 참값(°C)';
    }

    // Tab 3: Correlation
    const corrVarX = document.getElementById('corrVarX');
    const corrVarY = document.getElementById('corrVarY');
    corrVarX.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    corrVarY.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (state.numericColumns.includes('온도센서 원시값')) corrVarX.value = '온도센서 원시값';
    if (state.numericColumns.includes('온도 참값(°C)')) corrVarY.value = '온도 참값(°C)';

    // Tab 4: Regression
    const regVarX = document.getElementById('regVarX');
    const regVarY = document.getElementById('regVarY');
    regVarX.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    regVarY.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (state.numericColumns.includes('온도센서 원시값')) regVarX.value = '온도센서 원시값';
    if (state.numericColumns.includes('온도 참값(°C)')) regVarY.value = '온도 참값(°C)';

    // Tab 5: Hypothesis
    const ttest1Var = document.getElementById('ttest1Var');
    ttest1Var.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (state.numericColumns.includes('온도 참값(°C)')) ttest1Var.value = '온도 참값(°C)';

    const ttest2VarA = document.getElementById('ttest2VarA');
    const ttest2VarB = document.getElementById('ttest2VarB');
    ttest2VarA.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    ttest2VarB.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (state.numericColumns.length >= 2) {
      ttest2VarA.value = state.numericColumns[0];
      ttest2VarB.value = state.numericColumns[1];
    }

    const anovaContainer = document.getElementById('anovaVarCheckboxes');
    anovaContainer.innerHTML = state.numericColumns.map((col, idx) => `
      <label class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs cursor-pointer hover:bg-slate-100">
        <input type="checkbox" value="${col}" class="anova-chk rounded text-indigo-600 focus:ring-indigo-500" ${idx < 3 ? 'checked' : ''}>
        <span>${col}</span>
      </label>
    `).join('');

    // Tab 6: SPC
    const spcVarSelect = document.getElementById('spcVarSelect');
    spcVarSelect.innerHTML = state.numericColumns.map(col => `<option value="${col}">${col}</option>`).join('');
    if (state.numericColumns.includes('온도 참값(°C)')) {
      spcVarSelect.value = '온도 참값(°C)';
    } else if (state.numericColumns.includes('압력 (kPa)')) {
      spcVarSelect.value = '압력 (kPa)';
    }
  }

  // ==========================================
  // 3. Tab 1: Overview & Descriptive Stats
  // ==========================================

  function renderOverviewTab() {
    if (state.numericColumns.length === 0) return;

    // 1. KPI Cards (up to 6 cards)
    const kpiContainer = document.getElementById('kpiCardsContainer');
    const displayCols = state.numericColumns.slice(0, 6);

    kpiContainer.innerHTML = displayCols.map(col => {
      const st = state.statsCache[col];
      if (!st) return '';
      return `
        <div class="bg-white p-4 rounded-xl card-shadow border border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-slate-500 truncate" title="${col}">${col}</span>
            <span class="w-2 h-2 rounded-full bg-indigo-500"></span>
          </div>
          <div class="mt-2 flex items-baseline justify-between">
            <span class="text-xl font-bold font-mono text-slate-900">${st.mean.toFixed(2)}</span>
            <span class="text-[11px] text-slate-400">Avg</span>
          </div>
          <div class="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono">
            <span>s: ${st.std.toFixed(2)}</span>
            <span>R: ${st.range.toFixed(2)}</span>
          </div>
        </div>
      `;
    }).join('');

    // 2. Comprehensive Descriptive Table
    const tbody = document.querySelector('#descStatsTable tbody');
    tbody.innerHTML = state.numericColumns.map(col => {
      const st = state.statsCache[col];
      if (!st) return '';
      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-4 py-2.5 font-sans font-semibold text-slate-900">${col}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.count}</td>
          <td class="px-3 py-2.5 text-right font-bold text-indigo-700">${st.mean.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-800">${st.std.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-800">${st.median.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.min.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.q1.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.q3.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.max.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.iqr.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right ${Math.abs(st.skewness) > 0.5 ? 'text-amber-600 font-semibold' : 'text-slate-600'}">${st.skewness.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right ${Math.abs(st.kurtosis) > 1.0 ? 'text-amber-600 font-semibold' : 'text-slate-600'}">${st.kurtosis.toFixed(3)}</td>
          <td class="px-3 py-2.5 text-right text-slate-600">${st.cv.toFixed(2)}%</td>
        </tr>
      `;
    }).join('');

    // 3. Multi-Box Plot (Z-Score Standardized)
    const boxTraces = state.numericColumns.map(col => {
      const st = state.statsCache[col];
      const rawVals = state.rawData.map(r => r[col]);
      const zVals = rawVals.map(v => (st.std !== 0 ? (v - st.mean) / st.std : 0));
      return {
        y: zVals,
        name: col,
        type: 'box',
        boxpoints: 'outliers',
        jitter: 0.3,
        pointpos: -1.8,
        marker: { size: 4 }
      };
    });

    const boxLayout = {
      ...plotlyCommonLayout,
      yaxis: { title: 'Z-Score (표준화 점수)', zeroline: true, zerolinecolor: '#cbd5e1' },
      showlegend: false,
      margin: { l: 60, r: 20, t: 20, b: 60 }
    };

    Plotly.newPlot('chartOverviewBox', boxTraces, boxLayout, plotlyConfig);
  }

  // ==========================================
  // 4. Tab 2: Distribution & Normality
  // ==========================================

  function renderDistributionTab() {
    const varName = document.getElementById('distVarSelect').value;
    if (!varName) return;

    const values = state.rawData.map(r => r[varName]);
    const cleanVals = StatsEngine.cleanNumericArray(values);
    const st = state.statsCache[varName] || StatsEngine.describe(cleanVals);
    const jb = StatsEngine.jarqueBeraTest(cleanVals);

    // Update Normality Badge
    const badge = document.getElementById('distNormalityBadge');
    if (jb.isNormal) {
      badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200';
      badge.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> 정규성 만족 (Jarque-Bera p = ${jb.pValue.toFixed(4)} ≥ 0.05)`;
    } else {
      badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200';
      badge.innerHTML = `<i data-lucide="alert-circle" class="w-4 h-4"></i> 비정규분포 (Jarque-Bera p = ${jb.pValue.toFixed(4)} < 0.05)`;
    }

    // 1. Histogram + Normal Fit Curve
    const minVal = st.min;
    const maxVal = st.max;
    const step = (maxVal - minVal) / 80;
    const normalX = [];
    const normalY = [];

    for (let x = minVal; x <= maxVal; x += step) {
      normalX.push(x);
      // Scaled normal pdf to match histogram count
      const pdf = StatsEngine.normalPdf(x, st.mean, st.std);
      // binWidth approx: range / 20
      const binWidth = (maxVal - minVal) / 20;
      normalY.push(pdf * st.count * binWidth);
    }

    const histTrace = {
      x: cleanVals,
      type: 'histogram',
      name: '관측 빈도',
      nbinsx: 20,
      marker: { color: 'rgba(99, 102, 241, 0.65)', line: { color: '#4f46e5', width: 1.2 } }
    };

    const curveTrace = {
      x: normalX,
      y: normalY,
      type: 'scatter',
      mode: 'lines',
      name: '정규분포 곡선',
      line: { color: '#ef4444', width: 2.5 }
    };

    Plotly.newPlot('chartDistHist', [histTrace, curveTrace], {
      ...plotlyCommonLayout,
      xaxis: { title: varName },
      yaxis: { title: '빈도수 (Count)' },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.15 }
    }, plotlyConfig);

    // 2. Box Plot & Violin
    const boxTrace = {
      y: cleanVals,
      type: 'box',
      name: varName,
      boxpoints: 'all',
      jitter: 0.4,
      pointpos: -1.8,
      marker: { color: '#4f46e5', size: 4 },
      boxmean: 'sd'
    };

    Plotly.newPlot('chartDistBox', [boxTrace], {
      ...plotlyCommonLayout,
      yaxis: { title: varName },
      showlegend: false
    }, plotlyConfig);

    // 3. Q-Q Plot
    const qqData = StatsEngine.qqPlotData(cleanVals);
    const qqScatter = {
      x: qqData.theoretical,
      y: qqData.actual,
      mode: 'markers',
      name: '관측 분위수',
      marker: { color: '#4f46e5', size: 6 }
    };

    const minQ = Math.min(st.min, Math.min(...qqData.theoretical));
    const maxQ = Math.max(st.max, Math.max(...qqData.theoretical));
    const qqLine = {
      x: [minQ, maxQ],
      y: [minQ, maxQ],
      mode: 'lines',
      name: '이론적 정규선',
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    };

    Plotly.newPlot('chartDistQQ', [qqScatter, qqLine], {
      ...plotlyCommonLayout,
      xaxis: { title: '이론적 분위수 (Theoretical Quantiles)' },
      yaxis: { title: '표본 분위수 (Sample Quantiles)' },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.15 }
    }, plotlyConfig);

    // 4. Normality Details Card
    const detailsContainer = document.getElementById('distStatsDetails');
    detailsContainer.innerHTML = `
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <span class="text-xs font-semibold text-slate-600">Jarque-Bera 통계량 (JB):</span>
        <span class="text-xs font-mono font-bold text-slate-900">${jb.statistic.toFixed(4)}</span>
      </div>
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <span class="text-xs font-semibold text-slate-600">정규성 유의확률 (p-value):</span>
        <span class="text-xs font-mono font-bold ${jb.pValue >= 0.05 ? 'text-emerald-600' : 'text-amber-600'}">${jb.pValue < 0.0001 ? '< 0.0001' : jb.pValue.toFixed(4)}</span>
      </div>
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <span class="text-xs font-semibold text-slate-600">왜도 (Skewness, 비대칭도):</span>
        <span class="text-xs font-mono font-bold text-slate-900">${st.skewness.toFixed(4)} (${Math.abs(st.skewness) < 0.5 ? '대칭적 분포' : (st.skewness > 0 ? '우측 꼬리' : '좌측 꼬리')})</span>
      </div>
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <span class="text-xs font-semibold text-slate-600">첨도 (Kurtosis, 꼬리 두께):</span>
        <span class="text-xs font-mono font-bold text-slate-900">${st.kurtosis.toFixed(4)} (${Math.abs(st.kurtosis) < 1.0 ? '표준 정규 형태' : (st.kurtosis > 0 ? '뾰족함' : '완만함')})</span>
      </div>
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
        <span class="text-xs font-semibold text-slate-600">변동계수 (CV):</span>
        <span class="text-xs font-mono font-bold text-slate-900">${st.cv.toFixed(2)}%</span>
      </div>
    `;

    initLucide();
  }

  // ==========================================
  // 5. Tab 3: Correlation & Heatmap
  // ==========================================

  function renderCorrelationTab() {
    if (state.numericColumns.length === 0) return;

    const dataObj = {};
    state.numericColumns.forEach(col => {
      dataObj[col] = state.rawData.map(r => r[col]);
    });

    const matrix = StatsEngine.correlationMatrix(dataObj, state.numericColumns, state.corrMethod);

    // Heatmap Trace
    const heatmapTrace = {
      z: matrix.z,
      x: matrix.labels,
      y: matrix.labels,
      type: 'heatmap',
      colorscale: [
        [0.0, '#2563eb'],   // Blue (-1)
        [0.5, '#f8fafc'],   // White (0)
        [1.0, '#dc2626']    // Red (+1)
      ],
      zmin: -1.0,
      zmax: 1.0,
      text: matrix.z.map(row => row.map(v => v.toFixed(3))),
      texttemplate: '%{text}',
      textfont: { family: 'monospace', size: 11 },
      colorbar: { title: '상관계수 (r)', len: 0.9 }
    };

    const heatmapLayout = {
      ...plotlyCommonLayout,
      xaxis: { tickangle: -25 },
      yaxis: { autorange: 'reversed' },
      margin: { l: 90, r: 20, t: 20, b: 80 }
    };

    Plotly.newPlot('chartCorrHeatmap', [heatmapTrace], heatmapLayout, plotlyConfig);

    // Scatter Plot
    renderCorrScatter();
  }

  function renderCorrScatter() {
    const varX = document.getElementById('corrVarX').value;
    const varY = document.getElementById('corrVarY').value;
    if (!varX || !varY) return;

    const arrX = state.rawData.map(r => r[varX]);
    const arrY = state.rawData.map(r => r[varY]);

    const rVal = state.corrMethod === 'spearman'
      ? StatsEngine.spearman(arrX, arrY)
      : StatsEngine.pearson(arrX, arrY);

    const badge = document.getElementById('corrValueBadge');
    badge.innerText = `r = ${rVal.toFixed(4)}`;

    // Color code r value
    if (Math.abs(rVal) >= 0.7) {
      badge.className = 'text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200';
    } else if (Math.abs(rVal) >= 0.4) {
      badge.className = 'text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200';
    } else {
      badge.className = 'text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200';
    }

    // Linear fit line
    const reg = StatsEngine.linearRegression(arrX, arrY);

    const scatterTrace = {
      x: arrX,
      y: arrY,
      mode: 'markers',
      name: '관측치',
      marker: { color: 'rgba(79, 70, 229, 0.7)', size: 7, line: { color: '#4f46e5', width: 1 } }
    };

    const traces = [scatterTrace];
    if (reg) {
      // Sort X for line
      const sortedPairs = arrX.map((x, i) => ({ x, y: reg.fitted[i] })).sort((a, b) => a.x - b.x);
      traces.push({
        x: sortedPairs.map(p => p.x),
        y: sortedPairs.map(p => p.y),
        mode: 'lines',
        name: '선형 추세선',
        line: { color: '#ef4444', width: 2 }
      });
    }

    Plotly.newPlot('chartCorrScatter', traces, {
      ...plotlyCommonLayout,
      xaxis: { title: varX },
      yaxis: { title: varY },
      showlegend: false
    }, plotlyConfig);

    // Interpretation box
    let strength = '';
    const absR = Math.abs(rVal);
    if (absR >= 0.8) strength = '매우 강한';
    else if (absR >= 0.6) strength = '강한';
    else if (absR >= 0.4) strength = '보통의';
    else if (absR >= 0.2) strength = '약한';
    else strength = '거의 무관한(선형 관계 없음)';

    const direction = rVal > 0 ? '양(+)의 상관관계' : (rVal < 0 ? '음(-)의 상관관계' : '상관관계 없음');

    document.getElementById('corrInterpretationBox').innerHTML = `
      <p class="font-semibold text-slate-800">📊 상관분석 해석:</p>
      <p class="mt-1">두 변수간 ${state.corrMethod === 'spearman' ? '스피어만 순위' : '피어슨 선형'} 상관계수는 <strong>${rVal.toFixed(4)}</strong>로, <strong>${strength} ${direction}</strong>를 나타냅니다.</p>
    `;
  }

  // ==========================================
  // 6. Tab 4: Regression & Residuals
  // ==========================================

  function renderRegressionTab() {
    const varX = document.getElementById('regVarX').value;
    const varY = document.getElementById('regVarY').value;
    if (!varX || !varY) return;

    const arrX = state.rawData.map(r => r[varX]);
    const arrY = state.rawData.map(r => r[varY]);

    const isPoly = state.regOrder === 2;
    const model = isPoly ? StatsEngine.polyRegression2(arrX, arrY) : StatsEngine.linearRegression(arrX, arrY);

    if (!model) return;

    // Update KPIs
    document.getElementById('regFormulaText').innerText = model.equation;
    document.getElementById('regR2').innerText = model.r2.toFixed(4);
    document.getElementById('regAdjR2').innerText = (model.adjR2 || model.r2).toFixed(4);
    document.getElementById('regRmse').innerText = (model.rmse || Math.sqrt(StatsEngine.mean(arrY.map((y, i) => Math.pow(y - model.fitted[i], 2))))).toFixed(4);

    const pValText = isPoly ? 'N/A' : (model.pValue < 0.001 ? '< 0.001' : model.pValue.toFixed(4));
    document.getElementById('regPVal').innerText = pValText;

    const signBadge = document.getElementById('regSignificanceBadge');
    if (!isPoly && model.pValue < 0.05) {
      signBadge.innerText = '통계적으로 유의미함 (p < 0.05)';
      signBadge.className = 'text-[11px] font-semibold text-emerald-600 mt-1';
    } else if (!isPoly) {
      signBadge.innerText = '유의하지 않음 (p ≥ 0.05)';
      signBadge.className = 'text-[11px] font-semibold text-amber-600 mt-1';
    } else {
      signBadge.innerText = '2차 비선형 모델 적합';
      signBadge.className = 'text-[11px] font-semibold text-indigo-600 mt-1';
    }

    // 1. Main Fit Plot
    const scatterTrace = {
      x: arrX,
      y: arrY,
      mode: 'markers',
      name: '관측 데이터',
      marker: { color: 'rgba(79, 70, 229, 0.65)', size: 6 }
    };

    const sortedIndices = arrX.map((x, i) => i).sort((a, b) => arrX[a] - arrX[b]);
    const sortedX = sortedIndices.map(i => arrX[i]);
    const sortedFitted = sortedIndices.map(i => model.fitted[i]);

    const lineTrace = {
      x: sortedX,
      y: sortedFitted,
      mode: 'lines',
      name: isPoly ? '2차 다항 회귀곡선' : '선형 회귀선',
      line: { color: '#ef4444', width: 2.5 }
    };

    Plotly.newPlot('chartRegMain', [scatterTrace, lineTrace], {
      ...plotlyCommonLayout,
      xaxis: { title: varX },
      yaxis: { title: varY },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.15 }
    }, plotlyConfig);

    // 2. Residuals Plot
    const residuals = arrY.map((y, i) => y - model.fitted[i]);
    const residualTrace = {
      x: model.fitted,
      y: residuals,
      mode: 'markers',
      name: '잔차 (Residuals)',
      marker: { color: 'rgba(14, 165, 233, 0.7)', size: 6 }
    };

    const minFitted = Math.min(...model.fitted);
    const maxFitted = Math.max(...model.fitted);
    const zeroLine = {
      x: [minFitted, maxFitted],
      y: [0, 0],
      mode: 'lines',
      name: '기준선 (0)',
      line: { color: '#94a3b8', width: 1.5, dash: 'dash' }
    };

    Plotly.newPlot('chartRegResiduals', [residualTrace, zeroLine], {
      ...plotlyCommonLayout,
      xaxis: { title: '예측 적합값 (Fitted Values ŷ)' },
      yaxis: { title: '잔차 (Residuals e = y - ŷ)' },
      showlegend: false
    }, plotlyConfig);
  }

  // ==========================================
  // 7. Tab 5: Hypothesis Testing
  // ==========================================

  function bindHypothesisEvents() {
    const btnT1 = document.getElementById('subtab-t1-btn');
    const btnT2 = document.getElementById('subtab-t2-btn');
    const btnAnova = document.getElementById('subtab-anova-btn');

    const panelT1 = document.getElementById('subtab-t1-panel');
    const panelT2 = document.getElementById('subtab-t2-panel');
    const panelAnova = document.getElementById('subtab-anova-panel');

    btnT1.addEventListener('click', () => {
      btnT1.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors';
      btnT2.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      btnAnova.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      panelT1.classList.remove('hidden');
      panelT2.classList.add('hidden');
      panelAnova.classList.add('hidden');
      renderTTest1();
    });

    btnT2.addEventListener('click', () => {
      btnT2.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors';
      btnT1.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      btnAnova.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      panelT2.classList.remove('hidden');
      panelT1.classList.add('hidden');
      panelAnova.classList.add('hidden');
      renderTTest2();
    });

    btnAnova.addEventListener('click', () => {
      btnAnova.className = 'px-4 py-2 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 transition-colors';
      btnT1.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      btnT2.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors';
      panelAnova.classList.remove('hidden');
      panelT1.classList.add('hidden');
      panelT2.classList.add('hidden');
      renderAnova();
    });

    document.getElementById('btnRunTTest1').addEventListener('click', renderTTest1);
    document.getElementById('btnRunTTest2').addEventListener('click', renderTTest2);
    document.getElementById('btnRunAnova').addEventListener('click', renderAnova);
  }

  function renderHypothesisTab() {
    renderTTest1();
  }

  function renderTTest1() {
    const varName = document.getElementById('ttest1Var').value;
    const testMu = parseFloat(document.getElementById('ttest1Mu').value) || 0;
    if (!varName) return;

    const vals = state.rawData.map(r => r[varName]);
    const res = StatsEngine.oneSampleTTest(vals, testMu);
    if (!res) return;

    const card = document.getElementById('ttest1ResultCard');
    card.innerHTML = `
      <div>
        <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <i data-lucide="check-square" class="w-4 h-4 text-indigo-600"></i>
          단일표본 t-검정 결과 요약
        </h4>
        <div class="space-y-2.5 text-xs font-mono">
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">표본 크기 (N):</span>
            <span class="font-bold text-slate-800">${res.n}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">표본 평균 (x̄):</span>
            <span class="font-bold text-indigo-600">${res.mean.toFixed(3)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">기준값 (μ₀):</span>
            <span class="font-bold text-slate-800">${res.testMean.toFixed(3)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">t-통계량 (df=${res.df}):</span>
            <span class="font-bold text-slate-800">${res.tStat.toFixed(4)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">유의확률 (p-value):</span>
            <span class="font-bold ${res.isSignificant ? 'text-red-600' : 'text-emerald-600'}">${res.pValue < 0.0001 ? '< 0.0001' : res.pValue.toFixed(4)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">95% 신뢰구간 (CI):</span>
            <span class="font-bold text-slate-800">[${res.ci95[0].toFixed(2)}, ${res.ci95[1].toFixed(2)}]</span>
          </div>
        </div>
      </div>
      <div class="mt-4 p-3 rounded-lg ${res.isSignificant ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'} text-xs font-semibold">
        ${res.isSignificant
          ? `⚠️ 귀무가설 기각 (p < 0.05): 표본 평균과 기준값(${res.testMean}) 간에 통계적으로 유의미한 차이가 있습니다.`
          : `✅ 귀무가설 채택 (p ≥ 0.05): 표본 평균과 기준값(${res.testMean}) 간에 유의미한 차이가 없습니다.`
        }
      </div>
    `;

    // Visual Chart: Box Plot of sample with mu line
    const boxTrace = {
      y: StatsEngine.cleanNumericArray(vals),
      type: 'box',
      name: varName,
      boxmean: true,
      marker: { color: '#4f46e5' }
    };

    const muLine = {
      x: [-0.5, 0.5],
      y: [testMu, testMu],
      mode: 'lines',
      name: `검정 기준값 μ₀ = ${testMu}`,
      line: { color: '#ef4444', width: 2.5, dash: 'dash' }
    };

    Plotly.newPlot('chartTTest1', [boxTrace, muLine], {
      ...plotlyCommonLayout,
      yaxis: { title: varName },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.15 }
    }, plotlyConfig);

    initLucide();
  }

  function renderTTest2() {
    const varA = document.getElementById('ttest2VarA').value;
    const varB = document.getElementById('ttest2VarB').value;
    if (!varA || !varB) return;

    const valsA = state.rawData.map(r => r[varA]);
    const valsB = state.rawData.map(r => r[varB]);

    const res = StatsEngine.twoSampleTTest(valsA, valsB);
    if (!res) return;

    const card = document.getElementById('ttest2ResultCard');
    card.innerHTML = `
      <div>
        <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <i data-lucide="git-compare" class="w-4 h-4 text-indigo-600"></i>
          독립 2표본 Welch's t-검정 결과
        </h4>
        <div class="space-y-2.5 text-xs font-mono">
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">${varA} 평균:</span>
            <span class="font-bold text-indigo-600">${res.m1.toFixed(3)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">${varB} 평균:</span>
            <span class="font-bold text-indigo-600">${res.m2.toFixed(3)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">평균 차이 (Diff):</span>
            <span class="font-bold text-slate-800">${res.diff.toFixed(3)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">t-통계량 (df=${res.df}):</span>
            <span class="font-bold text-slate-800">${res.tStat.toFixed(4)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">유의확률 (p-value):</span>
            <span class="font-bold ${res.isSignificant ? 'text-red-600' : 'text-emerald-600'}">${res.pValue < 0.0001 ? '< 0.0001' : res.pValue.toFixed(4)}</span>
          </div>
        </div>
      </div>
      <div class="mt-4 p-3 rounded-lg ${res.isSignificant ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'} text-xs font-semibold">
        ${res.isSignificant
          ? `⚠️ 귀무가설 기각 (p < 0.05): 두 집단 간 평균에 유의미한 차이가 존재합니다.`
          : `✅ 귀무가설 채택 (p ≥ 0.05): 두 집단 간 평균 차이가 통계적으로 유의미하지 않습니다.`
        }
      </div>
    `;

    const traceA = { y: StatsEngine.cleanNumericArray(valsA), type: 'box', name: varA, marker: { color: '#4f46e5' } };
    const traceB = { y: StatsEngine.cleanNumericArray(valsB), type: 'box', name: varB, marker: { color: '#0ea5e9' } };

    Plotly.newPlot('chartTTest2', [traceA, traceB], {
      ...plotlyCommonLayout,
      showlegend: false
    }, plotlyConfig);

    initLucide();
  }

  function renderAnova() {
    const selectedCols = Array.from(document.querySelectorAll('.anova-chk:checked')).map(el => el.value);
    if (selectedCols.length < 2) {
      alert('ANOVA를 실행하려면 최소 2개 이상의 변수를 선택해야 합니다.');
      return;
    }

    const groups = selectedCols.map(col => state.rawData.map(r => r[col]));
    const res = StatsEngine.oneWayAnova(groups);
    if (!res) return;

    const card = document.getElementById('anovaResultCard');
    card.innerHTML = `
      <div>
        <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <i data-lucide="layers" class="w-4 h-4 text-indigo-600"></i>
          일원배치 분산분석(ANOVA) 요약
        </h4>
        <div class="space-y-2 text-xs font-mono">
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">집단 간 제곱합 (SSb, df=${res.dfBetween}):</span>
            <span class="font-bold text-slate-800">${res.ssBetween.toFixed(2)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">집단 내 제곱합 (SSw, df=${res.dfWithin}):</span>
            <span class="font-bold text-slate-800">${res.ssWithin.toFixed(2)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">F-통계량:</span>
            <span class="font-bold text-indigo-700 text-sm">${res.fStat.toFixed(4)}</span>
          </div>
          <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200">
            <span class="text-slate-600">유의확률 (p-value):</span>
            <span class="font-bold ${res.isSignificant ? 'text-red-600' : 'text-emerald-600'}">${res.pValue < 0.0001 ? '< 0.0001' : res.pValue.toFixed(4)}</span>
          </div>
        </div>
      </div>
      <div class="mt-4 p-3 rounded-lg ${res.isSignificant ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'} text-xs font-semibold">
        ${res.isSignificant
          ? `⚠️ 귀무가설 기각 (p < 0.05): 최소 한 집단 이상의 평균이 다른 집단과 통계적으로 유의미하게 다릅니다.`
          : `✅ 귀무가설 채택 (p ≥ 0.05): 모든 집단의 평균이 동일하다는 가설을 기각할 수 없습니다.`
        }
      </div>
    `;

    // Plot Mean with Std Error Bars
    const xLabels = selectedCols;
    const means = selectedCols.map(col => state.statsCache[col] ? state.statsCache[col].mean : 0);
    const errors = selectedCols.map(col => {
      const st = state.statsCache[col];
      return st ? st.std / Math.sqrt(st.count) : 0;
    });

    const anovaTrace = {
      x: xLabels,
      y: means,
      type: 'bar',
      error_y: {
        type: 'data',
        array: errors,
        visible: true,
        color: '#ef4444'
      },
      marker: { color: 'rgba(99, 102, 241, 0.7)' }
    };

    Plotly.newPlot('chartAnova', [anovaTrace], {
      ...plotlyCommonLayout,
      yaxis: { title: '평균값 (Mean ± SE)' },
      showlegend: false
    }, plotlyConfig);

    initLucide();
  }

  // ==========================================
  // 8. Tab 6: SPC Control Charts & Outliers
  // ==========================================

  function renderSpcTab() {
    const varName = document.getElementById('spcVarSelect').value;
    if (!varName) return;

    const values = state.rawData.map(r => r[varName]);
    const cleanVals = StatsEngine.cleanNumericArray(values);
    const spc = StatsEngine.spcChart(cleanVals);
    if (!spc) return;

    const timeValues = state.timeColumn ? state.rawData.map(r => r[state.timeColumn]) : cleanVals.map((_, i) => i + 1);

    // 1. SPC Chart Traces
    const traces = [];

    // Observed Data Line
    traces.push({
      x: timeValues,
      y: cleanVals,
      mode: 'lines+markers',
      name: '관측값',
      line: { color: '#4f46e5', width: 1.5 },
      marker: { size: 4, color: '#4f46e5' }
    });

    // Control Lines
    const len = timeValues.length;
    const uclArr = new Array(len).fill(spc.ucl);
    const lclArr = new Array(len).fill(spc.lcl);
    const clArr = new Array(len).fill(spc.mean);
    const uwlArr = new Array(len).fill(spc.uwl);
    const lwlArr = new Array(len).fill(spc.lwl);

    traces.push({
      x: timeValues,
      y: uclArr,
      mode: 'lines',
      name: 'UCL (+3σ)',
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    });

    traces.push({
      x: timeValues,
      y: lclArr,
      mode: 'lines',
      name: 'LCL (-3σ)',
      line: { color: '#ef4444', width: 2, dash: 'dash' }
    });

    traces.push({
      x: timeValues,
      y: clArr,
      mode: 'lines',
      name: 'CL (평균)',
      line: { color: '#2563eb', width: 2 }
    });

    traces.push({
      x: timeValues,
      y: uwlArr,
      mode: 'lines',
      name: 'UWL (+2σ)',
      line: { color: '#f59e0b', width: 1, dash: 'dot' }
    });

    traces.push({
      x: timeValues,
      y: lwlArr,
      mode: 'lines',
      name: 'LWL (-2σ)',
      line: { color: '#f59e0b', width: 1, dash: 'dot' }
    });

    // Moving Averages
    const showSma5 = document.getElementById('chkSma5').checked;
    const showSma20 = document.getElementById('chkSma20').checked;

    if (showSma5) {
      traces.push({
        x: timeValues,
        y: spc.sma5,
        mode: 'lines',
        name: 'SMA 5',
        line: { color: '#10b981', width: 2 }
      });
    }

    if (showSma20) {
      traces.push({
        x: timeValues,
        y: spc.sma20,
        mode: 'lines',
        name: 'SMA 20',
        line: { color: '#8b5cf6', width: 2 }
      });
    }

    // Outlier Scatter overlay
    if (spc.outliers.length > 0) {
      const outX = spc.outliers.map(o => timeValues[o.index]);
      const outY = spc.outliers.map(o => o.value);
      traces.push({
        x: outX,
        y: outY,
        mode: 'markers',
        name: '이상치 (Outliers)',
        marker: { color: '#dc2626', size: 10, symbol: 'diamond', line: { color: '#ffffff', width: 1.5 } }
      });
    }

    Plotly.newPlot('chartSpcMain', traces, {
      ...plotlyCommonLayout,
      xaxis: { title: state.timeColumn || '표본 순번' },
      yaxis: { title: varName },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.15 }
    }, plotlyConfig);

    // 2. Outlier Summary Badge & Table
    const badge = document.getElementById('spcOutlierSummaryBadge');
    if (spc.outliers.length > 0) {
      badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200';
      badge.innerText = `총 ${spc.outliers.length}건의 이상치 감지 (공정 이상 주의)`;
    } else {
      badge.className = 'text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200';
      badge.innerText = '이상치 없음 (공정 안정 상태)';
    }

    const tbody = document.querySelector('#spcOutlierTable tbody');
    if (spc.outliers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-400 font-sans">관리 한계를 이탈한 이상치가 발견되지 않았습니다.</td></tr>`;
    } else {
      tbody.innerHTML = spc.outliers.map(o => {
        const timeVal = timeValues[o.index] || `Row ${o.index + 1}`;
        const diffUcl = o.value - spc.ucl;
        const diffLcl = o.value - spc.lcl;
        const diffText = o.value > spc.ucl ? `+${diffUcl.toFixed(2)} (UCL 초과)` : `${diffLcl.toFixed(2)} (LCL 미달)`;

        return `
          <tr class="hover:bg-slate-50 transition-colors">
            <td class="px-3 py-2 text-slate-700">${o.index + 1}</td>
            <td class="px-3 py-2 text-slate-800">${timeVal}</td>
            <td class="px-3 py-2 text-right font-bold text-red-600">${o.value.toFixed(3)}</td>
            <td class="px-3 py-2 text-right text-slate-600">${diffText}</td>
            <td class="px-3 py-2 text-center">
              <span class="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-semibold">${o.type}</span>
            </td>
          </tr>
        `;
      }).join('');
    }

    // 3. Control Limits Details
    const limitsContainer = document.getElementById('spcLimitsContainer');
    limitsContainer.innerHTML = `
      <div class="flex justify-between p-2 rounded bg-red-50 border border-red-200 text-red-900">
        <span>상한 관리한계선 (UCL, +3σ):</span>
        <span class="font-bold">${spc.ucl.toFixed(3)}</span>
      </div>
      <div class="flex justify-between p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
        <span>상한 경고한계선 (UWL, +2σ):</span>
        <span class="font-bold">${spc.uwl.toFixed(3)}</span>
      </div>
      <div class="flex justify-between p-2 rounded bg-blue-50 border border-blue-200 text-blue-900">
        <span>공정 중심선 (CL, Mean):</span>
        <span class="font-bold">${spc.mean.toFixed(3)}</span>
      </div>
      <div class="flex justify-between p-2 rounded bg-amber-50 border border-amber-200 text-amber-900">
        <span>하한 경고한계선 (LWL, -2σ):</span>
        <span class="font-bold">${spc.lwl.toFixed(3)}</span>
      </div>
      <div class="flex justify-between p-2 rounded bg-red-50 border border-red-200 text-red-900">
        <span>하한 관리한계선 (LCL, -3σ):</span>
        <span class="font-bold">${spc.lcl.toFixed(3)}</span>
      </div>
      <div class="flex justify-between p-2 rounded bg-slate-50 border border-slate-200 text-slate-800">
        <span>IQR 이상치 기준:</span>
        <span class="font-bold">&lt; ${spc.iqrLower.toFixed(2)} 또는 &gt; ${spc.iqrUpper.toFixed(2)}</span>
      </div>
    `;

    initLucide();
  }

  // ==========================================
  // 9. Tab 7: Raw Data Table & CSV Export
  // ==========================================

  function renderRawDataTable() {
    if (state.rawData.length === 0) return;

    document.getElementById('rawRowCountLabel').innerText = `총 ${state.rawData.length}개 관측치 표시`;

    // Table Head
    const thead = document.getElementById('rawDataTableHead');
    thead.innerHTML = `
      <tr>
        <th class="px-3 py-3 w-12 text-center text-slate-400">#</th>
        ${state.columns.map(col => `<th class="px-3 py-3">${col}</th>`).join('')}
      </tr>
    `;

    // Table Body
    const tbody = document.getElementById('rawDataTableBody');
    tbody.innerHTML = state.rawData.map((row, idx) => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-3 py-2 text-center text-slate-400">${idx + 1}</td>
        ${state.columns.map(col => {
          const val = row[col];
          const isNum = typeof val === 'number';
          return `<td class="px-3 py-2 ${isNum ? 'text-right' : ''}">${val !== null && val !== undefined ? (isNum ? val.toFixed(2) : val) : '-'}</td>`;
        }).join('')}
      </tr>
    `).join('');
  }

  function exportCleanCsv() {
    if (state.rawData.length === 0) {
      alert('내보낼 데이터가 없습니다.');
      return;
    }

    const headers = state.columns;
    const csvRows = [];
    csvRows.push(headers.join(','));

    for (const row of state.rawData) {
      const values = headers.map(h => {
        const v = row[h];
        if (v === null || v === undefined) return '';
        const escaped = ('' + v).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvContent = '\uFEFF' + csvRows.join('\n'); // UTF-8 BOM
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `cleaned_${state.currentFileName.replace(/\.[^/.]+$/, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

})();

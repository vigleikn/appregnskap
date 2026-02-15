(function () {
  const STORAGE_KEY = 'budget-export-data';

  const fileInput = document.getElementById('file-input');
  const btnLoad = document.getElementById('btn-load');
  const noData = document.getElementById('no-data');
  const hasData = document.getElementById('has-data');
  const metaEl = document.getElementById('meta');
  const monthTitleEl = document.getElementById('month-title');
  const monthHintEl = document.getElementById('month-hint');
  const monthCategoriesEl = document.getElementById('month-categories');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('nav-next');
  const monthNav = document.getElementById('month-nav');
  const monthTotalEl = document.getElementById('month-total');
  const totalValueEl = document.getElementById('total-value');
  const barTrackEl = document.getElementById('bar-track');
  const barFillEl = document.getElementById('bar-fill');
  const monthViewEl = document.getElementById('month-view');
  const detailViewEl = document.getElementById('detail-view');
  const detailTitleEl = document.getElementById('detail-title');
  const detailSubtitleEl = document.getElementById('detail-subtitle');
  const detailTransactionsEl = document.getElementById('detail-transactions');
  const btnBack = document.getElementById('btn-back');

  var currentData = null;
  var availableMonths = [];
  var selectedMonthIndex = 0;

  var OVERFORT_ID = 'overfort';
  var INCOME_TOP_NAMES = ['UDI', 'Torghatten', 'Andre inntekter'];

  /**
   * Build a lookup of income category IDs from the category hierarchy.
   * Income categories have positive raw amounts from bank transactions,
   * while expense/savings categories have negative raw amounts.
   */
  function buildIncomeIds(categories) {
    var ids = {};
    // Find income hovedkategorier
    categories.forEach(function (c) {
      if (c.type === 'hovedkategori') {
        var nameLc = (c.name || '').toLowerCase();
        if (c.id === 'cat_inntekter_default' || nameLc === 'inntekter') {
          ids[c.id] = true;
        }
      }
    });
    // Add their underkategorier
    categories.forEach(function (c) {
      if (c.type === 'underkategori' && c.parentId && ids[c.parentId]) {
        ids[c.id] = true;
      }
    });
    return ids;
  }

  function formatAmount(n) {
    return Math.round(n).toLocaleString('nb-NO') + ' kr';
  }

  function formatMonthLabel(ym) {
    if (!ym) return '';
    var parts = String(ym).split('-');
    var y = parts[0];
    var m = parts[1] || '';
    var monthNames = [
      'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
    ];
    var mi = parseInt(m, 10) - 1;
    return (monthNames[mi] || m) + ' ' + y;
  }

  function normalizeMonth(ym) {
    if (!ym || typeof ym !== 'string') return ym;
    var parts = String(ym).split('-');
    if (parts.length >= 2) {
      var y = parts[0];
      var m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
      return y + '-' + m;
    }
    return ym;
  }

  function getCurrentMonthYm() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    return y + '-' + m;
  }

  function buildAvailableMonths(data) {
    var byMonthByCategory = data.byMonthByCategory || {};
    var byMonthBudget = data.byMonthBudget || {};
    var monthSet = {};
    Object.keys(byMonthByCategory).forEach(function (ym) { monthSet[ym] = true; });
    Object.keys(byMonthBudget).forEach(function (ym) { monthSet[ym] = true; });
    var list = Object.keys(monthSet).map(function (ym) { return normalizeMonth(ym); }).filter(Boolean);
    list.sort();
    list.reverse();
    return list;
  }

  function renderMonthView() {
    if (!currentData || !monthTitleEl || !monthCategoriesEl) return;

    var categoryById = new Map(currentData.categories.map(function (c) { return [c.id, c]; }));
    var byMonthByCategory = currentData.byMonthByCategory || {};
    var byMonthBudgetRaw = currentData.byMonthBudget;
    if (byMonthBudgetRaw && typeof byMonthBudgetRaw !== 'object') byMonthBudgetRaw = {};
    var byMonthBudget = byMonthBudgetRaw || {};

    if (availableMonths.length === 0) {
      monthNav.hidden = true;
      monthTitleEl.textContent = '';
      monthHintEl.hidden = false;
      monthHintEl.textContent = 'Ingen månedsdata i eksporten.';
      monthCategoriesEl.innerHTML = '';
      return;
    }

    monthNav.hidden = false;
    monthHintEl.hidden = true;

    var ym = availableMonths[selectedMonthIndex];
    var ymNorm = normalizeMonth(ym);
    var catSums = byMonthByCategory[ym] || byMonthByCategory[ymNorm] || {};
    var catBudgets = (byMonthBudget[ym] || byMonthBudget[ymNorm] || {});
    var catIds = new Set(Object.keys(catSums).concat(Object.keys(catBudgets)));
    var entries = Array.from(catIds).map(function (catId) {
      var forbruk = catSums[catId] || 0;
      var budsjett = catBudgets[catId];
      return {
        catId: catId,
        category: categoryById.get(catId),
        forbruk: forbruk,
        budsjett: budsjett,
      };
    }).filter(function (x) {
      if (!x.category) return false;
      if (x.category.id === OVERFORT_ID || x.category.name === 'Overført') return false;
      return true;
    });

    // Mark income categories so we can handle sign and totals correctly.
    // Export stores raw tx.beløp: expenses are negative, income is positive.
    // For display, expense amounts must be negated to become positive (matching budget sign).
    var incomeIds = buildIncomeIds(currentData.categories);
    entries.forEach(function (item) {
      item.isIncome = !!incomeIds[item.catId];
    });

    // Income always first (sorted by INCOME_TOP_NAMES order), then expenses by amount.
    function sortOrder(a) {
      if (!a.isIncome) return INCOME_TOP_NAMES.length + 1;
      var name = (a.category && a.category.name) || '';
      var i = INCOME_TOP_NAMES.indexOf(name);
      if (i !== -1) return i;
      return INCOME_TOP_NAMES.length; // unnamed income after named ones, before expenses
    }
    entries.sort(function (a, b) {
      var orderA = sortOrder(a);
      var orderB = sortOrder(b);
      if (orderA !== orderB) return orderA - orderB;
      return Math.abs(b.forbruk) - Math.abs(a.forbruk);
    });

    // "Forbruk mot budsjett" total: only expense/savings categories (exclude income).
    // Negate raw amounts: expense -5000 → +5000 (matching budget convention).
    var expenseEntries = entries.filter(function (e) { return !e.isIncome; });
    var totalForbruk = expenseEntries.reduce(function (sum, e) { return sum + (-e.forbruk); }, 0);
    var totalBudsjett = expenseEntries.reduce(function (sum, e) {
      var b = e.budsjett != null && e.budsjett !== '' ? Number(e.budsjett) : 0;
      return sum + b;
    }, 0);

    monthTitleEl.textContent = formatMonthLabel(ym);
    btnPrev.disabled = selectedMonthIndex >= availableMonths.length - 1;
    btnNext.disabled = selectedMonthIndex <= 0;

    if (totalBudsjett > 0 || totalForbruk !== 0) {
      monthTotalEl.hidden = false;
      totalValueEl.textContent = formatAmount(totalForbruk) + ' av ' + (totalBudsjett > 0 ? formatAmount(totalBudsjett) : '– kr');
      if (totalBudsjett > 0) {
        var isOver = totalForbruk > totalBudsjett;
        totalValueEl.className = 'total-value ' + (isOver ? 'over' : 'under');
        var pct = Math.min(100, Math.max(0, (totalForbruk / totalBudsjett) * 100));
        barFillEl.style.width = pct + '%';
        barFillEl.className = 'bar-fill ' + (isOver ? 'over' : 'under');
      } else {
        totalValueEl.className = 'total-value';
        barFillEl.style.width = '0%';
      }
    } else {
      monthTotalEl.hidden = true;
    }

    monthCategoriesEl.innerHTML = '';
    entries.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'category-row';
      var nameSpan = document.createElement('span');
      nameSpan.className = 'category-name';
      nameSpan.textContent = (item.category.icon ? item.category.icon + ' ' : '') + item.category.name;
      var valSpan = document.createElement('span');
      valSpan.className = 'sum';
      // For expenses/savings: negate raw amount (negative → positive).
      // For income: keep raw amount (already positive).
      var displayAmount = item.isIncome ? item.forbruk : -item.forbruk;
      if (item.isIncome) {
        // Income: always plain white text, no over/under coloring.
        valSpan.textContent = formatAmount(displayAmount);
      } else if (item.budsjett != null && item.budsjett !== '') {
        var budsjettNum = Number(item.budsjett);
        var overBudsjett = displayAmount > budsjettNum;
        valSpan.className = 'sum ' + (overBudsjett ? 'over' : 'under');
        valSpan.textContent = formatAmount(displayAmount) + ' av ' + formatAmount(budsjettNum);
      } else {
        valSpan.textContent = formatAmount(displayAmount) + ' av –';
      }
      li.appendChild(nameSpan);
      li.appendChild(valSpan);
      // Drill-down: tap row to see transactions
      li.addEventListener('click', function () {
        showDetail(item.catId, ym, item.category, item.isIncome);
      });
      monthCategoriesEl.appendChild(li);
    });
  }

  // ── Detail view (transaction drill-down) ──────────────────────────────

  /**
   * Parse a transaction date string to a YYYY-MM string for month matching.
   * Supports dd.mm.yy, dd.mm.yyyy, yyyy-mm-dd.
   */
  function txToYearMonth(dato) {
    if (!dato || typeof dato !== 'string') return '';
    var s = dato.trim();
    if (s.indexOf('.') !== -1) {
      var p = s.split('.');
      if (p.length >= 3) {
        var yr = p[2].length === 2 ? '20' + p[2] : p[2];
        var mo = p[1].length === 1 ? '0' + p[1] : p[1];
        return yr + '-' + mo;
      }
      return '';
    }
    if (s.indexOf('-') !== -1) {
      var parts = s.split('-');
      if (parts.length >= 2) {
        var m = parts[1].length === 1 ? '0' + parts[1] : parts[1];
        return parts[0] + '-' + m;
      }
    }
    return '';
  }

  function showDetail(catId, ym, category, isIncome) {
    if (!currentData || !detailViewEl) return;

    var txs = (currentData.transactions || []).filter(function (tx) {
      if (tx.c !== catId) return false;
      var txYm = txToYearMonth(tx.d);
      return txYm === ym || txYm === normalizeMonth(ym);
    });

    // Sort by date (newest first)
    txs.sort(function (a, b) {
      // Compare raw date strings; parse to comparable format
      var aYmd = parseDateSortable(a.d);
      var bYmd = parseDateSortable(b.d);
      return bYmd.localeCompare(aYmd);
    });

    var label = (category.icon ? category.icon + ' ' : '') + category.name;
    detailTitleEl.textContent = label;
    detailSubtitleEl.textContent = formatMonthLabel(ym) + ' — ' + txs.length + ' transaksjoner';

    detailTransactionsEl.innerHTML = '';
    txs.forEach(function (tx) {
      var li = document.createElement('li');
      var dateSpan = document.createElement('span');
      dateSpan.className = 'tx-date';
      dateSpan.textContent = formatDate(tx.d);
      var textSpan = document.createElement('span');
      textSpan.className = 'tx-text';
      textSpan.textContent = tx.t;
      var amountSpan = document.createElement('span');
      amountSpan.className = 'tx-amount';
      amountSpan.textContent = formatAmount(tx.b);
      li.appendChild(dateSpan);
      li.appendChild(textSpan);
      li.appendChild(amountSpan);
      detailTransactionsEl.appendChild(li);
    });

    monthViewEl.hidden = true;
    detailViewEl.hidden = false;
  }

  /** Parse dd.mm.yy / dd.mm.yyyy / yyyy-mm-dd to YYYY-MM-DD for sorting. */
  function parseDateSortable(d) {
    if (!d) return '';
    var s = d.trim();
    if (s.indexOf('.') !== -1) {
      var p = s.split('.');
      if (p.length >= 3) {
        var yr = p[2].length === 2 ? '20' + p[2] : p[2];
        var mo = p[1].length === 1 ? '0' + p[1] : p[1];
        var dy = p[0].length === 1 ? '0' + p[0] : p[0];
        return yr + '-' + mo + '-' + dy;
      }
    }
    return s; // assume yyyy-mm-dd already
  }

  /** Format a date for display: dd.mm */
  function formatDate(d) {
    if (!d) return '';
    var s = d.trim();
    if (s.indexOf('.') !== -1) {
      var p = s.split('.');
      if (p.length >= 2) return p[0] + '.' + p[1];
    }
    if (s.indexOf('-') !== -1) {
      var parts = s.split('-');
      if (parts.length >= 3) return parts[2] + '.' + parts[1];
    }
    return s;
  }

  btnBack.addEventListener('click', function () {
    detailViewEl.hidden = true;
    monthViewEl.hidden = false;
  });

  // ── Main render ──────────────────────────────────────────────────────

  function render(data) {
    if (!data || !data.categories) {
      noData.hidden = false;
      hasData.hidden = true;
      return;
    }

    currentData = data;
    availableMonths = buildAvailableMonths(data);
    var currentYm = getCurrentMonthYm();
    var idx = availableMonths.indexOf(currentYm);
    if (idx === -1) idx = availableMonths.indexOf(normalizeMonth(currentYm));
    if (idx === -1 && availableMonths.length > 0) idx = 0;
    selectedMonthIndex = Math.max(0, idx);

    metaEl.textContent = 'Sist oppdatert: ' + (data.meta && data.meta.exportedAt
      ? new Date(data.meta.exportedAt).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
      : '–');

    renderMonthView();
    noData.hidden = true;
    hasData.hidden = false;
  }

  btnPrev.addEventListener('click', function () {
    if (selectedMonthIndex < availableMonths.length - 1) {
      selectedMonthIndex++;
      renderMonthView();
    }
  });

  btnNext.addEventListener('click', function () {
    if (selectedMonthIndex > 0) {
      selectedMonthIndex--;
      renderMonthView();
    }
  });

  function loadFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
        render(data);
      } catch (e) {
        alert('Kunne ikke lese filen. Sjekk at det er en gyldig budget-export.json.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  btnLoad.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (file) loadFromFile(file);
    fileInput.value = '';
  });

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      render(JSON.parse(stored));
    }
  } catch (e) {}

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();

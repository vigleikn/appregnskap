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

    function sortOrder(a) {
      var name = (a.category && a.category.name) || '';
      var i = INCOME_TOP_NAMES.indexOf(name);
      if (i !== -1) return i;
      return INCOME_TOP_NAMES.length;
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
        valSpan.textContent = formatAmount(displayAmount) + ' av ' + formatAmount(budsjettNum) + ' kr';
      } else {
        valSpan.textContent = formatAmount(displayAmount) + ' av – kr';
      }
      li.appendChild(nameSpan);
      li.appendChild(valSpan);
      monthCategoriesEl.appendChild(li);
    });
  }

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

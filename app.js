(function () {
  const STORAGE_KEY = 'budget-export-data';

  const fileInput = document.getElementById('file-input');
  const btnLoad = document.getElementById('btn-load');
  const noData = document.getElementById('no-data');
  const hasData = document.getElementById('has-data');
  const metaEl = document.getElementById('meta');
  const byCategoryEl = document.getElementById('by-category');
  const byMonthEl = document.getElementById('by-month');

  function formatAmount(n) {
    return Math.round(n).toLocaleString('nb-NO') + ' kr';
  }

  function setText(el, text) {
    el.textContent = text;
  }

  function render(data) {
    if (!data || !data.categories || !data.byCategory) {
      noData.hidden = false;
      hasData.hidden = true;
      return;
    }

    const categoryById = new Map(data.categories.map(function (c) {
      return [c.id, c];
    }));

    // Meta
    var exportedAt = data.meta && data.meta.exportedAt
      ? new Date(data.meta.exportedAt).toLocaleString('nb-NO', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '–';
    setText(metaEl, 'Sist oppdatert: ' + exportedAt);

    // By category
    var withSums = data.byCategory
      .map(function (item) {
        return {
          category: categoryById.get(item.categoryId),
          sum: item.sum,
        };
      })
      .filter(function (x) { return x.category; });
    var total = withSums.reduce(function (a, x) { return a + x.sum; }, 0);
    withSums.sort(function (a, b) { return Math.abs(b.sum) - Math.abs(a.sum); });

    byCategoryEl.innerHTML = '';
    withSums.forEach(function (item) {
      var li = document.createElement('li');
      var nameSpan = document.createElement('span');
      nameSpan.className = 'category-name';
      nameSpan.textContent = (item.category.icon ? item.category.icon + ' ' : '') + item.category.name;
      var sumSpan = document.createElement('span');
      sumSpan.className = 'category-sum ' + (item.sum >= 0 ? 'positive' : 'negative');
      sumSpan.textContent = formatAmount(item.sum);
      li.appendChild(nameSpan);
      li.appendChild(sumSpan);
      byCategoryEl.appendChild(li);
    });

    if (total !== 0) {
      var totalLi = document.createElement('li');
      totalLi.style.borderTop = '1px solid rgba(255,255,255,0.1)';
      totalLi.style.marginTop = '0.25rem';
      totalLi.style.paddingTop = '0.5rem';
      totalLi.style.fontWeight = '600';
      var totalName = document.createElement('span');
      totalName.className = 'category-name';
      totalName.textContent = 'Totalt';
      var totalSum = document.createElement('span');
      totalSum.className = 'category-sum ' + (total >= 0 ? 'positive' : 'negative');
      totalSum.textContent = formatAmount(total);
      totalLi.appendChild(totalName);
      totalLi.appendChild(totalSum);
      byCategoryEl.appendChild(totalLi);
    }

    // By month: forbruk / budsjett kr, rød over budsjett, grønn under
    var byMonthByCategory = data.byMonthByCategory || {};
    var byMonthBudget = data.byMonthBudget || {};
    var monthSet = {};
    Object.keys(byMonthByCategory).forEach(function (ym) { monthSet[ym] = true; });
    Object.keys(byMonthBudget).forEach(function (ym) { monthSet[ym] = true; });
    var months = Object.keys(monthSet).sort().reverse();
    byMonthEl.innerHTML = '';
    if (months.length === 0) {
      var p = document.createElement('p');
      p.className = 'no-data';
      p.textContent = 'Ingen månedsdata.';
      byMonthEl.appendChild(p);
    } else {
      function formatMonthLabel(ym) {
        var parts = ym.split('-');
        var y = parts[0];
        var m = parts[1];
        var monthNames = [
          'Januar', 'Februar', 'Mars', 'April', 'Mai', 'Juni',
          'Juli', 'August', 'September', 'Oktober', 'November', 'Desember',
        ];
        var mi = parseInt(m, 10) - 1;
        return (monthNames[mi] || m) + ' ' + y;
      }
      months.forEach(function (ym) {
        var catSums = byMonthByCategory[ym] || {};
        var catBudgets = byMonthBudget[ym] || {};
        var catIds = new Set(Object.keys(catSums).concat(Object.keys(catBudgets)));
        var entries = Array.from(catIds).map(function (catId) {
          var forbruk = catSums[catId] || 0;
          var budsjett = catBudgets[catId];
          return {
            category: categoryById.get(catId),
            forbruk: forbruk,
            budsjett: budsjett,
          };
        }).filter(function (x) { return x.category; });
        entries.sort(function (a, b) {
          return Math.abs(b.forbruk) - Math.abs(a.forbruk);
        });

        var monthBlock = document.createElement('div');
        monthBlock.className = 'month-block';
        var h3 = document.createElement('h3');
        h3.textContent = formatMonthLabel(ym);
        monthBlock.appendChild(h3);
        var ul = document.createElement('ul');
        entries.forEach(function (item) {
          var li = document.createElement('li');
          var nameSpan = document.createElement('span');
          nameSpan.textContent = (item.category.icon ? item.category.icon + ' ' : '') + item.category.name;
          var valSpan = document.createElement('span');
          valSpan.className = 'sum';
          var forbrukAbs = Math.abs(item.forbruk);
          if (item.budsjett != null && item.budsjett !== '') {
            var budsjettNum = Number(item.budsjett);
            var overBudsjett = forbrukAbs > budsjettNum;
            valSpan.className = 'sum ' + (overBudsjett ? 'over' : 'under');
            valSpan.textContent = formatAmount(item.forbruk) + ' / ' + formatAmount(budsjettNum);
          } else {
            valSpan.textContent = formatAmount(item.forbruk) + ' / – kr';
          }
          li.appendChild(nameSpan);
          li.appendChild(valSpan);
          ul.appendChild(li);
        });
        monthBlock.appendChild(ul);
        byMonthEl.appendChild(monthBlock);
      });
    }

    noData.hidden = true;
    hasData.hidden = false;
  }

  function loadFromFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {}
        render(data);
      } catch (e) {
        alert('Kunne ikke lese filen. Sjekk at det er en gyldig budget-export.json.');
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  btnLoad.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (file) loadFromFile(file);
    fileInput.value = '';
  });

  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      var data = JSON.parse(stored);
      render(data);
    }
  } catch (e) {}

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();

document.addEventListener('DOMContentLoaded', function () {
  var noDiagnosisState = document.getElementById('noDiagnosisState');
  var paywallState = document.getElementById('paywallState');
  var loadingBox = document.getElementById('loadingBox');
  var errorBox = document.getElementById('errorBox');
  var errorText = document.getElementById('errorText');
  var reportResult = document.getElementById('reportResult');
  var modal = document.getElementById('checkoutModal');
  var unlockBtn = document.getElementById('unlockBtn');
  var cancelCheckout = document.getElementById('cancelCheckout');
  var confirmCheckout = document.getElementById('confirmCheckout');

  var stored = sessionStorage.getItem('kmuse_diagnosis');
  var diagnosis = stored ? JSON.parse(stored) : null;

  if (!diagnosis) {
    noDiagnosisState.style.display = 'block';
    return;
  }

  // budget option styling (reuses .option pattern from diagnosis)
  document.querySelectorAll('#budgetGroup .option').forEach(function (opt) {
    opt.addEventListener('click', function () {
      document.querySelectorAll('#budgetGroup .option').forEach(function (o) { o.classList.remove('selected'); });
      opt.classList.add('selected');
      opt.querySelector('input').checked = true;
    });
  });

  paywallState.style.display = 'block';

  unlockBtn.addEventListener('click', function () {
    modal.classList.add('open');
  });
  cancelCheckout.addEventListener('click', function () {
    modal.classList.remove('open');
  });

  confirmCheckout.addEventListener('click', function () {
    modal.classList.remove('open');
    paywallState.style.display = 'none';
    fetchReport();
  });

  function fetchReport() {
    loadingBox.classList.add('show');
    errorBox.classList.remove('show');

    var budgetInput = document.querySelector('input[name="budget"]:checked');
    var budget = budgetInput ? budgetInput.value : 'Mid-range';

    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 25000);

    fetch('/api/generate_report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        skinType: diagnosis.skinType,
        concern: diagnosis.concern,
        freeText: diagnosis.freeText,
        recommendations: diagnosis.recommendations,
        budget: budget
      }),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        loadingBox.classList.remove('show');
        if (!result.ok) {
          errorText.textContent = result.data.error || 'We couldn\'t build your routine. Please try again.';
          errorBox.classList.add('show');
          paywallState.style.display = 'block';
          return;
        }
        renderReport(result.data);
        reportResult.style.display = 'block';
      })
      .catch(function (err) {
        loadingBox.classList.remove('show');
        paywallState.style.display = 'block';
        if (err.name === 'AbortError') {
          errorText.textContent = 'This is taking longer than expected. Please try again in a moment.';
        } else {
          errorText.textContent = 'We couldn\'t reach K-Muse right now. Please check your connection and try again.';
        }
        errorBox.classList.add('show');
      });
  }

  function renderReport(data) {
    var weeksArea = document.getElementById('weeksArea');
    weeksArea.innerHTML = '';
    (data.weeks || []).forEach(function (week) {
      var block = document.createElement('div');
      block.className = 'week-block';
      block.innerHTML = '<h4>' + escapeHtml(week.label) + '</h4><p>' + escapeHtml(week.plan) + '</p>';
      weeksArea.appendChild(block);
    });

    var cautionArea = document.getElementById('cautionArea');
    cautionArea.textContent = data.caution || 'Patch test any new ingredient for 48 hours before adding it to your full routine.';

    document.getElementById('shareTitle').textContent = 'My K-Muse routine: ' + (diagnosis.skinType || '') + ' + ' + (diagnosis.concern || '');
    document.getElementById('shareBody').textContent = data.shareSummary || 'A 4-week K-beauty routine, matched to my skin story.';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});

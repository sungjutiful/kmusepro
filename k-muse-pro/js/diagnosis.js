document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('diagnosisForm');
  var loadingBox = document.getElementById('loadingBox');
  var errorBox = document.getElementById('errorBox');
  var errorText = document.getElementById('errorText');
  var resultArea = document.getElementById('resultArea');
  var resultGrid = document.getElementById('resultGrid');

  // visually toggle selected option cards, radio-style
  document.querySelectorAll('.option-grid').forEach(function (group) {
    group.querySelectorAll('.option').forEach(function (opt) {
      opt.addEventListener('click', function () {
        group.querySelectorAll('.option').forEach(function (o) { o.classList.remove('selected'); });
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        opt.closest('.field').classList.remove('invalid');
      });
    });
  });

  function getSelected(name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : '';
  }

  function setLoading(isLoading) {
    loadingBox.classList.toggle('show', isLoading);
    form.querySelector('button[type="submit"]').disabled = isLoading;
  }

  function showError(message) {
    errorText.textContent = message;
    errorBox.classList.add('show');
  }

  function clearError() {
    errorBox.classList.remove('show');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearError();

    var skinType = getSelected('skinType');
    var concern = getSelected('concern');
    var freeText = document.getElementById('freeText').value.trim();

    // required-field validation (failure mode 1: empty input)
    var valid = true;
    if (!skinType) {
      document.getElementById('skinTypeGroup').closest('.field').classList.add('invalid');
      valid = false;
    }
    if (!concern) {
      document.getElementById('concernGroup').closest('.field').classList.add('invalid');
      valid = false;
    }
    if (!valid) return;

    setLoading(true);
    resultArea.style.display = 'none';

    // failure mode 3: timeout / slow response
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 20000);

    fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skinType: skinType, concern: concern, freeText: freeText }),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        setLoading(false);
        if (!result.ok) {
          // failure mode 2: API error (4xx/5xx)
          showError(result.data.error || 'The AI couldn\'t process that. Please try again.');
          return;
        }
        renderResults(result.data);
        // save for the report page
        sessionStorage.setItem('kmuse_diagnosis', JSON.stringify({
          skinType: skinType, concern: concern, freeText: freeText,
          recommendations: result.data.recommendations
        }));
        resultArea.style.display = 'block';
        resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function (err) {
        setLoading(false);
        if (err.name === 'AbortError') {
          showError('This is taking longer than expected. Please try again in a moment.');
        } else {
          showError('We couldn\'t reach K-Muse right now. Please check your connection and try again.');
        }
      });
  });

  function renderResults(data) {
    resultGrid.innerHTML = '';
    (data.recommendations || []).forEach(function (rec) {
      var card = document.createElement('div');
      card.className = 'specimen-card';
      card.innerHTML =
        '<div class="specimen-stamp">' + escapeHtml(rec.korean || '') + '</div>' +
        '<p class="specimen-eyebrow">' + escapeHtml(rec.scientificName || '') + '</p>' +
        '<h3 class="specimen-name">' + escapeHtml(rec.ingredient || '') + '</h3>' +
        '<p class="specimen-effect">' + escapeHtml(rec.effect || '') + '</p>' +
        '<p class="specimen-reason">— ' + escapeHtml(rec.reason || '') + '</p>';
      resultGrid.appendChild(card);
    });

    if (data.brandSlot) {
      var card = document.createElement('div');
      card.className = 'specimen-card partner';
      card.innerHTML =
        '<span class="partner-tag">Partner pick</span><br>' +
        '<div class="specimen-stamp">' + escapeHtml(data.brandSlot.korean || '') + '</div>' +
        '<p class="specimen-eyebrow">' + escapeHtml(data.brandSlot.brand || '') + '</p>' +
        '<h3 class="specimen-name">' + escapeHtml(data.brandSlot.product || '') + '</h3>' +
        '<p class="specimen-effect">' + escapeHtml(data.brandSlot.tagline || '') + '</p>';
      resultGrid.appendChild(card);
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});

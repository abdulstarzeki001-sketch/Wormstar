(() => {
  const poller = document.querySelector('[data-poll-scan]');
  if (!poller) return;
  const scanId = poller.dataset.pollScan;
  async function check() {
    try {
      const response = await fetch(`/api/scans/${encodeURIComponent(scanId)}/status`, {credentials:'same-origin', cache:'no-store'});
      if (!response.ok) return;
      const data = await response.json();
      const sourceGrid = document.querySelector('[data-sources-grid]');
      if (sourceGrid && Array.isArray(data.sources)) {
        sourceGrid.replaceChildren();
        for (const item of data.sources) {
          const row = document.createElement('div');
          row.className = 'source-pill';
          const label = document.createElement('span');
          label.textContent = item.source;
          const status = document.createElement('span');
          status.className = 'status ' + (['done','failed','queued','running'].includes(item.status) ? item.status : '');
          status.textContent = item.status;
          const num = document.createElement('b');
          num.textContent = String(item.findings);
          row.append(label,status,num);
          sourceGrid.append(row);
        }
      }
      if (!['queued','running'].includes(data.scan) && !['queued','running'].includes(data.report)) {
        window.location.reload();
      }
    } catch (err) {
      // Network or transient errors should not reload the page.
    }
  }
  setInterval(check, 4000);
})();

// Client-side evidence filtering never submits source content to external services.
(() => {
  const field = document.querySelector('[data-evidence-filter]');
  const tbody = document.querySelector('[data-evidence-body]');
  const count = document.querySelector('[data-evidence-count]');
  if (!field || !tbody || !count) return;
  const rows = [...tbody.querySelectorAll('tr')];
  field.addEventListener('input', () => {
    const term = field.value.toLocaleLowerCase().trim();
    let visible = 0;
    for (const row of rows) {
      const show = row.textContent.toLocaleLowerCase().includes(term);
      row.hidden = !show;
      if (show) visible++;
    }
    count.textContent = `${visible} / ${rows.length} نتيجة`;
  });
})();

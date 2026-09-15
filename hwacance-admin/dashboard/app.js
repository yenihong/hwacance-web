const cfg = window.HWACANCE_CONFIG || {};
const EVENT_COLORS = {
  setup_completed: '#4f46e5',
  photo_changed: '#2563eb',
  away_clicked: '#d97706',
  return_clicked: '#16a34a',
};
const EVENT_LABELS = {
  setup_completed: '설정 완료',
  photo_changed: '사진 변경',
  away_clicked: '자리비움',
  return_clicked: '돌아옴',
};

let sb = null;
let chart = null;

function showBanner(message) {
  const el = document.getElementById('statusBanner');
  el.textContent = message;
  el.hidden = false;
}

function pct(n, d) {
  if (!d) return '–';
  return `${((n / d) * 100).toFixed(1)}%`;
}

function avg(n, d) {
  if (!d) return '0.0';
  return (n / d).toFixed(1);
}

function fmt(n) {
  if (n === null || n === undefined) return '–';
  return Number(n).toLocaleString('ko-KR');
}

async function fetchGithubDownloads() {
  const repo = cfg.GITHUB_REPO;
  if (!repo) return null;
  const res = await fetch(`https://api.github.com/repos/${repo}/releases`);
  if (!res.ok) throw new Error(`GitHub API 오류 (${res.status})`);
  const releases = await res.json();
  let total = 0;
  for (const release of releases) {
    for (const asset of release.assets || []) {
      total += asset.download_count || 0;
    }
  }
  return total;
}

async function fetchSummary() {
  const { data, error } = await sb.from('v_summary').select('*').single();
  if (error) throw error;
  return data;
}

async function fetchDaily() {
  const { data, error } = await sb
    .from('v_daily_events')
    .select('*')
    .order('day', { ascending: true });
  if (error) throw error;
  return data;
}

function filterByRange(rows, rangeValue) {
  if (rangeValue === 'all') return rows;
  const days = Number(rangeValue);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return rows.filter((r) => new Date(r.day) >= cutoff);
}

function groupDaily(rows) {
  const byDay = new Map();
  for (const row of rows) {
    const key = row.day.slice(0, 10);
    if (!byDay.has(key)) {
      byDay.set(key, { day: key, setup_completed: 0, photo_changed: 0, away_clicked: 0, return_clicked: 0, devices: 0 });
    }
    const entry = byDay.get(key);
    if (entry[row.event_type] !== undefined) entry[row.event_type] = row.event_count;
    entry.devices = Math.max(entry.devices, row.device_count);
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function renderKpis(summary, downloads) {
  document.getElementById('kpiDownloads').textContent = downloads === null ? '설정 필요' : fmt(downloads);
  document.getElementById('kpiSetup').textContent = fmt(summary.devices_setup);
  document.getElementById('kpiSetupRate').textContent = downloads
    ? `다운로드 대비 ${pct(summary.devices_setup, downloads)}`
    : 'GitHub 저장소 설정 필요';
  document.getElementById('kpiActive').textContent = fmt(summary.devices_active);
  document.getElementById('kpiPhoto').textContent = fmt(summary.photo_changes_total);
  document.getElementById('kpiPhotoSub').textContent = `기기당 평균 ${avg(summary.photo_changes_total, summary.devices_setup)}회`;
  document.getElementById('kpiAway').textContent = fmt(summary.away_clicks_total);
  document.getElementById('kpiAwaySub').textContent = `기기당 평균 ${avg(summary.away_clicks_total, summary.devices_setup)}회`;
  document.getElementById('kpiReturn').textContent = fmt(summary.return_clicks_total);
  document.getElementById('kpiReturnSub').textContent = `기기당 평균 ${avg(summary.return_clicks_total, summary.devices_setup)}회`;
}

function renderLegend() {
  const legend = document.getElementById('chartLegend');
  legend.innerHTML = Object.entries(EVENT_LABELS)
    .map(([key, label]) => `<span><span class="dot" style="background:${EVENT_COLORS[key]}"></span>${label}</span>`)
    .join('');
}

function renderChart(grouped) {
  const ctx = document.getElementById('dailyChart').getContext('2d');
  const labels = grouped.map((d) => d.day);
  const datasets = Object.keys(EVENT_LABELS).map((key) => ({
    label: EVENT_LABELS[key],
    data: grouped.map((d) => d[key]),
    borderColor: EVENT_COLORS[key],
    backgroundColor: EVENT_COLORS[key],
    tension: 0.25,
    pointRadius: 2,
  }));

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function renderTable(grouped) {
  const tbody = document.querySelector('#dailyTable tbody');
  tbody.innerHTML = grouped
    .slice()
    .reverse()
    .map(
      (d) => `
      <tr>
        <td>${d.day}</td>
        <td>${fmt(d.setup_completed)}</td>
        <td>${fmt(d.photo_changed)}</td>
        <td>${fmt(d.away_clicked)}</td>
        <td>${fmt(d.return_clicked)}</td>
        <td>${fmt(d.devices)}</td>
      </tr>`
    )
    .join('');
}

async function loadAll() {
  document.getElementById('statusBanner').hidden = true;

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR_PROJECT')) {
    showBanner('config.js에 SUPABASE_URL / SUPABASE_ANON_KEY를 설정해주세요 (config.example.js 참고).');
    return;
  }

  if (!sb) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const range = document.getElementById('rangeSelect').value;

  try {
    const [summary, daily, downloads] = await Promise.all([
      fetchSummary(),
      fetchDaily(),
      fetchGithubDownloads().catch((err) => {
        console.error(err);
        return null;
      }),
    ]);

    renderKpis(summary, downloads);
    const grouped = groupDaily(filterByRange(daily, range));
    renderLegend();
    renderChart(grouped);
    renderTable(grouped);
  } catch (err) {
    console.error(err);
    showBanner(`데이터를 불러오지 못했습니다: ${err.message || err}`);
  }
}

document.getElementById('rangeSelect').addEventListener('change', loadAll);
document.getElementById('refreshBtn').addEventListener('click', loadAll);

loadAll();

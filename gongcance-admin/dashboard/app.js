const cfg = window.GONGCANCE_CONFIG || {};
const EVENT_TYPES = [
  'app_launched',
  'setup_completed',
  'photo_changed',
  'break_started',
  'break_ended',
  'todo_added',
  'todo_completed',
  'asmr_on',
  'audio_changed',
  'study_started',
  'study_ended',
];
// 그래프에 그리는 이벤트 (나머지는 표/요약에만 표시)
const CHART_COLORS = {
  setup_completed: '#4f46e5',
  break_started: '#d97706',
  break_ended: '#16a34a',
  todo_added: '#2563eb',
  todo_completed: '#7c3aed',
  asmr_on: '#db2777',
};
const EVENT_LABELS = {
  setup_completed: '설정 완료',
  break_started: '쉼 시작',
  break_ended: '공부 재개',
  todo_added: '할 일 추가',
  todo_completed: '할 일 완료',
  asmr_on: 'ASMR',
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

// 같은 저장소에 화캉스 위젯 릴리스도 있으므로 ASSET_PREFIX로 시작하는 파일만 센다.
async function fetchGithubAssets() {
  const repo = cfg.GITHUB_REPO;
  if (!repo) return null;
  const prefix = cfg.ASSET_PREFIX || 'gongcance-widget';
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=100`);
  if (!res.ok) throw new Error(`GitHub API 오류 (${res.status})`);
  const releases = await res.json();
  const assets = [];
  for (const release of releases) {
    for (const asset of release.assets || []) {
      if (!asset.name.startsWith(prefix)) continue;
      assets.push({
        name: asset.name,
        tag: release.tag_name,
        publishedAt: release.published_at,
        downloads: asset.download_count || 0,
      });
    }
  }
  return assets;
}

async function fetchView(name, orderBy) {
  let query = sb.from(name).select('*');
  if (orderBy) query = query.order(orderBy, { ascending: true });
  const { data, error } = await query;
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

function groupDaily(eventRows, deviceRows) {
  const byDay = new Map();
  const ensure = (key) => {
    if (!byDay.has(key)) {
      const entry = { day: key, devices: 0 };
      for (const t of EVENT_TYPES) entry[t] = 0;
      byDay.set(key, entry);
    }
    return byDay.get(key);
  };
  for (const row of eventRows) {
    const entry = ensure(row.day.slice(0, 10));
    if (entry[row.event_type] !== undefined) entry[row.event_type] = row.event_count;
  }
  for (const row of deviceRows) {
    ensure(row.day.slice(0, 10)).devices = row.device_count;
  }
  return Array.from(byDay.values()).sort((a, b) => a.day.localeCompare(b.day));
}

function renderDownloadKpi(assets) {
  const downloads = assets ? assets.reduce((sum, a) => sum + a.downloads, 0) : null;
  setText('kpiDownloads', downloads === null ? '설정 필요' : fmt(downloads));
  setText('kpiDownloadsSub', assets ? `GitHub Release 기준 · 파일 ${assets.length}개` : 'GitHub 저장소 설정 필요');
  return downloads;
}

function renderKpis(s, assets) {
  const downloads = renderDownloadKpi(assets);
  setText('kpiSetup', fmt(s.devices_setup));
  setText('kpiSetupRate', downloads ? `다운로드 대비 ${pct(s.devices_setup, downloads)}` : '다운로드 대비 –%');
  setText('kpiActive', fmt(s.devices_active));
  setText(
    'kpiLastEvent',
    s.last_event_at ? `마지막 이벤트 ${new Date(s.last_event_at).toLocaleString('ko-KR')}` : '아직 수집된 이벤트 없음'
  );
  setText('kpiBreaks', fmt(s.breaks_ended_total));
  setText(
    'kpiBreaksSub',
    `평균 쉼 ${s.avg_break_minutes === null ? '–' : s.avg_break_minutes}분 · 기기당 ${avg(s.breaks_ended_total, s.devices_active)}회`
  );
  setText('kpiTodoAdded', fmt(s.todos_added_total));
  setText('kpiTodoSub', `완료 ${fmt(s.todos_completed_total)} (완료율 ${pct(s.todos_completed_total, s.todos_added_total)})`);
  setText('kpiPhoto', fmt(s.photo_changes_total));
  setText('kpiPhotoSub', `기기당 평균 ${avg(s.photo_changes_total, s.devices_setup)}회`);
  setText('kpiAsmr', fmt(s.asmr_on_total));
  setText('kpiAsmrSub', `기기당 평균 ${avg(s.asmr_on_total, s.devices_active)}회`);
  setText('kpiAudio', fmt(s.audio_changes_total));
  setText('kpiAudioSub', `기기당 평균 ${avg(s.audio_changes_total, s.devices_active)}회`);
  setText('kpiStudy', fmt(s.study_ended_total));
  setText(
    'kpiStudySub',
    `시작 ${fmt(s.study_started_total)}회 · 평균 공부 ${s.avg_study_minutes === null || s.avg_study_minutes === undefined ? '–' : s.avg_study_minutes}분`
  );
}

function renderLegend() {
  const legend = document.getElementById('chartLegend');
  legend.innerHTML = Object.entries(EVENT_LABELS)
    .map(([key, label]) => `<span><span class="dot" style="background:${CHART_COLORS[key]}"></span>${label}</span>`)
    .join('');
}

function renderChart(grouped) {
  const ctx = document.getElementById('dailyChart').getContext('2d');
  const labels = grouped.map((d) => d.day);
  const datasets = Object.keys(EVENT_LABELS).map((key) => ({
    label: EVENT_LABELS[key],
    data: grouped.map((d) => d[key]),
    borderColor: CHART_COLORS[key],
    backgroundColor: CHART_COLORS[key],
    tension: 0.25,
    pointRadius: 2,
  }));

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
      },
    },
  });
}

function emptyRow(colspan, text) {
  return `<tr class="empty-row"><td colspan="${colspan}">${text}</td></tr>`;
}

function renderDailyTable(grouped) {
  const tbody = document.querySelector('#dailyTable tbody');
  if (!grouped.length) {
    tbody.innerHTML = emptyRow(9, '선택한 기간에 수집된 이벤트가 없습니다.');
    return;
  }
  tbody.innerHTML = grouped
    .slice()
    .reverse()
    .map(
      (d) => `
      <tr>
        <td>${d.day}</td>
        <td>${fmt(d.app_launched)}</td>
        <td>${fmt(d.setup_completed)}</td>
        <td>${fmt(d.study_started)}</td>
        <td>${fmt(d.study_ended)}</td>
        <td>${fmt(d.break_started)}</td>
        <td>${fmt(d.break_ended)}</td>
        <td>${fmt(d.todo_added)}</td>
        <td>${fmt(d.todo_completed)}</td>
        <td>${fmt(d.asmr_on)}</td>
        <td>${fmt(d.devices)}</td>
      </tr>`
    )
    .join('');
}

function renderReleaseTable(assets) {
  const tbody = document.querySelector('#releaseTable tbody');
  if (!assets) {
    tbody.innerHTML = emptyRow(4, 'GitHub 릴리스 정보를 불러오지 못했습니다.');
    return;
  }
  if (!assets.length) {
    tbody.innerHTML = emptyRow(4, '공캉스 위젯 릴리스 파일이 없습니다.');
    return;
  }
  tbody.innerHTML = assets
    .map(
      (a) => `
      <tr>
        <td>${escapeHtml(a.name)}</td>
        <td>${escapeHtml(a.tag)}</td>
        <td>${a.publishedAt ? a.publishedAt.slice(0, 10) : '–'}</td>
        <td>${fmt(a.downloads)}</td>
      </tr>`
    )
    .join('');
}

function renderVersionTable(rows) {
  const tbody = document.querySelector('#versionTable tbody');
  if (!rows.length) {
    tbody.innerHTML = emptyRow(3, '아직 수집된 이벤트가 없습니다.');
    return;
  }
  const total = rows.reduce((sum, r) => sum + r.device_count, 0);
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${escapeHtml(r.app_version)}</td>
        <td>${fmt(r.device_count)}</td>
        <td>${pct(r.device_count, total)}</td>
      </tr>`
    )
    .join('');
}

async function loadAll() {
  document.getElementById('statusBanner').hidden = true;

  // 다운로드 수는 Supabase 설정과 무관하게 먼저 보여준다.
  const assetsPromise = fetchGithubAssets().catch((err) => {
    console.error(err);
    return null;
  });

  if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('YOUR_PROJECT')) {
    const assets = await assetsPromise;
    renderDownloadKpi(assets);
    renderReleaseTable(assets);
    showBanner('config.js에 SUPABASE_URL / SUPABASE_ANON_KEY를 설정해주세요 (config.example.js 참고).');
    return;
  }

  if (!sb) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  const range = document.getElementById('rangeSelect').value;

  try {
    const [summaryRows, daily, dailyDevices, versions, assets] = await Promise.all([
      fetchView('gongcance_v_summary'),
      fetchView('gongcance_v_daily_events', 'day'),
      fetchView('gongcance_v_daily_devices', 'day'),
      fetchView('gongcance_v_versions'),
      assetsPromise,
    ]);

    renderKpis(summaryRows[0] || {}, assets);
    const grouped = groupDaily(filterByRange(daily, range), filterByRange(dailyDevices, range));
    renderLegend();
    renderChart(grouped);
    renderDailyTable(grouped);
    renderReleaseTable(assets);
    renderVersionTable(versions);
  } catch (err) {
    console.error(err);
    const assets = await assetsPromise;
    renderDownloadKpi(assets);
    renderReleaseTable(assets);
    const hint = /gongcance_v_|relation|schema cache/.test(err.message || '')
      ? ' — Supabase SQL Editor에서 supabase/schema.sql을 먼저 실행했는지 확인해주세요.'
      : '';
    showBanner(`데이터를 불러오지 못했습니다: ${err.message || err}${hint}`);
  }
}

document.getElementById('rangeSelect').addEventListener('change', loadAll);
document.getElementById('refreshBtn').addEventListener('click', loadAll);

loadAll();

// 🌱 Mom's Seed Rating Page Generator
// Paste this in browser console at planter.garden while logged in

(async function() {
  console.log('🌱 Reading seed data from Planter...');

  const dbName = 'firestore/[DEFAULT]/gardenplanner-1485566704680/main';
  const idb = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const tx = idb.transaction('remoteDocumentsV14', 'readonly');
  const store = tx.objectStore('remoteDocumentsV14');
  const all = await new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  idb.close();

  const getValue = (f) => {
    if (!f) return null;
    if (f.stringValue !== undefined) return f.stringValue;
    if (f.integerValue !== undefined) return parseInt(f.integerValue);
    if (f.booleanValue !== undefined) return f.booleanValue;
    return null;
  };

  // Extract seeds, varieties, plants
  const rawSeeds = all
    .filter(d => d.collectionGroup === 'seeds' && d.document)
    .map(d => {
      const f = d.document.fields;
      const note = f.note?.mapValue?.fields;
      return {
        id: d.documentId,
        plantId: getValue(f.plantId),
        varietyId: getValue(f.varietyId),
        source: getValue(f.source),
        status: getValue(f.status),
        year: getValue(f.year),
        note: note ? getValue(note.note) : ''
      };
    });

  const varietyMap = {};
  all.filter(d => d.collectionGroup === 'varieties' && d.document)
     .forEach(d => {
       const f = d.document.fields;
       varietyMap[d.documentId] = getValue(f.name);
     });

  const plantMap = {};
  all.filter(d => d.collectionGroup === 'plants' && d.document)
     .forEach(d => {
       const f = d.document.fields;
       plantMap[d.documentId] = getValue(f.name);
     });

  console.log(`Found ${rawSeeds.length} seeds, ${Object.keys(varietyMap).length} varieties, ${Object.keys(plantMap).length} plants`);

  // Normalize plant names
  const normalizePlant = (name) => {
    if (!name) return 'Unknown';
    const n = name.toLowerCase();
    const map = {
      'tomatoes': 'Tomato', 'peppers': 'Pepper', 'beans': 'Bean', 'peas': 'Pea',
      'carrots': 'Carrot', 'beets': 'Beet', 'onions': 'Onion', 'cucumbers': 'Cucumber',
      'radishes': 'Radish', 'potatoes': 'Potato', 'turnips': 'Turnip', 'parsnips': 'Parsnip',
      'leeks': 'Leek', 'collards': 'Collard', 'chard': 'Chard'
    };
    return map[n] || name.charAt(0).toUpperCase() + name.slice(1);
  };

  // Build entries with names and dedupe
  const dedupeMap = new Map();
  rawSeeds.forEach(seed => {
    const plant = normalizePlant(plantMap[seed.plantId] || 'Unknown');
    const variety = varietyMap[seed.varietyId] || '';
    const key = `${plant.toLowerCase()}|${variety.toLowerCase()}`;

    if (dedupeMap.has(key)) {
      const existing = dedupeMap.get(key);
      if (seed.source && !existing.sources.includes(seed.source)) {
        existing.sources.push(seed.source);
      }
      if (seed.year && (!existing.year || seed.year > existing.year)) {
        existing.year = seed.year;
      }
    } else {
      dedupeMap.set(key, {
        id: seed.id,
        plant,
        variety,
        sources: seed.source ? [seed.source] : [],
        year: seed.year,
        status: seed.status,
        note: seed.note
      });
    }
  });

  const seeds = Array.from(dedupeMap.values()).sort((a, b) => {
    const p = a.plant.localeCompare(b.plant);
    return p !== 0 ? p : (a.variety || '').localeCompare(b.variety || '');
  });

  // Group by plant
  const groups = {};
  seeds.forEach(s => {
    if (!groups[s.plant]) groups[s.plant] = [];
    groups[s.plant].push(s);
  });

  const uniqueSources = [...new Set(seeds.flatMap(s => s.sources))].filter(Boolean).sort();

  const statusLabels = {
    'empty': 'Empty', 'nearly_empty': 'Low', 'half_full': 'Half',
    'mostly_full': 'Good', 'full': 'Full', 'partial': 'Some'
  };

  // Generate card sections
  let sectionsHtml = '';
  Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0])).forEach(([plant, items]) => {
    const plantId = 'plant_' + plant.toLowerCase().replace(/[^a-z0-9]/g, '_');

    let itemsHtml = '';
    items.forEach((item, idx) => {
      const statusLabel = statusLabels[item.status] || item.status || 'Full';
      const sourceDisplay = item.sources.length > 1
        ? `<select class="source-select"><option>Any</option>${item.sources.map(s => `<option>${s}</option>`).join('')}</select>`
        : `<span class="source">${item.sources[0] || ''}</span>`;

      itemsHtml += `
        <div class="seed-item">
          <div class="seed-info">
            <span class="variety-name">${item.variety || '(standard)'}</span>
            <div class="seed-details">
              ${sourceDisplay}
              <span class="year">${item.year || ''}</span>
              <span class="status-pill ${item.status || 'full'}">${statusLabel}</span>
            </div>
          </div>
          <div class="rating variety-rating" data-key="${item.id}" data-plant="${plant}" data-variety="${item.variety || ''}">
            <button class="star" data-value="1">☆</button>
            <button class="star" data-value="2">☆</button>
            <button class="star" data-value="3">☆</button>
          </div>
        </div>`;
    });

    sectionsHtml += `
      <div class="plant-section" data-plant-id="${plantId}">
        <div class="plant-header">
          <span class="toggle-icon">▶</span>
          <span class="plant-name">${plant}</span>
          <span class="plant-count">${items.length} ${items.length === 1 ? 'variety' : 'varieties'}</span>
          <div class="rating section-rating" data-key="${plantId}" data-plant="${plant}">
            <button class="star" data-value="1">☆</button>
            <button class="star" data-value="2">☆</button>
            <button class="star" data-value="3">☆</button>
          </div>
        </div>
        <div class="varieties">${itemsHtml}</div>
      </div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
  <title>🌱 Mom's Garden Picks</title>
  <style>
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px; margin: 0 auto; padding: 16px;
      background: #1a1a1a; color: #e0e0e0;
    }
    h1 { text-align: center; color: #a4b862; margin-bottom: 8px; font-size: 1.6em; }
    .instructions {
      background: #2d2d2d; padding: 16px; border-radius: 12px; margin-bottom: 16px;
      border: 1px solid #3d4a2a; font-size: 15px; text-align: center;
    }
    .instructions .greeting { font-size: 18px; margin-bottom: 8px; }
    .instructions .how-to { margin: 10px 0; }
    .instructions small { color: #999; font-size: 13px; display: block; margin-top: 8px; }
    .stats { text-align: center; color: #888; margin-bottom: 16px; font-size: 14px; }
    .plant-section {
      background: #242424; border-radius: 10px; margin-bottom: 8px; overflow: hidden;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
    .plant-header {
      background: #3d4a2a; padding: 12px 14px; display: flex; align-items: center; gap: 10px;
      cursor: pointer; user-select: none;
    }
    .plant-header:hover { background: #4a5a35; }
    .toggle-icon { font-size: 12px; color: #888; transition: transform 0.2s; width: 12px; }
    .plant-section.open .toggle-icon { transform: rotate(90deg); }
    .plant-name { font-weight: bold; font-size: 1.1em; color: #c5d99a; }
    .plant-count { color: #888; font-size: 0.85em; margin-right: auto; }
    .varieties { display: none; padding: 0; }
    .plant-section.open .varieties { display: block; }
    .seed-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 14px; border-bottom: 1px solid #333;
    }
    .seed-item:last-child { border-bottom: none; }
    .seed-info { flex: 1; min-width: 0; }
    .variety-name { display: block; font-weight: 600; color: #e0e0e0; font-size: 15px; margin-bottom: 4px; }
    .seed-details { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .source { font-size: 12px; color: #8a8a8a; }
    .source-select { font-size: 12px; padding: 2px 6px; border-radius: 4px; border: 1px solid #555; background: #333; color: #e0e0e0; }
    .year { font-size: 12px; color: #6a6a6a; }
    .status-pill {
      font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
    }
    .status-pill.full { background: #2a3d2a; color: #90c990; }
    .status-pill.mostly_full { background: #354a2a; color: #a4d194; }
    .status-pill.half_full { background: #4a3a20; color: #ffb347; }
    .status-pill.nearly_empty { background: #4a2020; color: #ff6b6b; }
    .status-pill.empty { background: #4a2020; color: #ff6b6b; }
    .rating { display: flex; gap: 2px; flex-shrink: 0; }
    .star {
      font-size: 26px; cursor: pointer; color: #555; background: none;
      border: none; padding: 4px 2px; line-height: 1; transition: color 0.15s;
      -webkit-user-select: none; user-select: none; touch-action: manipulation;
    }
    .star.active { color: #ffc107; }
    .star:disabled { opacity: 0.3; cursor: not-allowed; }
    .section-rating .star { font-size: 22px; }
    .actions {
      display: flex; gap: 10px; justify-content: center; margin: 20px 0; flex-wrap: wrap;
      position: sticky; bottom: 10px; background: #1a1a1a; padding: 10px; border-radius: 8px;
    }
    .btn {
      padding: 14px 28px; font-size: 16px; border: none; border-radius: 8px;
      cursor: pointer; font-weight: 500;
    }
    .btn-primary { background: #556b2f; color: #fff; }
    .btn-primary:hover { background: #6b8e23; }
    .btn-secondary { background: #444; color: #e0e0e0; }
    .btn-secondary:hover { background: #555; }
    noscript {
      display: block; background: #5a3a3a; color: #ffb3b3; padding: 16px;
      border-radius: 8px; text-align: center; margin-bottom: 16px; font-size: 16px;
    }
    @media (max-width: 600px) {
      body { padding: 10px; }
      .star { font-size: 22px; padding: 6px 3px; }
      .section-rating .star { font-size: 20px; }
      .btn { width: 100%; padding: 16px; }
    }
  </style>
</head>
<body>
  <h1>🌱 Mom's Garden Picks 🌻</h1>
  <noscript>
    <strong>📱 Open in Safari!</strong><br>
    Tap the share button then "Open in Safari" to use this page.
  </noscript>
  <div class="instructions">
    <div class="greeting">💚 Hi Mom! 💚</div>
    <div>Help me decide what to grow this year by rating the seeds you'd like to see in the garden!</div>
    <div class="how-to">
      ⭐ = Maybe &nbsp;&nbsp; ⭐⭐ = Yes please! &nbsp;&nbsp; ⭐⭐⭐ = Must grow!
    </div>
    <small>🥕 Tap a plant to expand and see varieties. Rate the whole plant or pick specific ones.<br>
    Rate as many or as few as you'd like — no pressure! 🍅</small>
  </div>
  <div class="stats">🌿 ${seeds.length} seeds from ${uniqueSources.length} sources ready to plant!</div>
  ${sectionsHtml}
  <div class="actions">
    <button class="btn btn-primary" id="email-btn">💌 Email to Favorite Son</button>
    <button class="btn btn-secondary" id="clear-btn">🗑️ Start Over</button>
  </div>

  <script>
    let ratings = {};
    try { ratings = JSON.parse(localStorage.getItem('seedRatings') || '{}'); } catch(e) {}

    function updateStars(container, value) {
      const stars = container.querySelectorAll('.star');
      for (let i = 0; i < stars.length; i++) {
        stars[i].textContent = i < value ? '★' : '☆';
        stars[i].classList.toggle('active', i < value);
      }
    }

    function setVarietiesDisabled(section, disabled) {
      section.querySelectorAll('.variety-rating .star').forEach(s => s.disabled = disabled);
    }

    // Restore saved ratings
    document.querySelectorAll('.rating').forEach(r => {
      const key = r.dataset.key;
      if (ratings[key]) {
        updateStars(r, ratings[key]);
        if (r.classList.contains('section-rating')) {
          setVarietiesDisabled(r.closest('.plant-section'), true);
        }
      }
    });

    // Toggle sections on header click
    document.querySelectorAll('.plant-header').forEach(header => {
      header.addEventListener('click', (e) => {
        // Don't toggle if clicking on stars
        if (e.target.closest('.rating')) return;
        const section = header.closest('.plant-section');
        section.classList.toggle('open');
      });
    });

    // Star clicks
    document.body.addEventListener('click', (e) => {
      const star = e.target.closest('.star');
      if (!star || star.disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const rating = star.closest('.rating');
      const key = rating.dataset.key;
      const value = parseInt(star.dataset.value);
      const isSection = rating.classList.contains('section-rating');

      if (ratings[key] === value) {
        delete ratings[key];
        updateStars(rating, 0);
        if (isSection) setVarietiesDisabled(rating.closest('.plant-section'), false);
      } else {
        ratings[key] = value;
        updateStars(rating, value);
        if (isSection) {
          const section = rating.closest('.plant-section');
          setVarietiesDisabled(section, true);
          section.querySelectorAll('.variety-rating').forEach(vr => {
            delete ratings[vr.dataset.key];
            updateStars(vr, 0);
          });
        }
      }
      try { localStorage.setItem('seedRatings', JSON.stringify(ratings)); } catch(e) {}
    });

    function getReportText() {
      const items = [];
      Object.entries(ratings).forEach(([key, rating]) => {
        const el = document.querySelector('[data-key="' + key + '"]');
        if (!el) return;
        const plant = el.dataset.plant || '';
        const variety = el.dataset.variety || '';
        const isSection = el.classList.contains('section-rating');
        items.push({ plant, variety, rating, isSection });
      });

      if (!items.length) return null;

      const grouped = { 3: [], 2: [], 1: [] };
      items.forEach(s => {
        const text = s.isSection ? s.plant + ' (any variety)' : s.plant + (s.variety ? ' - ' + s.variety : '');
        grouped[s.rating].push({ text, plant: s.plant });
      });
      Object.values(grouped).forEach(g => g.sort((a, b) => a.plant.localeCompare(b.plant)));

      let text = "🌱 Mom's Garden Picks 🌻\\n\\n";
      if (grouped[3].length) {
        text += "⭐⭐⭐ MUST GROW!\\n";
        grouped[3].forEach(s => text += "• " + s.text + "\\n");
        text += "\\n";
      }
      if (grouped[2].length) {
        text += "⭐⭐ Yes Please!\\n";
        grouped[2].forEach(s => text += "• " + s.text + "\\n");
        text += "\\n";
      }
      if (grouped[1].length) {
        text += "⭐ Maybe\\n";
        grouped[1].forEach(s => text += "• " + s.text + "\\n");
      }
      text += "\\n💚 Love, Mom";
      return text;
    }

    document.getElementById('email-btn').addEventListener('click', () => {
      const text = getReportText();
      if (!text) { alert('Please rate at least one seed first! 🌱'); return; }
      const subject = "🌱 Mom's Garden Picks for " + new Date().getFullYear();
      window.location.href = 'mailto:jake.mathews@me.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(text);
    });

    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Start over and clear all ratings?')) {
        ratings = {};
        try { localStorage.removeItem('seedRatings'); } catch(e) {}
        document.querySelectorAll('.star').forEach(s => { s.textContent = '☆'; s.classList.remove('active'); s.disabled = false; });
      }
    });
  </script>
</body>
</html>`;

  // Download
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'seed-rating.html';
  a.click();
  console.log('🌱 Downloaded seed-rating.html with', seeds.length, 'unique seed entries!');
})();

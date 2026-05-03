// CONFIG
const API_KEY = 'YOUR_TMDB_API_KEY'; // <-- REPLACE WITH YOUR REAL TMDB API KEY
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';

// Global state
let currentFilter = 'movie'; // movie or tv
let currentPage = 1;
let currentQuery = '';
let currentGenreId = null;
let currentStudio = null;
let isLoading = false;
let totalResults = 0;

// Helper fetch
async function fetchFromTMDB(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.append('api_key', API_KEY);
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url);
  return res.json();
}

// Get genres (movie & tv) for sidebar
async function loadGenres() {
  const [movieGenres, tvGenres] = await Promise.all([
    fetchFromTMDB('/genre/movie/list'),
    fetchFromTMDB('/genre/tv/list')
  ]);
  const allGenres = [...(movieGenres.genres || []), ...(tvGenres.genres || [])];
  const unique = new Map();
  allGenres.forEach(g => { if (!unique.has(g.id)) unique.set(g.id, g); });
  const genresList = Array.from(unique.values());
  const container = document.getElementById('genres-list');
  if (container) {
    container.innerHTML = genresList.map(g => `<a href="#" data-genre-id="${g.id}" data-genre-name="${g.name}">${g.name}</a>`).join('');
    document.querySelectorAll('[data-genre-id]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        currentGenreId = el.dataset.genreId;
        currentStudio = null;
        currentQuery = '';
        currentPage = 1;
        loadContent(true);
      });
    });
  }
}

// Load movies or tv based on filter
async function loadContent(reset = true) {
  if (isLoading) return;
  isLoading = true;
  if (reset) {
    currentPage = 1;
    document.getElementById('movies-grid').innerHTML = '';
  }
  document.getElementById('loader').style.display = 'flex';
  
  let endpoint = '';
  let params = { page: currentPage };
  if (currentQuery) {
    endpoint = `/search/${currentFilter}`;
    params.query = currentQuery;
  } else if (currentGenreId) {
    endpoint = `/discover/${currentFilter}`;
    params.with_genres = currentGenreId;
  } else if (currentStudio) {
    endpoint = `/discover/${currentFilter}`;
    if (currentStudio === 'Netflix') params.with_networks = '213';
    else if (currentStudio === 'Prime') params.with_companies = '174';
    else if (currentStudio === 'Disney') params.with_companies = '2739';
    else if (currentStudio === 'HBO') params.with_networks = '49';
    else if (currentStudio === 'Apple') params.with_companies = '2';
  } else {
    endpoint = `/${currentFilter}/popular`;
  }
  
  const data = await fetchFromTMDB(endpoint, params);
  totalResults = data.total_results;
  displayContent(data.results);
  isLoading = false;
  document.getElementById('loader').style.display = 'none';
}

function displayContent(items) {
  const grid = document.getElementById('movies-grid');
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.dataset.id = item.id;
    card.dataset.type = currentFilter;
    card.dataset.title = item.title || item.name;
    card.dataset.poster = item.poster_path ? IMG_URL + item.poster_path : '';
    card.innerHTML = `
      <img loading="lazy" src="${item.poster_path ? IMG_URL + item.poster_path : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title || item.name}">
      <div class="movie-info"><h3>${item.title || item.name}</h3><p>⭐ ${item.vote_average?.toFixed(1) || 'N/A'}</p></div>
    `;
    card.addEventListener('click', () => {
      incrementClickCount(item.id, currentFilter);
      if (currentFilter === 'movie') window.location.href = `watch.html?type=movie&id=${item.id}`;
      else window.location.href = `tvshows.html?id=${item.id}`;
    });
    grid.appendChild(card);
  });
  document.getElementById('load-more').style.display = (grid.children.length < totalResults) ? 'block' : 'none';
}

// Slider: top 6 most clicked in last 24h
function incrementClickCount(id, type) {
  let clicks = JSON.parse(localStorage.getItem('clickStats')) || {};
  const key = `${type}_${id}`;
  const now = Date.now();
  if (!clicks[key]) clicks[key] = { count: 0, last24h: [] };
  clicks[key].last24h.push(now);
  clicks[key].count++;
  // clean older than 24h
  const dayAgo = now - 86400000;
  clicks[key].last24h = clicks[key].last24h.filter(ts => ts > dayAgo);
  clicks[key].count = clicks[key].last24h.length;
  localStorage.setItem('clickStats', clicks);
}

async function getTopSliderItems() {
  const clicks = JSON.parse(localStorage.getItem('clickStats')) || {};
  const entries = Object.entries(clicks).map(([key, val]) => ({ key, count: val.last24h.length }));
  entries.sort((a,b) => b.count - a.count);
  const top6 = entries.slice(0,6);
  const items = [];
  for (let entry of top6) {
    const [type, id] = entry.key.split('_');
    const data = await fetchFromTMDB(`/${type}/${id}`);
    items.push({ ...data, media_type: type });
  }
  return items;
}

async function renderSlider() {
  const track = document.getElementById('slider-track');
  if (!track) return;
  const items = await getTopSliderItems();
  track.innerHTML = items.map(item => `
    <div class="slider-card" onclick="location.href='${item.media_type === 'movie' ? `watch.html?type=movie&id=${item.id}` : `tvshows.html?id=${item.id}`}'">
      <img src="${IMG_URL + item.poster_path}" loading="lazy">
      <div class="movie-info"><h3>${item.title || item.name}</h3></div>
    </div>
  `).join('');
}

// Favorites / Watch Later / Continue Watching (localStorage)
function addToList(type, id, title, poster, mediaType) {
  let list = JSON.parse(localStorage.getItem(type)) || [];
  if (!list.some(i => i.id == id)) {
    list.push({ id, title, poster, mediaType, addedAt: Date.now() });
    localStorage.setItem(type, list);
  }
}

function renderSidebarLists() {
  // Sidebar links show count, on click show filtered grid
  document.querySelectorAll('[data-list]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const listName = btn.dataset.list;
      const items = JSON.parse(localStorage.getItem(listName)) || [];
      displayUserList(items);
    });
  });
}

function displayUserList(items) {
  const grid = document.getElementById('movies-grid');
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'movie-card';
    card.innerHTML = `<img src="${item.poster}" loading="lazy"><div class="movie-info"><h3>${item.title}</h3></div>`;
    card.onclick = () => { if (item.mediaType === 'movie') location.href=`watch.html?type=movie&id=${item.id}`; else location.href=`tvshows.html?id=${item.id}`; };
    grid.appendChild(card);
  });
}

// Studio filters
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-studio]')) {
    e.preventDefault();
    currentStudio = e.target.closest('[data-studio]').dataset.studio;
    currentGenreId = null;
    currentQuery = '';
    currentPage = 1;
    loadContent(true);
  }
});

// Search
document.getElementById('search-input')?.addEventListener('input', debounce((e) => {
  currentQuery = e.target.value;
  currentGenreId = null;
  currentStudio = null;
  currentPage = 1;
  loadContent(true);
}, 500));

// Load more
document.getElementById('load-more')?.addEventListener('click', () => {
  currentPage++;
  loadContent(false);
});

// Slider arrows
document.querySelector('.slider-prev')?.addEventListener('click', () => {
  document.querySelector('.slider-track').scrollBy({ left: -300, behavior: 'smooth' });
});
document.querySelector('.slider-next')?.addEventListener('click', () => {
  document.querySelector('.slider-track').scrollBy({ left: 300, behavior: 'smooth' });
});

function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

// Page inits
async function initIndexPage() {
  await loadGenres();
  renderSidebarLists();
  currentFilter = 'movie';
  currentPage = 1;
  await loadContent(true);
  await renderSlider();
  setInterval(() => { renderSlider(); }, 86400000); // refresh every 24h
}

async function initTVPage() {
  await loadGenres();
  renderSidebarLists();
  currentFilter = 'tv';
  currentPage = 1;
  await loadContent(true);
  await renderSlider();
}

async function initTVShowDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  const data = await fetchFromTMDB(`/tv/${id}`);
  const container = document.getElementById('tv-detail-container');
  container.innerHTML = `
    <div style="display:flex; gap:30px; flex-wrap:wrap;">
      <img src="${IMG_URL + data.poster_path}" style="width:200px; border-radius:16px;">
      <div><h1>${data.name}</h1><p>${data.overview}</p><p>⭐ ${data.vote_average}</p>
      <button onclick="addToList('favorites', ${data.id}, '${data.name}', '${IMG_URL + data.poster_path}', 'tv')">❤️ Favorite</button>
      <button onclick="location.href='watch.html?type=tv&id=${data.id}&season=1&episode=1'">▶ Watch Season 1 Ep 1</button>
      </div>
    </div>
  `;
}

function initWatchPage() {
  const params = new URLSearchParams(location.search);
  const type = params.get('type');
  const id = params.get('id');
  const season = params.get('season') || 1;
  const episode = params.get('episode') || 1;
  let embedUrl = '';
  if (type === 'movie') embedUrl = `https://www.youtube.com/embed/?listType=search&q=${encodeURIComponent('movie trailer')}`;
  else embedUrl = `https://www.youtube.com/embed/?listType=search&q=${encodeURIComponent('tv show trailer')}`;
  document.getElementById('player-iframe').src = embedUrl;
  document.getElementById('save-continue').onclick = () => {
    let cont = JSON.parse(localStorage.getItem('continue')) || [];
    cont.push({ id, type, timestamp: Date.now() });
    localStorage.setItem('continue', cont);
    alert('Saved to Continue Watching');
  };
}

// expose globally for onclick
window.addToList = addToList;
window.initIndexPage = initIndexPage;
window.initTVPage = initTVPage;
window.initTVShowDetail = initTVShowDetail;
window.initWatchPage = initWatchPage;

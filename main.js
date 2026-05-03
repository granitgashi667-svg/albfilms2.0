// CONFIG
const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';

// Global state
let currentType = 'movie';
let currentSort = 'top_rated';
let currentGenre = null;
let currentStudio = null;
let currentQuery = '';
let currentPage = 1;
let totalPages = 1;
let isLoading = false;
let isTurkishMode = false;

// LocalStorage lists
let favorites = JSON.parse(localStorage.getItem('alb_favorites')) || [];
let watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || [];
let continueWatching = JSON.parse(localStorage.getItem('alb_continue')) || [];

function saveFav() { localStorage.setItem('alb_favorites', JSON.stringify(favorites)); }
function saveWatch() { localStorage.setItem('alb_watchlist', JSON.stringify(watchlist)); }
function saveContinue() { localStorage.setItem('alb_continue', JSON.stringify(continueWatching)); }

// Helper fetch
async function fetchAPI(endpoint, params = {}) {
    const url = new URL(`${BASE}${endpoint}`);
    url.searchParams.append('api_key', API_KEY);
    Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
    const res = await fetch(url);
    return res.json();
}

// Load genres for modal
async function loadGenresModal() {
    const movieGenres = await fetchAPI('/genre/movie/list');
    const tvGenres = await fetchAPI('/genre/tv/list');
    const all = [...movieGenres.genres, ...tvGenres.genres];
    const unique = new Map();
    all.forEach(g => { if (!unique.has(g.id)) unique.set(g.id, g); });
    const container = document.getElementById('genreGrid');
    if (!container) return;
    container.innerHTML = '';
    unique.forEach(genre => {
        const btn = document.createElement('button');
        btn.textContent = genre.name;
        btn.onclick = () => {
            currentGenre = genre.id;
            currentStudio = null;
            currentQuery = '';
            isTurkishMode = false;
            currentPage = 1;
            loadContent(true);
            document.getElementById('genreModal').style.display = 'none';
        };
        container.appendChild(btn);
    });
}

// Load content (movies or tv)
async function loadContent(reset = true) {
    if (isLoading) return;
    isLoading = true;
    if (reset) {
        currentPage = 1;
        document.getElementById('moviesGrid').innerHTML = '';
    }
    document.getElementById('loader').style.display = 'flex';
    
    let endpoint = '';
    let params = { page: currentPage };
    
    if (isTurkishMode && currentType === 'tv') {
        endpoint = '/discover/tv';
        params.with_origin_country = 'TR';
        params.sort_by = 'popularity.desc';
        params['vote_count.gte'] = 10;
    } 
    else if (currentQuery && currentQuery.length >= 3) {
        endpoint = `/search/${currentType}`;
        params.query = currentQuery;
    } 
    else if (currentGenre) {
        endpoint = `/discover/${currentType}`;
        params.with_genres = currentGenre;
        params.sort_by = currentSort === 'top_rated' ? 'vote_average.desc' : 'popularity.desc';
        if (currentSort === 'top_rated') params['vote_count.gte'] = 200;
    } 
    else if (currentStudio) {
        endpoint = `/discover/${currentType}`;
        if (currentStudio === 'Netflix') params.with_networks = '213';
        else if (currentStudio === 'Prime') params.with_companies = '174';
        else if (currentStudio === 'Disney') params.with_companies = '2739';
        else if (currentStudio === 'HBO') params.with_networks = '49';
        else if (currentStudio === 'Apple') params.with_companies = '2';
        params.sort_by = currentSort === 'top_rated' ? 'vote_average.desc' : 'popularity.desc';
    } 
    else {
        endpoint = `/${currentType}/${currentSort === 'top_rated' ? 'top_rated' : 'popular'}`;
    }
    
    const data = await fetchAPI(endpoint, params);
    totalPages = Math.min(data.total_pages, 200);
    displayGrid(data.results);
    isLoading = false;
    document.getElementById('loader').style.display = 'none';
    document.getElementById('loadMoreBtn').style.display = (currentPage < totalPages) ? 'block' : 'none';
}

// Display grid with favorite/watchlater icons and hover popup
function displayGrid(items) {
    const grid = document.getElementById('moviesGrid');
    for (let item of items) {
        const id = item.id;
        const title = item.title || item.name;
        const poster = item.poster_path ? IMG + item.poster_path : '';
        const rating = item.vote_average?.toFixed(1) || 'N/A';
        const isFav = favorites.some(f => f.id == id && f.type === currentType);
        const isWatch = watchlist.some(w => w.id == id && w.type === currentType);
        
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.dataset.id = id;
        card.dataset.type = currentType;
        card.dataset.title = title;
        card.dataset.poster = poster;
        card.dataset.rating = rating;
        card.dataset.overview = item.overview || '';
        
        card.innerHTML = `
            <img loading="lazy" src="${poster}" alt="${title}">
            <div class="card-actions">
                <i class="fas fa-heart" style="color: ${isFav ? '#e50914' : '#fff'};"></i>
                <i class="fas fa-clock" style="color: ${isWatch ? '#ffaa00' : '#fff'};"></i>
            </div>
            <div class="card-info">
                <h3>${title}</h3>
                <p>⭐ ${rating}</p>
            </div>
        `;
        
        // Favorite click
        const heart = card.querySelector('.fa-heart');
        heart.addEventListener('click', (e) => {
            e.stopPropagation();
            if (favorites.some(f => f.id == id && f.type === currentType)) {
                favorites = favorites.filter(f => !(f.id == id && f.type === currentType));
                heart.style.color = '#fff';
            } else {
                favorites.push({ id, type: currentType, title, poster, rating, overview: item.overview });
                heart.style.color = '#e50914';
            }
            saveFav();
        });
        
        // Watch later click
        const clock = card.querySelector('.fa-clock');
        clock.addEventListener('click', (e) => {
            e.stopPropagation();
            if (watchlist.some(w => w.id == id && w.type === currentType)) {
                watchlist = watchlist.filter(w => !(w.id == id && w.type === currentType));
                clock.style.color = '#fff';
            } else {
                watchlist.push({ id, type: currentType, title, poster, rating, overview: item.overview });
                clock.style.color = '#ffaa00';
            }
            saveWatch();
        });
        
        // Click card -> go to watch/tv page
        card.addEventListener('click', (e) => {
            if (e.target.tagName === 'I') return;
            incrementClick(id, currentType);
            if (currentType === 'movie') window.location.href = `watch.html?id=${id}&type=movie`;
            else window.location.href = `tv.html?id=${id}`;
        });
        
        // Hover popup
        let popupTimeout;
        card.addEventListener('mouseenter', (e) => {
            if (popupTimeout) clearTimeout(popupTimeout);
            showHoverPopup(card, id, currentType, e);
        });
        card.addEventListener('mouseleave', () => {
            popupTimeout = setTimeout(() => {
                const popup = document.getElementById('hoverPopup');
                if (popup) popup.style.display = 'none';
            }, 200);
        });
        
        grid.appendChild(card);
    }
}

// Show hover popup with trailer and description
let trailerCache = {};
async function showHoverPopup(card, id, type, event) {
    const popup = document.getElementById('hoverPopup');
    if (!popup) return;
    
    // Get or fetch trailer
    let trailerKey = trailerCache[`${type}_${id}`];
    if (!trailerKey) {
        const trailData = await fetchAPI(`/${type}/${id}/videos`);
        const trailer = trailData.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        trailerKey = trailer ? trailer.key : null;
        trailerCache[`${type}_${id}`] = trailerKey;
    }
    
    const title = card.dataset.title;
    const overview = card.dataset.overview?.substring(0, 150) || 'No description';
    const rating = card.dataset.rating;
    
    popup.innerHTML = `
        <div id="popupTrailer">${trailerKey ? `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media"></iframe>` : '<div style="height:120px; background:#000; display:flex; align-items:center; justify-content:center;">No trailer</div>'}</div>
        <div class="popup-title">${title}</div>
        <div class="popup-desc">${overview}... <br>⭐ ${rating}/10</div>
    `;
    popup.style.display = 'block';
    
    // Position near cursor
    const updatePos = (e) => {
        popup.style.left = (e.clientX + 20) + 'px';
        popup.style.top = (e.clientY - 100) + 'px';
    };
    updatePos(event);
    card.addEventListener('mousemove', updatePos);
    card.addEventListener('mouseleave', () => {
        card.removeEventListener('mousemove', updatePos);
    });
}

// Slider (most clicked last 24h)
async function renderSlider() {
    const stats = JSON.parse(localStorage.getItem('clickStats')) || {};
    const entries = Object.entries(stats).map(([key, val]) => ({ key, count: val.clicks?.filter(t => t > Date.now() - 86400000).length || 0 }));
    entries.sort((a,b) => b.count - a.count);
    const top6 = entries.slice(0,6);
    const track = document.getElementById('sliderTrack');
    if (!track) return;
    track.innerHTML = '';
    for (let entry of top6) {
        const [type, id] = entry.key.split('_');
        const data = await fetchAPI(`/${type}/${id}`);
        if (data && data.poster_path) {
            const card = document.createElement('div');
            card.className = 'slider-card';
            card.innerHTML = `
                <img src="${IMG + data.poster_path}" loading="lazy">
                <div class="slider-info">
                    <h4>${data.title || data.name}</h4>
                    <p>${(data.overview || '').substring(0, 80)}...</p>
                </div>
            `;
            card.onclick = () => {
                if (type === 'movie') location.href = `watch.html?id=${id}&type=movie`;
                else location.href = `tv.html?id=${id}`;
            };
            track.appendChild(card);
        }
    }
    if (top6.length < 6) {
        const fallback = await fetchAPI(`/${currentType}/popular`, { page: 1 });
        for (let i = 0; i < 6 - top6.length && i < fallback.results.length; i++) {
            const item = fallback.results[i];
            const card = document.createElement('div');
            card.className = 'slider-card';
            card.innerHTML = `<img src="${IMG + item.poster_path}"><div class="slider-info"><h4>${item.title || item.name}</h4><p>${(item.overview || '').substring(0,80)}...</p></div>`;
            card.onclick = () => {
                if (currentType === 'movie') location.href = `watch.html?id=${item.id}&type=movie`;
                else location.href = `tv.html?id=${item.id}`;
            };
            track.appendChild(card);
        }
    }
}

function incrementClick(id, type) {
    let stats = JSON.parse(localStorage.getItem('clickStats')) || {};
    const key = `${type}_${id}`;
    const now = Date.now();
    if (!stats[key]) stats[key] = { clicks: [] };
    stats[key].clicks = (stats[key].clicks || []).filter(t => t > now - 86400000);
    stats[key].clicks.push(now);
    localStorage.setItem('clickStats', stats);
}

// Load 100 Greatest
async function loadGreats() {
    const movieTop = await fetchAPI('/movie/top_rated', { page: 1 });
    const tvTop = await fetchAPI('/tv/top_rated', { page: 1 });
    const movieSlider = document.getElementById('greatMoviesSlider');
    const tvSlider = document.getElementById('greatTvSlider');
    if (movieSlider) {
        movieSlider.innerHTML = movieTop.results.slice(0, 20).map(m => `
            <div class="great-card" data-id="${m.id}" data-type="movie">
                <img src="${IMG + m.poster_path}">
                <div class="card-info"><h3>${m.title}</h3></div>
            </div>
        `).join('');
        document.querySelectorAll('#greatMoviesSlider .great-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                location.href = `watch.html?id=${id}&type=movie`;
            });
        });
    }
    if (tvSlider) {
        tvSlider.innerHTML = tvTop.results.slice(0, 20).map(t => `
            <div class="great-card" data-id="${t.id}" data-type="tv">
                <img src="${IMG + t.poster_path}">
                <div class="card-info"><h3>${t.name}</h3></div>
            </div>
        `).join('');
        document.querySelectorAll('#greatTvSlider .great-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                location.href = `tv.html?id=${id}`;
            });
        });
    }
}

// Load Turkish TV shows
async function loadTurkishTV() {
    isTurkishMode = true;
    currentGenre = null;
    currentStudio = null;
    currentQuery = '';
    currentType = 'tv';
    currentPage = 1;
    await loadContent(true);
    document.getElementById('sectionTitle').innerText = 'Turkish TV Series';
    document.querySelectorAll('.filter-tab').forEach(btn => {
        if (btn.dataset.type === 'tv') btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// Slider drag & buttons
function initSliderControls() {
    const track = document.querySelector('.slider-track');
    if (!track) return;
    const prevBtn = document.querySelector('.slider-nav.prev');
    const nextBtn = document.querySelector('.slider-nav.next');
    let isDown = false, startX, scrollLeft;
    track.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - track.offsetLeft; scrollLeft = track.scrollLeft; });
    track.addEventListener('mouseleave', () => { isDown = false; });
    track.addEventListener('mouseup', () => { isDown = false; });
    track.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - track.offsetLeft; const walk = (x - startX) * 1.5; track.scrollLeft = scrollLeft - walk; });
    if (prevBtn) prevBtn.onclick = () => { track.scrollBy({ left: -300, behavior: 'smooth' }); };
    if (nextBtn) nextBtn.onclick = () => { track.scrollBy({ left: 300, behavior: 'smooth' }); };
}

// Bind all events (including sidebar links)
function bindEvents() {
    // Filter tabs (Movies/TV)
    document.querySelectorAll('.filter-tab').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
            isTurkishMode = false;
            currentPage = 1;
            currentGenre = null;
            currentStudio = null;
            currentQuery = '';
            document.getElementById('searchInput').value = '';
            loadContent(true);
            document.getElementById('sectionTitle').innerText = currentType === 'movie' ? 'Top Rated Movies' : 'Top Rated TV Series';
            renderSlider();
        };
    });
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSort = btn.dataset.sort;
            currentPage = 1;
            loadContent(true);
        };
    });
    // Studio buttons
    document.querySelectorAll('.studio-btn').forEach(btn => {
        btn.onclick = () => {
            currentStudio = btn.dataset.studio;
            currentGenre = null;
            currentQuery = '';
            isTurkishMode = false;
            currentPage = 1;
            loadContent(true);
        };
    });
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            const val = e.target.value.trim();
            if (val.length >= 3) {
                currentQuery = val;
                currentGenre = null;
                currentStudio = null;
                isTurkishMode = false;
                currentPage = 1;
                loadContent(true);
            } else if (val.length === 0) {
                currentQuery = '';
                currentPage = 1;
                loadContent(true);
            }
        }, 500));
    }
    // Load more
    document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
        currentPage++;
        loadContent(false);
    });
    // Menu toggle
    document.getElementById('menuToggle')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
    });
    // Modal genres
    document.getElementById('openGenresBtn')?.addEventListener('click', () => {
        document.getElementById('genreModal').style.display = 'flex';
    });
    document.querySelector('.close-modal')?.addEventListener('click', () => {
        document.getElementById('genreModal').style.display = 'none';
    });
    window.onclick = (e) => {
        if (e.target === document.getElementById('genreModal')) document.getElementById('genreModal').style.display = 'none';
    };
    // Top lists links (sidebar)
    document.getElementById('topMoviesLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        currentType = 'movie';
        currentSort = 'top_rated';
        currentGenre = null;
        currentStudio = null;
        currentQuery = '';
        isTurkishMode = false;
        currentPage = 1;
        loadContent(true);
        document.getElementById('sectionTitle').innerText = 'Top Rated Movies';
        document.querySelectorAll('.filter-tab').forEach(btn => {
            if (btn.dataset.type === 'movie') btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });
    document.getElementById('topTvLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        currentType = 'tv';
        currentSort = 'top_rated';
        currentGenre = null;
        currentStudio = null;
        currentQuery = '';
        isTurkishMode = false;
        currentPage = 1;
        loadContent(true);
        document.getElementById('sectionTitle').innerText = 'Top Rated TV Series';
        document.querySelectorAll('.filter-tab').forEach(btn => {
            if (btn.dataset.type === 'tv') btn.classList.add('active');
            else btn.classList.remove('active');
        });
    });
    document.getElementById('turksTvLink')?.addEventListener('click', (e) => {
        e.preventDefault();
        loadTurkishTV();
    });
    // Sidebar lists (Favorites, Watch Later, Continue Watching)
    document.querySelectorAll('.sidebar-link[data-list]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const listName = link.dataset.list;
            let items = [];
            if (listName === 'favorites') items = favorites;
            else if (listName === 'watchlater') items = watchlist;
            else if (listName === 'continue') items = continueWatching;
            displayUserList(items);
        });
    });
}

function displayUserList(items) {
    const grid = document.getElementById('moviesGrid');
    grid.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `<img src="${item.poster || ''}"><div class="card-info"><h3>${item.title}</h3></div>`;
        card.onclick = () => {
            if (item.type === 'movie') location.href = `watch.html?id=${item.id}&type=movie`;
            else location.href = `tv.html?id=${item.id}`;
        };
        grid.appendChild(card);
    });
    document.getElementById('sectionTitle').innerText = 'My List';
}

function debounce(fn, delay) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); }; }

// Page initializers
async function initIndexPage() {
    currentType = 'movie';
    await loadGenresModal();
    bindEvents();
    await loadContent(true);
    await renderSlider();
    await loadGreats();
    initSliderControls();
    setInterval(renderSlider, 86400000);
}

async function initTVShowsPage() {
    currentType = 'tv';
    await loadGenresModal();
    bindEvents();
    await loadContent(true);
    await renderSlider();
    await loadGreats();
    initSliderControls();
    setInterval(renderSlider, 86400000);
}

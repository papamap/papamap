const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const KAKAO_REST_KEY = "f971a5a1cc6ae49cf691f170f5e03dfd"; 

var map;
var placesData = []; 
var noticesData = [];
var currentSearchScope = 'all'; 
var activeCategory = '전체';
var userLat = 37.5238506, userLng = 126.9804702; 
var selectedLat = null, selectedLng = null;
var currentNoticeId = null;
var userLocationMarker = null;

let sheetState = 'hidden'; // 모바일 바텀시트 상태: hidden, peek, half, full

const shareIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;

function timeAgo(dateInput) {
    const past = new Date(dateInput); const now = new Date(); const seconds = Math.floor((now - past) / 1000);
    if (isNaN(seconds) || seconds < 0) return dateInput; 
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24); if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7); if (weeks < 4) return `${weeks}주 전`;
    const months = Math.floor(days / 30); if (months < 12) return `${months}개월 전`;
    const years = Math.floor(days / 365); return `${years}년 전`;
}

let pwResolveFn = null; let textPromptResolveFn = null;
function askPassword() { return new Promise(resolve => { pwResolveFn = resolve; document.getElementById('pw-modal').style.display = 'flex'; document.getElementById('pw-input').value = ''; document.getElementById('pw-input').focus(); }); }
function resolvePw(val) { document.getElementById('pw-modal').style.display = 'none'; if(pwResolveFn) pwResolveFn(val); }
function askTextPrompt(defaultText) { return new Promise(resolve => { textPromptResolveFn = resolve; document.getElementById('text-prompt-modal').style.display = 'flex'; document.getElementById('text-prompt-input').value = defaultText || ''; document.getElementById('text-prompt-input').focus(); }); }
function resolveTextPrompt(val) { document.getElementById('text-prompt-modal').style.display = 'none'; if(textPromptResolveFn) textPromptResolveFn(val); }
function escapeHtml(text) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, function(m) { return map[m]; }); }
function formatDescription(text) { if (!text) return ''; let str = escapeHtml(text); str = str.replace(/(https?:\\/\\/[^\\s]+)/g, function(url) { return '<a href="' + url + '" target="_blank" style="color:#FF6B6B; text-decoration:underline;">' + url + '</a>'; }); return str.replace(/\\n/g, '<br>'); }

function toggleOption(inputId, btnEl, placeholderTxt, toggleText) {
    const inputEl = document.getElementById(inputId); const isActive = btnEl.classList.contains('active');
    const siblings = btnEl.parentElement.querySelectorAll('.btn-free-toggle'); siblings.forEach(b => b.classList.remove('active'));
    if (!isActive) { btnEl.classList.add('active'); if (!inputEl.disabled) inputEl.dataset.oldVal = inputEl.value; inputEl.value = toggleText; inputEl.disabled = true; } 
    else { inputEl.value = inputEl.dataset.oldVal || ''; inputEl.disabled = false; inputEl.placeholder = placeholderTxt; }
}

// --- 📷 사진 관리 및 아이폰 스와이프 순서 변경 지원 ---
class MediaManager {
    constructor(containerId, instanceName, maxFiles) { this.containerId = containerId; this.instanceName = instanceName; this.maxFiles = maxFiles; this.media = []; this.dragIdx = null; setTimeout(() => this.initTouchDrag(), 500); }
    loadUrls(urlStr) { this.media = []; if(urlStr) { urlStr.split(',').forEach(u => { if(u.trim()) this.media.push({ type: 'url', data: u.trim() }); }); } this.render(); }
    addFiles(input) { Array.from(input.files).forEach(file => { if (this.media.length < this.maxFiles) this.media.push({ type: 'file', data: file }); }); input.value = ''; this.render(); }
    remove(idx) { this.media.splice(idx, 1); this.render(); }
    swap(from, to) { const item = this.media.splice(from, 1)[0]; this.media.splice(to, 0, item); this.render(); }
    render() {
        const container = document.getElementById(this.containerId); container.innerHTML = '';
        this.media.forEach((m, idx) => {
            const div = document.createElement('div'); div.className = 'media-preview-item'; div.dataset.idx = idx;
            if (m.type === 'url') { div.innerHTML = `<img src="${m.data}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.instanceName}.remove(${idx})">✖</button>`; container.appendChild(div); } 
            else { const reader = new FileReader(); reader.onload = (e) => { div.innerHTML = `<img src="${e.target.result}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.instanceName}.remove(${idx})">✖</button>`; container.appendChild(div); }; reader.readAsDataURL(m.data); }
        });
        this.initTouchDrag();
    }
    initTouchDrag() {
        const items = document.querySelectorAll(`#${this.containerId} .media-preview-item`);
        items.forEach(item => {
            item.addEventListener('touchstart', (e) => { this.dragIdx = parseInt(item.dataset.idx); item.style.opacity = '0.5'; }, {passive:true});
            item.addEventListener('touchmove', (e) => {
                e.preventDefault(); const touch = e.touches[0]; const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = target ? target.closest('.media-preview-item') : null;
                items.forEach(i => i.classList.remove('drag-target')); if(targetItem && targetItem !== item) targetItem.classList.add('drag-target');
            }, {passive:false});
            item.addEventListener('touchend', (e) => {
                item.style.opacity = '1'; items.forEach(i => i.classList.remove('drag-target'));
                const touch = e.changedTouches[0] || e.touches[0]; if(!touch) return;
                const target = document.elementFromPoint(touch.clientX, touch.clientY); const targetItem = target ? target.closest('.media-preview-item') : null;
                if(targetItem && this.dragIdx !== null) { const toIdx = parseInt(targetItem.dataset.idx); if(this.dragIdx !== toIdx) this.swap(this.dragIdx, toIdx); }
                this.dragIdx = null;
            });
        });
    }
    async uploadAll() {
        let finalUrls = [];
        for (let m of this.media) {
            if (m.type === 'url') finalUrls.push(m.data);
            else {
                const fileExt = m.data.name.split('.').pop(); const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const { error } = await supabaseClient.storage.from('places').upload(fileName, m.data);
                if (!error) { const { data: urlData } = supabaseClient.storage.from('places').getPublicUrl(fileName); finalUrls.push(urlData.publicUrl); }
            }
        }
        return finalUrls.length > 0 ? finalUrls.join(',') : null;
    }
}
window.noticeMediaManager = new MediaManager('notice-media-preview', 'noticeMediaManager', 10);
window.placeAddMediaManager = new MediaManager('place-add-media-preview', 'placeAddMediaManager', 10);
window.placeEditMediaManager = new MediaManager('place-edit-media-preview', 'placeEditMediaManager', 10);

async function submitInquiry() {
    const content = document.getElementById('inquiry-content').value.trim(); const contact = document.getElementById('inquiry-contact').value.trim();
    if(!content) return alert('내용을 입력해주세요.');
    const btn = document.querySelector('#inquiry-modal .btn-save'); btn.innerText = "전송 중..."; btn.disabled = true;
    const {error} = await supabaseClient.from('inquiries').insert([{ content: content, contact_info: contact }]);
    if(!error) { alert('문의가 접수되었습니다. 감사합니다!'); document.getElementById('inquiry-modal').style.display='none'; document.getElementById('inquiry-content').value = ''; document.getElementById('inquiry-contact').value = ''; } 
    btn.innerText = "보내기"; btn.disabled = false;
}

// --- 게시판 로직 (최신글 위로) ---
async function loadNotices() {
    const { data, error } = await supabaseClient.from('notices').select('*');
    if (!error && data) {
        noticesData = data;
        noticesData.sort((a, b) => {
            if (a.is_notice && !b.is_notice) return -1;
            if (!a.is_notice && b.is_notice) return 1;
            return new Date(b.created_at) < new Date(a.created_at) ? 1 : -1; // 최신글이 위로 (내림차순)
        });
        renderNotices();
    }
}

function renderNotices() {
    const container = document.getElementById('notice-list-container');
    if(noticesData.length === 0) { container.innerHTML = '<div style="text-align:center; padding: 40px; color: #adb5bd;">등록된 글이 없습니다.</div>'; return; }
    container.innerHTML = noticesData.map(n => {
        const dateStr = timeAgo(n.created_at); const firstImg = n.image_url ? n.image_url.split(',')[0] : null;
        const badge = n.is_notice ? `<span class="n-badge">공지</span> ` : '';
        const authorTxt = n.author ? `<span style="color:#868e96; margin-right:6px;">${escapeHtml(n.author)}</span>` : '';
        const autoDesc = escapeHtml(n.content || '').replace(/<br>/g, ' ').substring(0, 60) + ((n.content||'').length > 60 ? '...' : '');
        return `
        <div class="notice-card" onclick="showNoticeDetail(${n.id})">
            <div class="notice-content">
                <div class="n-date">${badge}${authorTxt}${dateStr}</div>
                <div class="n-title">${n.title}</div>
                <div class="n-desc">${autoDesc}</div>
            </div>
            ${firstImg ? `<img src="${firstImg}" class="notice-thumb" alt="썸네일">` : ''}
        </div>
    `}).join('');
}

function showNoticeDetail(id) {
    const n = noticesData.find(x => x.id === id); currentNoticeId = id;
    document.getElementById('notice-list-view').style.display = 'none'; document.getElementById('notice-detail-view').style.display = 'flex';
    document.getElementById('detail-title').innerHTML = n.title;
    const authorTxt = n.author ? `<span style="margin-right:8px; color:#495057;">${escapeHtml(n.author)}</span>` : '';
    document.getElementById('detail-date').innerHTML = `${authorTxt}${timeAgo(n.created_at)}`;
    
    let bodyHtml = escapeHtml(n.content || '').replace(/\\n/g, '<br>');
    if (n.image_url) {
        let urls = n.image_url.split(','); let imgsHtml = urls.map(url => `<img src="${url}" class="notice-detail-img" style="width:100%; border-radius:12px; margin-bottom:10px;">`).join('');
        bodyHtml = `<div style="margin-bottom:16px;">${imgsHtml}</div>` + bodyHtml;
    }
    document.getElementById('detail-body').innerHTML = bodyHtml;
}

function showNoticeList() { document.getElementById('notice-list-view').style.display = 'block'; document.getElementById('notice-detail-view').style.display = 'none'; }

function openWriteNoticeModal(id = null) {
    const modal = document.getElementById('write-notice-modal'); const titleEl = document.getElementById('modal-notice-title');
    if (id) {
        const n = noticesData.find(x => x.id === id);
        document.getElementById('notice-title').value = n.title; document.getElementById('notice-content-text').value = n.content;
        document.getElementById('notice-author').value = n.author || ''; document.getElementById('notice-author').disabled = true; document.getElementById('notice-pw').value = ''; 
        noticeMediaManager.loadUrls(n.image_url); modal.dataset.editId = id; titleEl.innerText = "게시글 수정";
    } else {
        document.getElementById('notice-title').value = ''; document.getElementById('notice-content-text').value = ''; 
        document.getElementById('notice-author').value = ''; document.getElementById('notice-author').disabled = false; document.getElementById('notice-pw').value = ''; 
        noticeMediaManager.loadUrls(''); delete modal.dataset.editId; titleEl.innerText = "게시글 작성";
    }
    modal.style.display = 'flex';
}

async function saveNotice() {
    const title = document.getElementById('notice-title').value.trim(); const content = document.getElementById('notice-content-text').value.trim();
    const author = document.getElementById('notice-author').value.trim() || '익명'; const pw = document.getElementById('notice-pw').value.trim();
    const editId = document.getElementById('write-notice-modal').dataset.editId;
    if(!title || !pw) return alert("제목과 비밀번호를 모두 입력하세요.");
    const btnSave = document.querySelector('#write-notice-modal .btn-save'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true;

    let imgUrls = await noticeMediaManager.uploadAll();
    let payload = { title: title, content: content, is_notice: false, author: author, pw: pw }; 
    if(imgUrls !== null) payload.image_url = imgUrls; 

    if (editId) {
        const n = noticesData.find(x => x.id == editId);
        if (n.pw && n.pw !== pw) { alert("비밀번호가 일치하지 않습니다."); btnSave.innerText = "등록하기"; btnSave.disabled = false; return; }
        const { error } = await supabaseClient.from('notices').update(payload).eq('id', editId);
        if(!error) { document.getElementById('write-notice-modal').style.display = 'none'; loadNotices(); showNoticeDetail(parseInt(editId)); }
    } else {
        const { error } = await supabaseClient.from('notices').insert([payload]);
        if(!error) { document.getElementById('write-notice-modal').style.display = 'none'; loadNotices(); }
    }
    btnSave.innerText = "등록하기"; btnSave.disabled = false;
}

async function deleteNotice() {
    const n = noticesData.find(x => x.id === currentNoticeId);
    const inputPw = await askPassword(); if (!inputPw) return;
    if (n.pw && n.pw !== inputPw) return alert("비밀번호가 일치하지 않습니다.");
    if(confirm("정말 이 글을 삭제하시겠습니까?")) {
        const { error } = await supabaseClient.from('notices').delete().eq('id', currentNoticeId);
        if(!error) { showNoticeList(); loadNotices(); }
    }
}

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (tab === 'map') {
        document.getElementById('nav-map').classList.add('active'); document.getElementById('board-view').style.display = 'none';
        document.getElementById('top-bar').style.display = 'flex'; document.getElementById('fab-buttons').style.display = 'flex';
    } else {
        document.getElementById('nav-board').classList.add('active'); document.getElementById('board-view').style.display = 'block';
        document.getElementById('top-bar').style.display = 'none'; document.getElementById('fab-buttons').style.display = 'none';
        setSheetState('hidden'); closeSearchPanel(); showNoticeList(); 
    }
}

function normalizeCat(c) { if(!c) return '실내'; if(c.includes('야외')) return '야외'; if(c.includes('문센')) return '문센'; return '실내'; }

function getMarkerHTML(place, isZoomedOut) {
    let emoji = '🏢'; if (place.category === '야외') emoji = '🌳'; else if (place.category === '문센') emoji = '🎨';
    let cls = normalizeCat(place.category) === '야외' ? 'marker-outdoor' : (normalizeCat(place.category) === '문센' ? 'marker-moonsen' : 'marker-indoor');
    const safeName = escapeHtml(place.name); 
    if (isZoomedOut) return `<div class="custom-marker zoomed ${cls}" title="${safeName}"><div class="marker-pin"></div><div class="marker-label">${safeName}</div></div>`; 
    return `<div class="custom-marker ${cls}" title="${safeName}"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div><div class="marker-label">${safeName}</div></div>`;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2-lat1) * Math.PI / 180; var dLon = (lon2-lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let lastWeatherLat = null; let lastWeatherLng = null;
window.globalWeatherHtml = '';
window.weatherRecoShown = false;

async function fetchWeather(lat, lng) {
    if (lastWeatherLat !== null && getDistanceKm(lastWeatherLat, lastWeatherLng, lat, lng) < 20.0) return;
    try {
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`),
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5`)
        ]);

        const weatherData = await weatherRes.json(); const aqiData = await aqiRes.json();

        let temp = Math.round(weatherData.current_weather.temperature); let code = weatherData.current_weather.weathercode; let icon = '☀️';
        if(code >= 1 && code <= 3) icon = '⛅'; if(code >= 51 && code <= 67) icon = '🌧️'; if(code >= 71 && code <= 77) icon = '❄️';
        let pm10 = aqiData.current.pm10; let aqiIcon = '😊'; let aqiText = '좋음'; let isBadAir = false;
        
        if (pm10 > 150) { aqiIcon = '👿'; aqiText = '매우나쁨'; isBadAir = true; } else if (pm10 > 80) { aqiIcon = '😷'; aqiText = '나쁨'; isBadAir = true; } else if (pm10 > 30) { aqiIcon = '😐'; aqiText = '보통'; }
        let isRaining = (code >= 51 && code <= 77); if (isRaining) aqiIcon = '☔';

        window.globalWeatherHtml = `<div onclick="window.open('https://weather.naver.com/', '_blank')" style="cursor:pointer; display:inline-flex; align-items:center; gap:4px; background:rgba(241,243,245,0.9); padding:6px 12px; border-radius:12px; font-size:12px; font-weight:800; color:#495057; box-shadow:0 2px 6px rgba(0,0,0,0.05);">${icon} ${temp}°C | ${aqiIcon} ${aqiText}</div>`;
        lastWeatherLat = lat; lastWeatherLng = lng;

        if ((isBadAir || isRaining) && activeCategory === '전체' && !window.weatherRecoShown) {
            window.weatherRecoShown = true; const banner = document.getElementById('weather-reco-banner');
            if(banner) {
                banner.innerHTML = `오늘은 ${isRaining ? '비가 오네요 ☔' : '미세먼지가 나빠요 😷'}<br>실내 위주로 살펴보는 게 어떨까요?`;
                banner.style.display = 'block'; setTimeout(() => { banner.style.display = 'none'; setCategory('실내'); }, 3500);
            }
        }
    } catch(e) { console.error("Weather Error", e); }
}

function updateUserLocationMarker(lat, lng) {
    var pos = new naver.maps.LatLng(lat, lng);
    if (!userLocationMarker) {
        userLocationMarker = new naver.maps.Marker({ position: pos, map: map, icon: { content: '<div style="width:16px; height:16px; background:#4285F4; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>', anchor: new naver.maps.Point(11, 11) }, zIndex: 9999 });
    } else { userLocationMarker.setPosition(pos); }
}

let currentZoomedOut = false;

function updateVisibleMarkers() {
    if (!map) return; const bounds = map.getBounds();
    placesData.forEach(p => {
        if (!p.marker) return;
        const pCat = normalizeCat(p.category); const isCatActive = (activeCategory === '전체' || pCat === activeCategory);
        if (isCatActive && bounds.hasLatLng(p.marker.getPosition())) { if (!p.marker.getMap()) p.marker.setMap(map); } 
        else { if (p.marker.getMap()) p.marker.setMap(null); }
    });
}

// 💡 팝업 띄우기 함수 (날짜 버그 수정)
async function loadMainPopup() {
    if(localStorage.getItem('hidePopupDate') === new Date().toDateString()) return;
    const { data } = await supabaseClient.from('notices').select('*').eq('is_popup', true);
    if(data && data.length > 0) {
        const now = new Date();
        const validPopup = data.find(n => {
            if (!n.popup_end_date) return true;
            const endDate = new Date(n.popup_end_date + "T23:59:59"); // 종료일 자정까지 유효하도록 수정
            return endDate >= now;
        });
        if(validPopup && validPopup.image_url) {
            document.getElementById('popup-slider').innerHTML = validPopup.image_url.split(',').map(url => `<img src="${url}" style="width:100%; object-fit:contain; flex-shrink:0; border-radius: 24px 24px 0 0;">`).join('');
            document.getElementById('main-popup').style.display = 'flex';
        }
    }
}

function closeMainPopup() {
    if(document.getElementById('popup-hide-today').checked) localStorage.setItem('hidePopupDate', new Date().toDateString());
    document.getElementById('main-popup').style.display = 'none';
}

// 📱 모바일 정보창 터치/스와이프 로직
function setSheetState(state) {
    const panel = document.getElementById('info-content');
    if (window.innerWidth <= 768) {
        panel.className = 'info-panel panel-' + state;
        sheetState = state;
    } else {
        // PC 화면에서는 모바일 클래스를 쓰지 않고 기존 show 클래스로만 제어
        if (state === 'hidden') panel.classList.remove('show');
        else panel.classList.add('show');
    }
}

function initBottomSheet() {
    const handle = document.getElementById('drag-handle-area');
    let startY = 0; let currentY = 0;
    
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, {passive: true});
    handle.addEventListener('touchmove', (e) => { currentY = e.touches[0].clientY; }, {passive: true});
    handle.addEventListener('touchend', (e) => {
        if (!currentY) return;
        const deltaY = currentY - startY; currentY = 0;
        if (deltaY < -40) { // 위로 올림
            if (sheetState === 'peek') setSheetState('half');
            else if (sheetState === 'half') setSheetState('full');
        } else if (deltaY > 40) { // 아래로 내림
            if (sheetState === 'full') setSheetState('half');
            else if (sheetState === 'half') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('hidden');
        }
    });
}

window.onload = function() {
    map = new naver.maps.Map('map', { center: new naver.maps.LatLng(userLat, userLng), zoom: 14, mapDataControl: false });
    fetchWeather(userLat, userLng); loadMainPopup(); initBottomSheet();
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); fetchWeather(userLat, userLng); updateUserLocationMarker(userLat, userLng);
        }, err => {}, { enableHighAccuracy: false, timeout: 5000 });
    }

    naver.maps.Event.addListener(map, 'click', function() { setSheetState('hidden'); closeSearchPanel(); });
    naver.maps.Event.addListener(map, 'idle', function() { updateVisibleMarkers(); });
    naver.maps.Event.addListener(map, 'zoom_changed', function() {
        let isZoomedOut = map.getZoom() < 13;
        if (currentZoomedOut !== isZoomedOut) {
            currentZoomedOut = isZoomedOut;
            placesData.forEach(p => { if (p.marker) { p.marker.setIcon({ content: getMarkerHTML(p, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) }); } });
        }
        updateVisibleMarkers();
    });

    loadPlaces(); loadNotices();
    
    const slider = document.getElementById('category-nav'); let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => { isDown = false; }); slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); slider.scrollLeft = scrollLeft - ((e.pageX - slider.offsetLeft) - startX) * 2; });
};

function setCategory(cat) {
    if (activeCategory === cat && cat !== '전체') cat = '전체'; activeCategory = cat;
    document.querySelectorAll('.category-nav .chip').forEach(el => { if(el.dataset.cat === cat) el.classList.add('active'); else el.classList.remove('active'); });
    updateVisibleMarkers(); if(document.getElementById('search-panel').classList.contains('show')) executeSearch();
}

function closePanel() { setSheetState('hidden'); updateVisibleMarkers(); }

async function loadPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').eq('is_approved', true);
    if (!error && data) {
        placesData = data.map(p => { if(p.name) p.name = p.name.split('\\n')[0].split('\\n')[0].trim(); return p; });
        let isZoomedOut = map.getZoom() < 13;
        placesData.forEach(place => {
            place.marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(place.latitude, place.longitude),
                icon: { content: getMarkerHTML(place, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) }
            });
            place.marker.addListener('click', function() { map.panTo(place.marker.getPosition()); renderPanel(place.id); if(window.innerWidth <= 768) closeSearchPanel(); });
        });
        updateVisibleMarkers();
    }
}

function openSearchPanel() { setSheetState('hidden'); document.getElementById('search-panel').classList.add('show'); document.getElementById('search-input').focus(); }
function closeSearchPanel() { document.getElementById('search-panel').classList.remove('show'); document.getElementById('search-scope-toggle').classList.remove('show'); updateVisibleMarkers(); }
function setSearchScope(scope) {
    currentSearchScope = scope; document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active')); document.getElementById('scope-' + scope).classList.add('active');
    if(scope === 'near' && navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; executeSearch(); }); } else executeSearch();
}

function executeSearch() {
    const query = document.getElementById('search-input').value.trim().toLowerCase(); const listEl = document.getElementById('search-results-list'); listEl.innerHTML = '';
    const bounds = map.getBounds(); let resultCount = 0;
    placesData.forEach(p => {
        const pCat = normalizeCat(p.category); const nameMatch = p.name.toLowerCase().includes(query); const catMatch = pCat.toLowerCase().includes(query);
        const isCatActive = (activeCategory === '전체' || pCat === activeCategory);
        let inScope = true;
        if (currentSearchScope === 'bounds') inScope = bounds.hasLatLng(new naver.maps.LatLng(p.latitude, p.longitude));
        else if (currentSearchScope === 'near') inScope = (getDistanceKm(userLat, userLng, p.latitude, p.longitude) <= 5.0);
        
        if ((!query || nameMatch || catMatch) && inScope && isCatActive) {
            const distText = currentSearchScope === 'near' ? `<span style="color:#FF6B6B; font-weight:800; font-size:11px;">📍 ${getDistanceKm(userLat, userLng, p.latitude, p.longitude).toFixed(1)}km</span>` : '';
            listEl.innerHTML += `<li class="search-result-item" onclick="switchTab('map'); map.setZoom(15); map.panTo(new naver.maps.LatLng(${p.latitude}, ${p.longitude})); renderPanel(${p.id});"><div style="font-weight:800; color:#343a40;">${p.name}</div><div style="font-size:11px; color:#868e96; display:flex; align-items:center;">${pCat} ${distText}</div></li>`;
            resultCount++;
        }
    });
    if(resultCount === 0) listEl.innerHTML = '<div class="res-empty">조건에 맞는 장소가 없습니다.</div>';
}

function openAppMap(type, name, lat, lng) {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent); let scheme = '', fallback = '';
    if (type === 'kakao') { scheme = 'kakaomap://search?q=' + encodeURIComponent(name); fallback = 'https://map.kakao.com/link/search/' + encodeURIComponent(name); } 
    else if (type === 'naver') { scheme = 'nmap://search?query=' + encodeURIComponent(name) + '&appname=appamap'; fallback = 'https://m.map.naver.com/search2/search.naver?query=' + encodeURIComponent(name); } 
    else if (type === 'tmap') { scheme = 'tmap://search?name=' + encodeURIComponent(name); fallback = 'https://tmap.co.kr/tmap2/mobile/route.jsp?name=' + encodeURIComponent(name) + '&lat=' + lat + '&lon=' + lng; }
    if (isMobile) { const now = new Date().getTime(); setTimeout(() => { if (new Date().getTime() - now < 2000) window.open(fallback, '_blank'); }, 1000); location.href = scheme; } else { window.open(fallback, '_blank'); } document.getElementById('map-link-modal').style.display='none';
}

function sharePlace(name, address) { if (navigator.share) navigator.share({ title: `아빠맵 - ${name}`, text: `${name}\\n아빠맵에서 상세 정보를 확인하세요!`, url: window.location.href }).catch(console.error); else alert("URL 복사 완료"); }
function openMapPopup(name, lat, lng) { document.getElementById('link-naver').onclick = () => openAppMap('naver', name, lat, lng); document.getElementById('link-kakao').onclick = () => openAppMap('kakao', name, lat, lng); document.getElementById('link-tmap').onclick = () => openAppMap('tmap', name, lat, lng); document.getElementById('map-link-modal').style.display = 'flex'; }

function renderPanel(id) {
    const place = placesData.find(p => p.id === id); if (!place) return;

    let commentsArr = place.comments_list ? JSON.parse(place.comments_list) : [];
    let commentsHtmlArr = commentsArr.map((c, idx) => {
        let dateStr = timeAgo(c.date || c.id); 
        return `<div class="comment-item cmt-item-${place.id}"><div class="comment-header"><div class="c-author">${escapeHtml(c.author)} <span style="font-weight:400; color:#868e96; margin-left:4px; font-size:10px;">${dateStr}</span></div><div style="display:flex; align-items:center; gap:8px;"><button class="comment-delete" onclick="editComment(${place.id}, ${c.id})">수정</button><button class="comment-delete" onclick="deleteComment(${place.id}, ${c.id})">삭제</button></div></div><div>${formatDescription(c.text)}</div></div>`
    });
    
    let urls = place.image_url ? place.image_url.split(',') : [];
    let isHasImage = urls.length > 0;
    let catColor = normalizeCat(place.category) === '야외' ? '#0ca678' : (place.category === '문센' ? '#f59f00' : '#5c7cfa');

    // 모바일 날씨 정보
    document.getElementById('weather-info-box').innerHTML = window.globalWeatherHtml || '';
    document.getElementById('btn-share-place').onclick = () => sharePlace(place.name, place.address);

    document.getElementById('info-scroll-area').innerHTML = `
        ${isHasImage ? `<div class="image-slider" style="margin-bottom:12px;">${urls.map(url => `<img src="${url}" class="place-photo">`).join('')}</div>` : ''}
        <div class="info-body-wrap">
            <div class="info-category" style="color: ${catColor}">${normalizeCat(place.category)}</div>
            <div class="title-row">
                <div class="info-title" id="dyn-title-${place.id}" style="padding-right:0;">${place.name}</div>
                <button class="btn-edit-tiny" onclick="openEditModal(${place.id})">✏️</button>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                ${place.address ? `<div class="info-address" onclick="openMapPopup('${place.name.replace(/'/g, "\\'")}', ${place.latitude}, ${place.longitude})" style="cursor:pointer; color:#4285F4; text-decoration:underline; display:flex; align-items:center; gap:4px; margin-bottom:0;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${place.address}</div>` : ''}
                ${place.website_url ? `<a href="${place.website_url}" target="_blank" class="chip" style="padding: 4px 8px; font-size: 10px; margin: 0; background: rgba(255,255,255,0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.15); color: #495057; text-decoration: none;">🌐 공식홈</a>` : ''}
            </div>
            
            <div class="info-tag-group">
                ${place.business_hours ? `<div class="info-tag"><span class="tag-label">시간</span><span class="tag-value">${escapeHtml(place.business_hours).replace(/\\n/g, '<br>')}</span></div>` : ''}
                ${place.parking_fee ? `<div class="info-tag"><span class="tag-label">주차</span><span class="tag-value">${escapeHtml(place.parking_fee).replace(/\\n/g, '<br>')}</span></div>` : ''}
                ${place.entry_fee ? `<div class="info-tag"><span class="tag-label">입장료</span><span class="tag-value">${escapeHtml(place.entry_fee).replace(/\\n/g, '<br>')}</span></div>` : ''}
                ${place.nursing_room ? `<div class="info-tag"><span class="tag-label">수유실</span><span class="tag-value">${escapeHtml(place.nursing_room).replace(/\\n/g, '<br>')}</span></div>` : ''}
            </div>
            
            ${place.comment ? `<div class="info-desc" style="margin-top:12px;">${formatDescription(place.comment)}</div>` : ''}

            <div class="comments-section">
                <div class="comment-inputs-top"><input type="text" id="cmt-author-${place.id}" placeholder="닉네임"><input type="password" id="cmt-pw-${place.id}" placeholder="비밀번호"></div>
                <div class="comment-input-wrap"><textarea id="cmt-text-${place.id}" placeholder="내용" rows="1"></textarea><button onclick="addComment(${place.id})">등록</button></div>
                ${commentsArr.length > 0 ? `<div style="font-size:12px; font-weight:800; margin-bottom:8px; margin-top:12px;">추가정보 (${commentsArr.length})</div>` : ''}
                <div class="comments-list">${commentsHtmlArr.join('')}</div>
            </div>
        </div>
    `;
    
    setSheetState('half');
}

function openEditModal(id) {
    const place = placesData.find(p => p.id === id); document.getElementById('edit-place-id').value = id;
    const nCat = normalizeCat(place.category); let catInput = document.querySelector(`input[name="edit-place-category"][value="${nCat}"]`); if(catInput) catInput.checked = true;
    document.getElementById('edit-website').value = place.website_url || ''; document.getElementById('edit-hours').value = place.business_hours || '';
    document.getElementById('edit-parking').value = place.parking_fee || ''; document.getElementById('edit-entry').value = place.entry_fee || '';
    document.getElementById('edit-nursing').value = place.nursing_room || ''; document.getElementById('edit-comment').value = place.comment || '';
    document.getElementById('edit-modal').style.display = 'flex';
}

async function submitEditInfo() {
    const id = document.getElementById('edit-place-id').value;
    const pay = { cat: document.querySelector('input[name="edit-place-category"]:checked')?.value, hours: document.getElementById('edit-hours').value, park: document.getElementById('edit-parking').value, entry: document.getElementById('edit-entry').value, comment: document.getElementById('edit-comment').value };
    const btn = document.querySelector('#edit-modal .btn-save'); btn.innerText = "요청 중..."; btn.disabled = true;
    const {error} = await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${id}] ` + JSON.stringify(pay) }]);
    if(!error) { alert("수정 요청이 접수되었습니다.\\n관리자 승인 전까지 기존 정보가 계속 유지됩니다."); document.getElementById('edit-modal').style.display = 'none'; }
    btn.innerText = "수정 요청"; btn.disabled = false;
}

function moveToCurrentLocation() {
    const btn = document.querySelector('.btn-location'); btn.classList.add('btn-loading'); 
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); map.setZoom(15);
            btn.classList.remove('btn-loading');
        }, err => { btn.classList.remove('btn-loading'); }, { enableHighAccuracy: false, timeout: 5000 });
    } else btn.classList.remove('btn-loading');
}

function openAddModal() { document.getElementById('add-modal').style.display = 'flex'; }

async function searchKakaoPlace() {
    const kw = document.getElementById('kakao-keyword').value.trim(); if(!kw) return;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw)}`, { headers: { "Authorization": `KakaoAK ${KAKAO_REST_KEY}` } });
        const data = await res.json(); const listEl = document.getElementById('kakao-result-list'); listEl.innerHTML = '';
        if(data.documents.length === 0) listEl.innerHTML = '<li style="text-align:center;">결과가 없습니다.</li>';
        else data.documents.forEach(doc => {
            const li = document.createElement('li'); li.innerHTML = `<strong>${doc.place_name}</strong><span>${doc.road_address_name || doc.address_name}</span>`;
            li.onclick = () => {
                document.getElementById('place-name').value = doc.place_name; document.getElementById('place-address').value = doc.road_address_name || doc.address_name;
                selectedLat = parseFloat(doc.y); selectedLng = parseFloat(doc.x); map.setCenter(new naver.maps.LatLng(selectedLat, selectedLng)); map.setZoom(16); listEl.style.display = 'none';
            }; listEl.appendChild(li);
        }); listEl.style.display = 'block';
    } catch(e) {}
}

async function savePlace() {
    const catRadio = document.querySelector('input[name="place-category"]:checked'); const cat = catRadio ? catRadio.value : '';
    var name = document.getElementById('place-name').value.trim();
    if (!name || !cat) return alert("장소명과 카테고리는 필수입니다!");
    
    const btnSave = document.getElementById('btn-save-place'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true;
    let imgUrls = await placeAddMediaManager.uploadAll();

    const { data, error } = await supabaseClient.from('places').insert([{ 
        category: cat, name: name, address: document.getElementById('place-address').value.trim(), website_url: document.getElementById('place-website').value.trim(), latitude: selectedLat || map.getCenter().y, longitude: selectedLng || map.getCenter().x, business_hours: document.getElementById('place-hours-time').value.trim(), parking_fee: document.getElementById('place-parking-detail').value.trim(), entry_fee: document.getElementById('place-entry-detail').value.trim(), nursing_room: document.getElementById('place-nursing-detail').value.trim(), comment: document.getElementById('place-comment').value, image_url: imgUrls, is_approved: false
    }]);
    
    if (!error) { 
        document.getElementById('add-modal').style.display='none';
        alert("장소가 접수되었습니다! 관리자 승인 후 지도에 노출됩니다.");
    } else alert("등록 실패");
    btnSave.innerText = "승인 요청하기"; btnSave.disabled = false;
}

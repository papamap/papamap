const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const KAKAO_REST_KEY = "f971a5a1cc6ae49cf691f170f5e03dfd"; 

var map; var placesData = []; var noticesData = []; var activeCategory = '전체';
var userLat = 37.5665, userLng = 126.9780; var currentNoticeId = null; var currentSearchScope = 'all';

let sheetState = 'hidden'; // 바텀시트 상태: hidden, peek, half, full

function timeAgo(dateInput) {
    const past = new Date(dateInput); const now = new Date(); const seconds = Math.floor((now - past) / 1000);
    if (isNaN(seconds) || seconds < 0) return dateInput; 
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60); if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24); if (days < 7) return `${days}일 전`;
    return `${Math.floor(days / 7)}주 전`;
}

let pwResolveFn = null; let textPromptResolveFn = null;
function askPassword() { return new Promise(resolve => { pwResolveFn = resolve; document.getElementById('pw-modal').style.display = 'flex'; document.getElementById('pw-input').value = ''; document.getElementById('pw-input').focus(); }); }
function resolvePw(val) { document.getElementById('pw-modal').style.display = 'none'; if(pwResolveFn) pwResolveFn(val); }
function askTextPrompt(defaultText) { return new Promise(resolve => { textPromptResolveFn = resolve; document.getElementById('text-prompt-modal').style.display = 'flex'; document.getElementById('text-prompt-input').value = defaultText || ''; document.getElementById('text-prompt-input').focus(); }); }
function resolveTextPrompt(val) { document.getElementById('text-prompt-modal').style.display = 'none'; if(textPromptResolveFn) textPromptResolveFn(val); }
function escapeHtml(text) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return !text ? '' : text.replace(/[&<>"']/g, function(m) { return map[m]; }); }

// 📱 모바일 바텀시트 로직
function setSheetState(state) {
    const panel = document.getElementById('info-content');
    if (window.innerWidth <= 768) {
        panel.className = 'info-panel panel-' + state;
        sheetState = state;
    } else {
        if (state === 'hidden') panel.classList.remove('show');
        else panel.classList.add('show');
    }
}

function initBottomSheet() {
    const handle = document.getElementById('drag-handle-area');
    if(!handle) return;
    let startY = 0; let currentY = 0;
    
    handle.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, {passive: true});
    handle.addEventListener('touchmove', (e) => { currentY = e.touches[0].clientY; }, {passive: true});
    handle.addEventListener('touchend', (e) => {
        if (!currentY) return;
        const deltaY = currentY - startY; currentY = 0;
        if (deltaY < -30) { // 위로 올림
            if (sheetState === 'peek') setSheetState('half');
            else if (sheetState === 'half') setSheetState('full');
        } else if (deltaY > 30) { // 아래로 내림
            if (sheetState === 'full') setSheetState('half');
            else if (sheetState === 'half') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('hidden');
        }
    });
}

// 📷 사진 첨부 매니저 (아이폰 순서 변경 지원 및 최대 10장)
class MediaManager {
    constructor(cId, iName, maxF) { this.cId = cId; this.iName = iName; this.maxF = maxF; this.m = []; this.dragIdx = null; setTimeout(()=>this.initTouchDrag(), 500); }
    loadUrls(u) { this.m = []; if(u) u.split(',').forEach(x => { if(x.trim()) this.m.push({t:'u', d:x.trim()}); }); this.render(); }
    addFiles(i) { Array.from(i.files).forEach(f => { if(this.m.length < this.maxF) this.m.push({t:'f', d:f}); }); i.value=''; this.render(); }
    remove(i) { this.m.splice(i,1); this.render(); }
    swap(from, to) { const item = this.m.splice(from, 1)[0]; this.m.splice(to, 0, item); this.render(); }
    render() {
        const c = document.getElementById(this.cId); c.innerHTML = '';
        this.m.forEach((x, i) => {
            const div = document.createElement('div'); div.className = 'media-preview-item'; div.dataset.idx = i;
            if(x.t === 'u') { div.innerHTML = `<img src="${x.d}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.iName}.remove(${i})">✖</button>`; c.appendChild(div); }
            else { const r = new FileReader(); r.onload = (e) => { div.innerHTML = `<img src="${e.target.result}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.iName}.remove(${i})">✖</button>`; c.appendChild(div); }; r.readAsDataURL(x.d); }
        });
        this.initTouchDrag();
    }
    initTouchDrag() {
        const items = document.querySelectorAll(`#${this.cId} .media-preview-item`);
        items.forEach(item => {
            item.addEventListener('touchstart', (e) => { this.dragIdx = parseInt(item.dataset.idx); item.style.opacity = '0.5'; }, {passive:true});
            item.addEventListener('touchmove', (e) => {
                e.preventDefault(); const touch = e.touches[0]; const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = target ? target.closest('.media-preview-item') : null;
                items.forEach(i => i.classList.remove('drag-target'));
                if(targetItem && targetItem !== item) targetItem.classList.add('drag-target');
            }, {passive:false});
            item.addEventListener('touchend', (e) => {
                item.style.opacity = '1'; items.forEach(i => i.classList.remove('drag-target'));
                const touch = e.changedTouches[0] || e.touches[0]; if(!touch) return;
                const target = document.elementFromPoint(touch.clientX, touch.clientY);
                const targetItem = target ? target.closest('.media-preview-item') : null;
                if(targetItem && this.dragIdx !== null) {
                    const toIdx = parseInt(targetItem.dataset.idx);
                    if(this.dragIdx !== toIdx) this.swap(this.dragIdx, toIdx);
                }
                this.dragIdx = null;
            });
        });
    }
    async uploadAll() {
        let res = [];
        for(let x of this.m) {
            if(x.t === 'u') res.push(x.d);
            else {
                const ext = x.d.name.split('.').pop(); const fn = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
                const {error} = await supabaseClient.storage.from('places').upload(fn, x.d);
                if(!error) res.push(supabaseClient.storage.from('places').getPublicUrl(fn).data.publicUrl);
            }
        }
        return res.length ? res.join(',') : null;
    }
}
window.noticeMediaManager = new MediaManager('notice-media-preview', 'noticeMediaManager', 10);
window.placeAddMediaManager = new MediaManager('place-add-media-preview', 'placeAddMediaManager', 10);
window.placeEditMediaManager = new MediaManager('place-edit-media-preview', 'placeEditMediaManager', 10);

// 팝업, 날씨 제어 (날짜 만료 체크 완벽 반영)
async function loadMainPopup() {
    if(localStorage.getItem('hidePopupDate') === new Date().toDateString()) return;
    const { data } = await supabaseClient.from('notices').select('*').eq('is_popup', true);
    if(data && data.length > 0) {
        const now = new Date();
        const validPopup = data.find(n => {
            if (!n.popup_end_date) return true;
            return new Date(n.popup_end_date + "T23:59:59") >= now;
        });
        if(validPopup && validPopup.image_url) {
            document.getElementById('popup-slider').innerHTML = validPopup.image_url.split(',').map(url => `<img src="${url}" style="width:100%; object-fit:cover; border-radius:24px 24px 0 0;">`).join('');
            document.getElementById('main-popup').style.display = 'flex';
        }
    }
}
function closeMainPopup() {
    if(document.getElementById('popup-hide-today').checked) localStorage.setItem('hidePopupDate', new Date().toDateString());
    document.getElementById('main-popup').style.display = 'none';
}

window.globalWeatherHtml = '';
async function fetchWeather(lat, lng) {
    try {
        const [wRes, aRes] = await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`), fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10`)]);
        const w = await wRes.json(), a = await aRes.json();
        let temp = Math.round(w.current_weather.temperature), code = w.current_weather.weathercode, icon = '☀️';
        if(code >= 1 && code <= 3) icon = '⛅'; if(code >= 51 && code <= 77) icon = '☔';
        let pm10 = a.current.pm10, aqiIcon = '😊', aqiText = '좋음', isBad = false, isRain = (code >= 51 && code <= 77);
        if (pm10 > 150) { aqiIcon = '👿'; aqiText = '매우나쁨'; isBad = true; } else if (pm10 > 80) { aqiIcon = '😷'; aqiText = '나쁨'; isBad = true; } else if (pm10 > 30) { aqiIcon = '😐'; aqiText = '보통'; }
        if (isRain) aqiIcon = '☔';
        
        window.globalWeatherHtml = `<div style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; background:rgba(241,243,245,0.9); padding:6px 12px; border-radius:12px; font-size:13px; font-weight:800; color:#495057;" onclick="window.open('https://weather.naver.com/', '_blank')">${icon} ${temp}°C | ${aqiIcon} ${aqiText}</div>`;
        const weatherBox = document.getElementById('weather-info-box');
        if (weatherBox) weatherBox.innerHTML = window.globalWeatherHtml;

        if((isBad || isRain) && activeCategory === '전체' && !window.weatherRecoShown) {
            window.weatherRecoShown = true;
            const banner = document.getElementById('weather-reco-banner');
            banner.innerHTML = `오늘은 ${isRain ? '비가 오네요 ☔' : '미세먼지가 나빠요 😷'}<br>실내를 살펴보는 게 어떨까요?`;
            banner.style.display = 'block'; setTimeout(() => { banner.style.display = 'none'; setCategory('실내'); }, 3500);
        }
    } catch(e) {}
}

function normalizeCat(c) { return !c ? '실내' : c.includes('야외') ? '야외' : c.includes('문센') ? '문센' : '실내'; }
function getMarkerHTML(p) {
    let emoji = normalizeCat(p.category) === '야외' ? '🌳' : normalizeCat(p.category) === '문센' ? '🎨' : '🏢';
    let cls = normalizeCat(p.category) === '야외' ? 'marker-outdoor' : normalizeCat(p.category) === '문센' ? 'marker-moonsen' : 'marker-indoor';
    const n = escapeHtml(p.name);
    return `<div class="custom-marker ${cls}" title="${n}"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div><div class="marker-label">${n}</div></div>`;
}

function updateVisibleMarkers() {
    if (!map) return; const b = map.getBounds();
    placesData.forEach(p => {
        if (!p.marker) return;
        const c = (activeCategory === '전체' || normalizeCat(p.category) === activeCategory);
        if (c && b.hasLatLng(p.marker.getPosition())) { if (!p.marker.getMap()) p.marker.setMap(map); } else p.marker.setMap(null);
    });
}

// 초기화
window.onload = function() {
    map = new naver.maps.Map('map', { center: new naver.maps.LatLng(userLat, userLng), zoom: 14, mapDataControl: false });
    initBottomSheet(); loadMainPopup(); fetchWeather(userLat, userLng);
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); fetchWeather(userLat, userLng);
        }, err => {}, { timeout: 5000 });
    }
    naver.maps.Event.addListener(map, 'click', () => { setSheetState('hidden'); document.getElementById('search-panel').classList.remove('show'); });
    naver.maps.Event.addListener(map, 'idle', () => updateVisibleMarkers());
    loadPlaces(); loadNotices();
};

function setCategory(c) { activeCategory = c; document.querySelectorAll('.category-nav .chip').forEach(e => e.classList.toggle('active', e.dataset.cat === c)); updateVisibleMarkers(); }

async function loadPlaces() {
    const { data } = await supabaseClient.from('places').select('*').eq('is_approved', true);
    if (data) {
        placesData = data;
        placesData.forEach(p => {
            p.marker = new naver.maps.Marker({ position: new naver.maps.LatLng(p.latitude, p.longitude), icon: { content: getMarkerHTML(p), anchor: new naver.maps.Point(14, 28) } });
            p.marker.addListener('click', () => { map.panTo(p.marker.getPosition()); renderPanel(p.id); });
        });
        updateVisibleMarkers();
    }
}

function renderPanel(id) {
    const p = placesData.find(x => x.id === id); if (!p) return;
    
    let imgHtml = ''; if (p.image_url) { const u = p.image_url.split(','); imgHtml = `<div class="image-slider" style="margin-bottom:12px;">${u.map(x => `<img src="${x}" class="place-photo">`).join('')}</div>`; }
    let catColor = normalizeCat(p.category) === '야외' ? '#0ca678' : (p.category === '문센' ? '#f59f00' : '#5c7cfa');

    const weatherBox = document.getElementById('weather-info-box');
    if (weatherBox) weatherBox.innerHTML = window.globalWeatherHtml || '';

    document.getElementById('btn-share-place').onclick = () => { if(navigator.share) navigator.share({title:p.name, text:'아빠맵에서 확인하세요!', url:window.location.href}); };

    document.getElementById('info-scroll-area').innerHTML = `
        ${imgHtml}
        <div class="info-body-wrap">
            <div style="font-size:11px; font-weight:800; color:${catColor}; margin-top:12px;">${normalizeCat(p.category)}</div>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <div style="font-size:20px; font-weight:800;">${p.name}</div>
                <button style="background:rgba(0,0,0,0.05); border:none; border-radius:50%; width:28px; height:28px; font-size:14px; cursor:pointer;" onclick="openEditModal(${p.id})">✏️</button>
            </div>
            <div style="margin-top:12px; display:flex; gap:8px;">
                <button class="btn-map-text bg-naver" onclick="window.open('nmap://search?query=${encodeURIComponent(p.name)}')">네이버맵</button>
                <button class="btn-map-text bg-kakao" onclick="window.open('kakaomap://search?q=${encodeURIComponent(p.name)}')">카카오맵</button>
            </div>
            <div style="margin-top:16px;">
                ${p.business_hours ? `<div class="info-tag"><span class="tag-label">시간</span><div class="tag-value">${escapeHtml(p.business_hours).replace(/\n/g,'<br>')}</div></div>` : ''}
                ${p.parking_fee ? `<div class="info-tag"><span class="tag-label">주차</span><div class="tag-value">${escapeHtml(p.parking_fee).replace(/\n/g,'<br>')}</div></div>` : ''}
                ${p.entry_fee ? `<div class="info-tag"><span class="tag-label">요금</span><div class="tag-value">${escapeHtml(p.entry_fee).replace(/\n/g,'<br>')}</div></div>` : ''}
                ${p.nursing_room ? `<div class="info-tag"><span class="tag-label">수유실</span><div class="tag-value">${escapeHtml(p.nursing_room).replace(/\n/g,'<br>')}</div></div>` : ''}
            </div>
            ${p.comment ? `<div class="info-desc" style="margin-top:12px;">${escapeHtml(p.comment).replace(/\n/g,'<br>')}</div>` : ''}
        </div>
    `;
    setSheetState('half'); 
}

function closePanel() { setSheetState('hidden'); updateVisibleMarkers(); }

function switchTab(t) {
    document.querySelectorAll('.nav-item').forEach(e => e.classList.remove('active'));
    if(t === 'map') {
        document.getElementById('nav-map').classList.add('active'); document.getElementById('board-view').style.display = 'none';
        document.getElementById('top-bar').style.display = 'flex'; document.getElementById('fab-buttons').style.display = 'flex';
    } else {
        document.getElementById('nav-board').classList.add('active'); document.getElementById('board-view').style.display = 'block';
        document.getElementById('top-bar').style.display = 'none'; document.getElementById('fab-buttons').style.display = 'none';
        setSheetState('hidden'); showNoticeList();
    }
}

// --- 장소 수정/문의 요청 (기존 정보 유지 및 Inquiries 테이블 저장) ---
function openEditModal(id) {
    const p = placesData.find(x => x.id === id); document.getElementById('edit-place-id').value = id;
    const nCat = normalizeCat(p.category); let catInput = document.querySelector(`input[name="edit-place-category"][value="${nCat}"]`); if(catInput) catInput.checked = true;
    document.getElementById('edit-website').value = p.website_url || ''; document.getElementById('edit-hours').value = p.business_hours || '';
    document.getElementById('edit-parking').value = p.parking_fee || ''; document.getElementById('edit-entry').value = p.entry_fee || '';
    document.getElementById('edit-nursing').value = p.nursing_room || ''; document.getElementById('edit-comment').value = p.comment || '';
    document.getElementById('edit-modal').style.display = 'flex';
}
async function submitEditInfo() {
    const id = document.getElementById('edit-place-id').value;
    const pay = { cat: document.querySelector('input[name="edit-place-category"]:checked')?.value, hours: document.getElementById('edit-hours').value, park: document.getElementById('edit-parking').value, entry: document.getElementById('edit-entry').value, nurse: document.getElementById('edit-nursing').value, comment: document.getElementById('edit-comment').value };
    const btn = document.querySelector('#edit-modal .btn-save'); btn.innerText = "요청 중..."; btn.disabled = true;
    const {error} = await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${id}] ` + JSON.stringify(pay) }]);
    if(!error) { alert("수정 요청이 접수되었습니다.\n관리자 승인 전까지 기존 정보가 계속 유지됩니다."); document.getElementById('edit-modal').style.display = 'none'; }
    btn.innerText = "재승인 요청"; btn.disabled = false;
}

// --- 게시판 로직 (최신글 위로 정렬) ---
async function loadNotices() {
    const { data } = await supabaseClient.from('notices').select('*');
    if (data) {
        noticesData = data;
        // 최신글(최근 날짜)이 상단으로 오도록 내림차순 정렬
        noticesData.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); 
        const c = document.getElementById('notice-list-container');
        c.innerHTML = noticesData.map(n => {
            const date = new Date(n.created_at); const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
            return `<div class="notice-card" onclick="showNoticeDetail(${n.id})"><div style="flex:1"><div style="font-size:11px;color:#adb5bd;margin-bottom:6px;">${n.is_notice?'<span style="color:#FF6B6B;font-weight:800;">[공지]</span> ':''}${n.author||'익명'} | ${dateStr}</div><div style="font-weight:800;font-size:15px;">${n.title}</div></div></div>`;
        }).join('');
    }
}
function showNoticeDetail(id) {
    const n = noticesData.find(x => x.id === id); currentNoticeId = id;
    document.getElementById('notice-list-view').style.display = 'none'; document.getElementById('notice-detail-view').style.display = 'flex';
    document.getElementById('detail-title').innerText = n.title; document.getElementById('detail-date').innerText = new Date(n.created_at).toLocaleDateString();
    let bodyHtml = escapeHtml(n.content).replace(/\n/g, '<br>');
    if (n.image_url) bodyHtml = `<div style="margin-bottom:16px;">${n.image_url.split(',').map(url => `<img src="${url}" style="width:100%; border-radius:12px; margin-bottom:8px;">`).join('')}</div>` + bodyHtml;
    document.getElementById('detail-body').innerHTML = bodyHtml;
}
function showNoticeList() { document.getElementById('notice-list-view').style.display = 'block'; document.getElementById('notice-detail-view').style.display = 'none'; }
function openWriteNoticeModal() { document.getElementById('write-notice-modal').style.display = 'flex'; }
async function saveNotice() {
    const title = document.getElementById('notice-title').value; const content = document.getElementById('notice-content-text').value;
    if(!title) return; const btn = document.querySelector('#write-notice-modal .btn-save'); btn.innerText = "등록 중..."; btn.disabled = true;
    let urls = await noticeMediaManager.uploadAll();
    await supabaseClient.from('notices').insert([{ title, content, image_url: urls, is_notice: false }]);
    document.getElementById('write-notice-modal').style.display = 'none'; loadNotices();
    btn.innerText = "등록하기"; btn.disabled = false;
}
async function deleteNotice() {
    document.getElementById('pw-modal').style.display = 'flex'; pwResolveFn = async (pw) => {
        if(!pw) return; const n = noticesData.find(x => x.id === currentNoticeId);
        if(n.pw === pw) { await supabaseClient.from('notices').delete().eq('id', currentNoticeId); showNoticeList(); loadNotices(); } else alert("비밀번호 오류");
    };
}
function openSearchPanel() { setSheetState('hidden'); document.getElementById('search-panel').classList.add('show'); document.getElementById('search-input').focus(); }
function closeSearchPanel() { document.getElementById('search-panel').classList.remove('show'); document.getElementById('search-scope-toggle').classList.remove('show'); updateVisibleMarkers(); }
function moveToCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); map.setZoom(15);
        }, err => {}, { timeout: 5000 });
    }
}
function openAddModal() { document.getElementById('add-modal').style.display = 'flex'; }
function toggleOption(inputId, btnEl, placeholderTxt, toggleText) {
    const inputEl = document.getElementById(inputId); const isActive = btnEl.classList.contains('active');
    const siblings = btnEl.parentElement.querySelectorAll('.btn-free-toggle'); siblings.forEach(b => b.classList.remove('active'));
    if (!isActive) { btnEl.classList.add('active'); if (!inputEl.disabled) inputEl.dataset.oldVal = inputEl.value; inputEl.value = toggleText; inputEl.disabled = true; } 
    else { inputEl.value = inputEl.dataset.oldVal || ''; inputEl.disabled = false; inputEl.placeholder = placeholderTxt; }
}
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
    const { error } = await supabaseClient.from('places').insert([{ category: cat, name: name, address: document.getElementById('place-address').value.trim(), website_url: document.getElementById('place-website').value.trim(), latitude: selectedLat || map.getCenter().y, longitude: selectedLng || map.getCenter().x, business_hours: document.getElementById('place-hours-time').value.trim(), parking_fee: document.getElementById('place-parking-detail').value.trim(), entry_fee: document.getElementById('place-entry-detail').value.trim(), nursing_room: document.getElementById('place-nursing-detail').value.trim(), comment: document.getElementById('place-comment').value, image_url: imgUrls, is_approved: false }]);
    if (!error) { document.getElementById('add-modal').style.display='none'; alert("장소가 접수되었습니다! 관리자 승인 후 지도에 노출됩니다."); } else alert("등록 실패");
    btnSave.innerText = "승인 요청하기"; btnSave.disabled = false;
}
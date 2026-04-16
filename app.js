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

const shareIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;
const viewIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px; margin-bottom:-2px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

// 인스타식 상대 시간 계산 함수
function timeAgo(dateInput) {
    const past = new Date(dateInput);
    const now = new Date();
    const seconds = Math.floor((now - past) / 1000);
    
    if (isNaN(seconds) || seconds < 0) return dateInput; 
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}주 전`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}개월 전`;
    const years = Math.floor(days / 365);
    return `${years}년 전`;
}

let pwResolveFn = null; let textPromptResolveFn = null;

function askPassword() { return new Promise(resolve => { pwResolveFn = resolve; document.getElementById('pw-modal').style.display = 'flex'; document.getElementById('pw-input').value = ''; document.getElementById('pw-input').focus(); }); }
function resolvePw(val) { document.getElementById('pw-modal').style.display = 'none'; if(pwResolveFn) pwResolveFn(val); }

function askTextPrompt(defaultText) { return new Promise(resolve => { textPromptResolveFn = resolve; document.getElementById('text-prompt-modal').style.display = 'flex'; document.getElementById('text-prompt-input').value = defaultText || ''; document.getElementById('text-prompt-input').focus(); }); }
function resolveTextPrompt(val) { document.getElementById('text-prompt-modal').style.display = 'none'; if(textPromptResolveFn) textPromptResolveFn(val); }

function escapeHtml(text) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, function(m) { return map[m]; }); }
function linkify(text) { if (!text) return ''; var urlRegex = /(https?:\/\/[^\s]+)/g; return text.replace(urlRegex, function(url) { return '<a href="' + url + '" target="_blank" style="color:#FF6B6B; text-decoration:underline;">' + url + '</a>'; }); }
function formatDescription(text) {
    if (!text) return ''; const aTags = [];
    let str = text.replace(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, function(match, url, label) { aTags.push({ url: url, label: label }); return `__A_TAG_${aTags.length - 1}__`; });
    str = escapeHtml(str);
    str = str.replace(/(https?:\/\/[^\s]+)/g, function(url) { return '<a href="' + url + '" target="_blank" style="color:#FF6B6B; text-decoration:underline;">' + url + '</a>'; });
    str = str.replace(/__A_TAG_(\d+)__/g, function(match, i) { return `<a href="${aTags[i].url}" target="_blank" style="color:#FF6B6B; text-decoration:underline;">${aTags[i].label}</a>`; });
    return str.replace(/\n/g, '<br>');
}

function toggleOption(inputId, btnEl, placeholderTxt, toggleText) {
    const inputEl = document.getElementById(inputId); const isActive = btnEl.classList.contains('active');
    const siblings = btnEl.parentElement.querySelectorAll('.btn-free-toggle'); siblings.forEach(b => b.classList.remove('active'));
    if (!isActive) { btnEl.classList.add('active'); if (!inputEl.disabled) inputEl.dataset.oldVal = inputEl.value; inputEl.value = toggleText; inputEl.disabled = true; } 
    else { inputEl.value = inputEl.dataset.oldVal || ''; inputEl.disabled = false; inputEl.placeholder = placeholderTxt; }
}

function compressImage(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image(); img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas'); let width = img.width; let height = img.height;
                if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
                if (height > maxHeight) { width = Math.round(width * maxHeight / height); height = maxHeight; }
                canvas.width = width; canvas.height = height; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(blob => resolve(new File([blob], file.name, { type: file.type || 'image/jpeg' })), file.type || 'image/jpeg', quality);
            }; img.onerror = reject;
        }; reader.onerror = reject;
    });
}

let isImgDragging = false; let imgStartX, imgScrollLeft;
function startImgDrag(e, el) { isImgDragging = true; imgStartX = e.pageX - el.offsetLeft; imgScrollLeft = el.scrollLeft; el.style.scrollSnapType = 'none'; }
function stopImgDrag(e, el) { if(!isImgDragging) return; isImgDragging = false; el.style.scrollSnapType = 'x mandatory'; updateSliderDots(el.id.replace('slider-', ''), el); }
function doImgDrag(e, el) { if (!isImgDragging) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - imgStartX) * 1.5; el.scrollLeft = imgScrollLeft - walk; }

class MediaManager {
    constructor(containerId, instanceName, maxFiles, shouldCompress) { this.containerId = containerId; this.instanceName = instanceName; this.maxFiles = maxFiles; this.shouldCompress = shouldCompress; this.media = []; this.dragStartIndex = null; setTimeout(() => this.initDragAndDrop(), 100); }
    loadUrls(urlStr) { this.media = []; if(urlStr) { urlStr.split(',').forEach(u => { if(u.trim()) this.media.push({ type: 'url', data: u.trim() }); }); } this.render(); }
    addFiles(input) { Array.from(input.files).forEach(file => { if (this.media.length < this.maxFiles) this.media.push({ type: 'file', data: file }); }); input.value = ''; this.render(); }
    remove(idx) { this.media.splice(idx, 1); this.render(); }
    reorder(from, to) { const item = this.media.splice(from, 1)[0]; this.media.splice(to, 0, item); this.render(); }
    initDragAndDrop() {
        const container = document.getElementById(this.containerId); if(!container) return;
        container.addEventListener('dragstart', e => { const item = e.target.closest('.media-preview-item'); if(item) { this.dragStartIndex = parseInt(item.dataset.idx); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData('text/plain', this.dragStartIndex); } });
        container.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; const wrap = document.getElementById(`wrap-${this.containerId.replace('-preview','')}`); if(wrap) wrap.classList.add('dragover'); });
        container.addEventListener('dragleave', e => { const wrap = document.getElementById(`wrap-${this.containerId.replace('-preview','')}`); if(wrap) wrap.classList.remove('dragover'); });
        container.addEventListener('drop', e => {
            e.preventDefault(); const wrap = document.getElementById(`wrap-${this.containerId.replace('-preview','')}`); if(wrap) wrap.classList.remove('dragover');
            const targetItem = e.target.closest('.media-preview-item');
            if(targetItem && this.dragStartIndex !== null) { const dragEndIndex = parseInt(targetItem.dataset.idx); if(this.dragStartIndex !== dragEndIndex) this.reorder(this.dragStartIndex, dragEndIndex); }
            this.dragStartIndex = null;
        });
    }
    render() {
        const container = document.getElementById(this.containerId); container.innerHTML = '';
        this.media.forEach((m, idx) => {
            const div = document.createElement('div'); div.className = 'media-preview-item'; div.setAttribute('draggable', 'true'); div.dataset.idx = idx;
            if (m.type === 'url') { div.innerHTML = `<img src="${m.data}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.instanceName}.remove(${idx})">✖</button>`; container.appendChild(div); } 
            else { const reader = new FileReader(); reader.onload = (e) => { div.innerHTML = `<img src="${e.target.result}" class="media-preview-img"><button type="button" class="media-preview-del" onclick="${this.instanceName}.remove(${idx})">✖</button>`; container.appendChild(div); }; reader.readAsDataURL(m.data); }
        });
    }
    async uploadAll() {
        let finalUrls = [];
        for (let m of this.media) {
            if (m.type === 'url') finalUrls.push(m.data);
            else {
                let fileToUpload = m.data;
                if (this.shouldCompress && fileToUpload.type.startsWith('image/')) { try { fileToUpload = await compressImage(fileToUpload, 1200, 1200, 0.8); } catch(e) {} }
                const fileExt = fileToUpload.name.split('.').pop(); const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
                const { error } = await supabaseClient.storage.from('places').upload(fileName, fileToUpload);
                if (!error) { const { data: urlData } = supabaseClient.storage.from('places').getPublicUrl(fileName); finalUrls.push(urlData.publicUrl); }
            }
        }
        return finalUrls.length > 0 ? finalUrls.join(',') : null;
    }
}

window.noticeMediaManager = new MediaManager('notice-media-preview', 'noticeMediaManager', 3, false);
window.placeAddMediaManager = new MediaManager('place-add-media-preview', 'placeAddMediaManager', 3, true);
window.placeEditMediaManager = new MediaManager('place-edit-media-preview', 'placeEditMediaManager', 3, true);

async function submitInquiry() {
    const content = document.getElementById('inquiry-content').value.trim(); const contact = document.getElementById('inquiry-contact').value.trim();
    if(!content) return alert('내용을 입력해주세요.');
    const btn = document.querySelector('#inquiry-modal .btn-save'); btn.innerText = "전송 중..."; btn.disabled = true;
    const {error} = await supabaseClient.from('inquiries').insert([{ content: content, contact_info: contact }]);
    if(!error) { alert('문의가 접수되었습니다. 감사합니다!'); document.getElementById('inquiry-modal').style.display='none'; document.getElementById('inquiry-content').value = ''; document.getElementById('inquiry-contact').value = ''; } 
    else { alert('접수 실패. 문의 테이블을 확인해주세요.'); }
    btn.innerText = "보내기"; btn.disabled = false;
}

async function loadNotices() {
    const { data, error } = await supabaseClient.from('notices').select('*');
    if (!error && data) { noticesData = data; renderNotices(); }
}

function renderNotices() {
    const container = document.getElementById('notice-list-container');
    if(noticesData.length === 0) { container.innerHTML = '<div style="text-align:center; padding: 40px; color: #adb5bd;">등록된 글이 없습니다.</div>'; return; }
    noticesData.sort((a, b) => { if (a.is_notice && !b.is_notice) return -1; if (!a.is_notice && b.is_notice) return 1; return new Date(b.created_at) < new Date(a.created_at) ? 1 : -1; });
    container.innerHTML = noticesData.map(n => {
        const dateStr = timeAgo(n.created_at);
        const firstImg = n.image_url ? n.image_url.split(',')[0] : null;
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
    
    let bodyHtml = linkify(escapeHtml(n.content || '')).replace(/\n/g, '<br>');
    if (n.image_url) {
        let urls = n.image_url.split(','); let imgsHtml = urls.map(url => `<img src="${url}" class="notice-detail-img" alt="이미지">`).join('');
        bodyHtml = `<div style="margin-bottom:16px;">${imgsHtml}</div>` + bodyHtml;
    }
    document.getElementById('detail-body').innerHTML = bodyHtml;
}

function showNoticeList() { document.getElementById('notice-list-view').style.display = 'block'; document.getElementById('notice-detail-view').style.display = 'none'; }

function openWriteNoticeModal(id = null) {
    const modal = document.getElementById('write-notice-modal'); const titleEl = document.getElementById('modal-notice-title');
    if (id) {
        const n = noticesData.find(x => x.id === id);
        document.getElementById('notice-title').value = n.title; document.getElementById('notice-content-text').value = n.content; document.getElementById('notice-is-pinned').checked = n.is_notice;
        document.getElementById('notice-author').value = n.author || ''; document.getElementById('notice-author').disabled = true; document.getElementById('notice-pw').value = ''; 
        noticeMediaManager.loadUrls(n.image_url); modal.dataset.editId = id; titleEl.innerText = "게시글 수정";
    } else {
        document.getElementById('notice-title').value = ''; document.getElementById('notice-content-text').value = ''; document.getElementById('notice-is-pinned').checked = false;
        document.getElementById('notice-author').value = ''; document.getElementById('notice-author').disabled = false; document.getElementById('notice-pw').value = ''; 
        noticeMediaManager.loadUrls(''); delete modal.dataset.editId; titleEl.innerText = "게시글 작성";
    }
    modal.style.display = 'flex';
}

// 기존 saveNotice() 내부 로직 일부 변경
async function saveNotice() {
    const title = document.getElementById('notice-title').value.trim(); 
    const content = document.getElementById('notice-content-text').value.trim();
    const author = document.getElementById('notice-author').value.trim() || '익명'; 
    const pw = document.getElementById('notice-pw').value.trim();
    
    // 이 줄 삭제: const isPinned = document.getElementById('notice-is-pinned').checked; 
    const editId = document.getElementById('write-notice-modal').dataset.editId;
    
    if(!title || !pw) return alert("제목과 비밀번호를 모두 입력하세요.");
    const btnSave = document.querySelector('#write-notice-modal .btn-save'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true;

    let imgUrls = await noticeMediaManager.uploadAll();
    
    // is_notice를 무조건 false로 고정 (관리자만 나중에 변경 가능)
    let payload = { title: title, content: content, is_notice: false, author: author, pw: pw };
    if(imgUrls !== null) payload.image_url = imgUrls; 

    // ... 하단 로직은 기존과 동일 ...

    if (editId) {
        const n = noticesData.find(x => x.id == editId);
        if (n.pw && n.pw !== pw) { alert("비밀번호가 일치하지 않습니다."); btnSave.innerText = "등록하기"; btnSave.disabled = false; return; }
        const { error } = await supabaseClient.from('notices').update(payload).eq('id', editId);
        if(!error) { document.getElementById('write-notice-modal').style.display = 'none'; loadNotices(); showNoticeDetail(parseInt(editId)); }
        else alert("수정 에러. RLS를 확인하세요.");
    } else {
        const { error } = await supabaseClient.from('notices').insert([payload]);
        if(!error) { document.getElementById('write-notice-modal').style.display = 'none'; loadNotices(); }
        else alert("저장 에러: " + error.message);
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
        closePanel(); closeSearchPanel(); showNoticeList(); 
    }
}

function normalizeCat(c) {
    if(!c) return '실내'; if(c.includes('야외')) return '야외'; if(c.includes('문센')) return '문센';
    return '실내'; 
}

function getMarkerClass(cat) {
    const nCat = normalizeCat(cat);
    if (nCat === '야외') return 'marker-outdoor'; if (nCat === '문센') return 'marker-moonsen';
    return 'marker-indoor';
}

function getMarkerHTML(place, isZoomedOut) {
    // 🧸 -> 🏠, 🎪 -> 🎨 로 직관성 개선
    let emoji = '🏠'; 
    if (place.category === '야외') emoji = '🌳'; 
    else if (place.category === '문센') emoji = '🎨';
    let cls = getMarkerClass(place.category);
    
    if (isZoomedOut) { return `<div class="custom-marker zoomed ${cls}"><div class="marker-pin"></div></div>`; }
    // 지도 복잡도를 낮추기 위해 ${escapeHtml(place.name)} 라벨 영역 삭제
    return `
    <div class="custom-marker ${cls}">
        <div class="marker-pin">
            <div class="marker-icon">${emoji}</div>
        </div>
    </div>`;
}

function getDistanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2-lat1) * Math.PI / 180; var dLon = (lon2-lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// --- 기존 fetchWeather 함수를 이 코드로 덮어쓰세요 ---
let lastWeatherLat = null; let lastWeatherLng = null;
async function fetchWeather(lat, lng) {
    if (lastWeatherLat !== null && getDistanceKm(lastWeatherLat, lastWeatherLng, lat, lng) < 20.0) return;
    try {
        // 1. 날씨와 미세먼지 API 동시에 호출 (무료, API 키 불필요)
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`),
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5`)
        ]);

        if(!weatherRes.ok || !aqiRes.ok) throw new Error('API Error');
        
        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        // 2. 날씨 아이콘 및 온도 세팅
        let temp = Math.round(weatherData.current_weather.temperature); 
        let code = weatherData.current_weather.weathercode; 
        let icon = '🌸';
        if(code >= 1 && code <= 3) icon = '⛅'; 
        if(code >= 51 && code <= 67) icon = '🌧️'; 
        if(code >= 71 && code <= 77) icon = '❄️';

        // 3. 미세먼지(PM10) 수치 기반 한국 기준 상태 계산
        let pm10 = aqiData.current.pm10;
        let aqiIcon = '😊'; let aqiText = '좋음'; let isBadAir = false;
        
        if (pm10 > 150) { aqiIcon = '👿'; aqiText = '매우나쁨'; isBadAir = true; }
        else if (pm10 > 80) { aqiIcon = '😷'; aqiText = '나쁨'; isBadAir = true; }
        else if (pm10 > 30) { aqiIcon = '😐'; aqiText = '보통'; }

        // 비가 오거나(눈 포함) 미세먼지가 나쁘면 마스크/우산 아이콘으로 덮어쓰기
        let isRaining = (code >= 51 && code <= 77);
        if (isRaining) aqiIcon = '☔';

        // 4. 화면 상단 날씨/미세먼지 위젯 업데이트
        document.getElementById('weather-info').innerHTML = `${icon} ${temp}°C | ${aqiIcon} ${aqiText}`;
        lastWeatherLat = lat; lastWeatherLng = lng;

        // 5. [킬러 콘텐츠 핵심] 날씨가 구리거나 미세먼지가 나쁘면 '실내' 자동 추천
        // (앱이 처음 켜질 때만 작동하도록, activeCategory가 '전체'일 때만 실행)
        if ((isBadAir || isRaining) && activeCategory === '전체') {
            // 0.5초 뒤에 스르륵 카테고리를 '실내'로 변경
            setTimeout(() => {
                setCategory('실내');
                alert(`현재 ${isRaining ? '비/눈이 오네요 ☔' : '미세먼지가 나빠요 😷'}\n쾌적한 '실내' 장소 위주로 보여드릴게요!`);
            }, 800);
        }

    } catch(e) { 
        document.getElementById('weather-info').innerHTML = `⛅ 18°C`; 
        console.error("날씨/미세먼지 연동 실패:", e);
    }
}
// -----------------------------------------------------

function updateUserLocationMarker(lat, lng) {
    var pos = new naver.maps.LatLng(lat, lng);
    if (!userLocationMarker) {
        userLocationMarker = new naver.maps.Marker({
            position: pos, map: map,
            icon: { content: '<div style="width:16px; height:16px; background:#4285F4; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;"></div>', anchor: new naver.maps.Point(11, 11) },
            zIndex: 9999
        });
        naver.maps.Event.addListener(userLocationMarker, 'click', function() { map.panTo(userLocationMarker.getPosition()); });
    } else { userLocationMarker.setPosition(pos); }
}

let currentZoomedOut = false;

// 조회수 증가 함수
async function incrementViewCount(id) {
    let place = placesData.find(p => p.id === id);
    if (!place) return;
    
    // 로컬 세션에서 중복 조회 방지 (선택 사항, 여기서는 단순 구현)
    const lastViewed = localStorage.getItem('last_view_' + id);
    const now = Date.now();
    if (lastViewed && (now - parseInt(lastViewed)) < 1000 * 60 * 5) return; // 5분 이내 재조회는 카운트 안함
    
    place.views = (place.views || 0) + 1;
    localStorage.setItem('last_view_' + id, now.toString());
    
    // Supabase 업데이트 (views 컬럼이 있다고 가정, 없으면 likes 컬럼 사용하게 유도할 수 있음)
    // 여기서는 일단 views 컬럼으로 시도하고, 만약 에러가 나면 likes 컬럼을 사용하도록 처리
    const { error } = await supabaseClient.from('places').update({ views: place.views }).eq('id', id);
    if (error) {
        // views 컬럼이 없는 경우 likes 컬럼으로 대체 (기존 하트 기능 대체용)
        await supabaseClient.from('places').update({ likes: place.views }).eq('id', id);
    }
}

// 지도 가시영역 마커 업데이트 (성능 최적화)
function updateVisibleMarkers() {
    if (!map) return;
    const bounds = map.getBounds();
    const isZoomedOut = map.getZoom() < 13;
    
    placesData.forEach(p => {
        if (!p.marker) return;
        
        const pCat = normalizeCat(p.category);
        const isCatActive = (activeCategory === '전체' || pCat === activeCategory);
        
        if (isCatActive && bounds.hasLatLng(p.marker.getPosition())) {
            if (!p.marker.getMap()) p.marker.setMap(map);
        } else {
            if (p.marker.getMap()) p.marker.setMap(null);
        }
    });

    // 전체 카테고리일 때 Top 5 노출
    if (activeCategory === '전체') {
        renderTop5(bounds);
    } else {
        const top5Container = document.getElementById('top5-container');
        if (top5Container) top5Container.style.display = 'none';
    }
}

function renderTop5(bounds) {
    const visiblePlaces = placesData.filter(p => 
        bounds.hasLatLng(new naver.maps.LatLng(p.latitude, p.longitude))
    );
    
    // 조회수(views 또는 likes) 기준으로 정렬
    visiblePlaces.sort((a, b) => ((b.views || b.likes) || 0) - ((a.views || a.likes) || 0));
    const top5 = visiblePlaces.slice(0, 5);
    
    let container = document.getElementById('top5-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'top5-container';
        container.className = 'top5-overlay';
        document.body.appendChild(container);
    }
    
    if (top5.length === 0) {
        container.style.display = 'none';
        return;
    }
    
    container.style.display = 'block';
    container.innerHTML = `
        <div class="top5-header">인기 장소 TOP 5</div>
        <div class="top5-list">
            ${top5.map((p, idx) => `
                <div class="top5-item" onclick="map.panTo(new naver.maps.LatLng(${p.latitude}, ${p.longitude})); renderPanel(${p.id});">
                    <span class="top5-rank">${idx + 1}</span>
                    <span class="top5-name">${p.name}</span>
                   <span class="top5-views" style="display:flex; align-items:center;">${viewIcon} ${(p.views || p.likes) || 0}</span>
                </div>
            `).join('')}
        </div>
    `;
}

window.onload = function() {
    map = new naver.maps.Map('map', { center: new naver.maps.LatLng(userLat, userLng), zoom: 14, mapDataControl: false });
    fetchWeather(userLat, userLng);
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); fetchWeather(userLat, userLng); updateUserLocationMarker(userLat, userLng);
        }, err => { console.warn("위치 정보 접근 실패."); });
    }

    naver.maps.Event.addListener(map, 'click', function() { closePanel(); closeSearchPanel(); });
    naver.maps.Event.addListener(map, 'idle', function() { fetchWeather(map.getCenter().y, map.getCenter().x); updateVisibleMarkers(); });
    naver.maps.Event.addListener(map, 'zoom_changed', function() {
        let isZoomedOut = map.getZoom() < 13;
        if (currentZoomedOut !== isZoomedOut) {
            currentZoomedOut = isZoomedOut;
            placesData.forEach(p => {
                if (p.marker) { p.marker.setIcon({ content: getMarkerHTML(p, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) }); }
            });
        }
        if (isZoomedOut) document.getElementById('map').classList.add('zoomed-out'); else document.getElementById('map').classList.remove('zoomed-out');
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
    applyFilters(cat);
}

function applyFilters(overrideCat) {
    activeCategory = overrideCat || activeCategory;
    updateVisibleMarkers();
    if(document.getElementById('search-panel').classList.contains('show')) executeSearch();
}

function closePanel() { 
    document.getElementById('info-content').classList.remove('show'); 
    document.getElementById('category-nav').style.display = 'flex'; 
    updateVisibleMarkers(); // 정보창 닫힐 때 Top 5 갱신
}

// 승인된 장소만 표시 (is_approved === true)
async function loadPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').eq('is_approved', true);
    if (!error && data) {
        placesData.forEach(p => { if(p.marker) p.marker.setMap(null); });
        placesData = data; 
        
        let isZoomedOut = map.getZoom() < 13;
        placesData.forEach(place => {
            let jitterLat = place.latitude + (Math.random() - 0.5) * 0.0002; let jitterLng = place.longitude + (Math.random() - 0.5) * 0.0002;
            place.marker = new naver.maps.Marker({
                position: new naver.maps.LatLng(jitterLat, jitterLng),
                icon: { content: getMarkerHTML(place, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) },
                zIndex: (place.views || place.likes) || 0
            });
            place.marker.addListener('click', function() { map.panTo(place.marker.getPosition()); renderPanel(place.id); if(window.innerWidth <= 768) closeSearchPanel(); });
        });
        applyFilters('전체');
    }
}

function openSearchPanel() { closePanel(); document.getElementById('search-panel').classList.add('show'); document.getElementById('search-input').focus(); }
function closeSearchPanel() { document.getElementById('search-panel').classList.remove('show'); document.getElementById('search-scope-toggle').classList.remove('show'); applyFilters(); }
function setSearchScope(scope) {
    currentSearchScope = scope; document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active')); document.getElementById('scope-' + scope).classList.add('active');
    if(scope === 'near' && navigator.geolocation) {
        const btn = document.querySelector('.search-input-area .scope-btn:last-child'); btn.style.opacity = '0.5';
        navigator.geolocation.getCurrentPosition(pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; executeSearch(); btn.style.opacity = '1';
        }, () => { alert('위치 권한이 필요합니다.'); btn.style.opacity = '1'; }, { enableHighAccuracy: false, timeout: 5000 });
    } else executeSearch();
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
            listEl.innerHTML += `
                <li class="search-result-item" onclick="switchTab('map'); map.setZoom(15); map.panTo(new naver.maps.LatLng(${p.latitude}, ${p.longitude})); renderPanel(${p.id});">
                    <div style="font-weight:800; color:#343a40;">${p.name}</div>
                    <div style="font-size:11px; color:#868e96; display:flex; align-items:center;">${pCat} <span style="margin: 0 6px;">|</span> ${viewIcon} ${(p.views || p.likes) || 0} ${distText}</div>
                </li>`;
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
    
    if (isMobile) { const now = new Date().getTime(); setTimeout(() => { if (new Date().getTime() - now < 2000) window.open(fallback, '_blank'); }, 1000); location.href = scheme; } 
    else { window.open(fallback, '_blank'); } document.getElementById('map-link-modal').style.display='none';
}

async function fetchKakaoImage(query, imgElementId, topBarId, sliderId, headerWrapId) {
    const topBarEl = topBarId ? document.getElementById(topBarId) : null; const sliderEl = sliderId ? document.getElementById(sliderId) : null; const headerWrapEl = headerWrapId ? document.getElementById(headerWrapId) : null;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=1`, { headers: { "Authorization": `KakaoAK ${KAKAO_REST_KEY}` } });
        const data = await res.json();
        if(data.documents && data.documents.length > 0) {
            const imgEl = document.getElementById(imgElementId);
            if(imgEl) { imgEl.src = data.documents[0].image_url; imgEl.style.display = 'block'; }
            if(topBarEl) { topBarEl.classList.remove('no-image'); topBarEl.classList.add('has-image'); }
            if(sliderEl) { sliderEl.style.display = 'flex'; }
            if(headerWrapEl) { headerWrapEl.classList.remove('no-image'); headerWrapEl.classList.add('has-image'); }
        } else { if(headerWrapEl) headerWrapEl.classList.add('no-image'); }
    } catch(e) { if(headerWrapEl) headerWrapEl.classList.add('no-image'); }
}

function sharePlace(name, address) { if (navigator.share) navigator.share({ title: `아빠맵 - ${name}`, text: `${name}\n아빠맵에서 상세 정보를 확인하세요!`, url: window.location.href }).catch(console.error); else alert("사파리 브라우저의 경우 https 환경에서만 공유가 가능합니다. URL을 복사해주세요."); }
function openMapPopup(name, lat, lng) { document.getElementById('link-naver').onclick = () => openAppMap('naver', name, lat, lng); document.getElementById('link-kakao').onclick = () => openAppMap('kakao', name, lat, lng); document.getElementById('link-tmap').onclick = () => openAppMap('tmap', name, lat, lng); document.getElementById('map-link-modal').style.display = 'flex'; }
function showMoreComments(id) { const items = document.querySelectorAll(`.cmt-item-${id}`); let shown = 0; let hiddenCount = 0; items.forEach(item => { if (item.style.display === 'none') { if (shown < 3) { item.style.display = 'flex'; shown++; } else hiddenCount++; } }); const btn = document.getElementById(`btn-more-${id}`); if (hiddenCount > 0) btn.innerText = `추가정보 더보기 ▼`; else btn.style.display = 'none'; }
function updateSliderDots(id, el) { const index = Math.round(el.scrollLeft / el.offsetWidth); const dots = document.querySelectorAll('#slider-dots-' + id + ' .slider-dot'); dots.forEach((dot, i) => { dot.className = 'slider-dot' + (i === index ? ' active' : ''); }); }

function renderPanel(id) {
    document.getElementById('category-nav').style.display = 'none'; 
    const place = placesData.find(p => p.id === id);
    if (!place) return;

    incrementViewCount(id); // 조회수 증가

    let commentsArr = place.comments_list ? JSON.parse(place.comments_list) : [];
    let commentsHtmlArr = commentsArr.map((c, idx) => {
        let dateStr = timeAgo(c.date || c.id); 
        return `
        <div class="comment-item cmt-item-${place.id}" style="display: ${idx < 3 ? 'flex' : 'none'}; flex-direction:column;">
            <div class="comment-header">
                <div class="c-author">${escapeHtml(c.author)} <span style="font-weight:400; color:#868e96; margin-left:4px; font-size:10px;">${dateStr}</span></div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="comment-delete" onclick="editComment(${place.id}, ${c.id})">수정</button>
                    <button class="comment-delete" onclick="deleteComment(${place.id}, ${c.id})">삭제</button>
                </div>
            </div>
            <div>${formatDescription(c.text)}</div>
        </div>`
    });

    let visibleComments = commentsHtmlArr.join('');
    let moreBtn = commentsArr.length > 3 ? `<button id="btn-more-${place.id}" onclick="showMoreComments(${place.id})" class="btn-more-cmts">추가정보 더보기 ▼</button>` : '';
    
    let urls = place.image_url ? place.image_url.split(',') : [];
    let isHasImage = urls.length > 0;
    let catColor = normalizeCat(place.category) === '야외' ? '#0ca678' : (place.category === '문센' ? '#f59f00' : '#5c7cfa');

    document.getElementById('info-content').innerHTML = `
        <div class="panel-top-bar" id="top-bar-${place.id}">
            <button class="btn-back-arrow" onclick="closePanel()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <div class="icon-actions">
<div class="view-badge">${viewIcon} ${(place.views || place.likes) || 0}</div>
<button class="icon-btn" onclick="sharePlace('${place.name}', '${place.address || ''}')">${shareIcon}</button>
            </div>
        </div>

        <div class="info-scroll-area" id="scroll-area-${place.id}">
            <div class="info-header-wrap ${isHasImage ? 'has-image' : 'no-image'}" id="header-wrap-${place.id}">
                <div style="position:relative; width:100%;">
                    <div class="image-slider" id="slider-${place.id}" style="${isHasImage ? '' : 'display:none;'}" onscroll="updateSliderDots(${place.id}, this)" onmousedown="startImgDrag(event, this)" onmouseleave="stopImgDrag(event, this)" onmouseup="stopImgDrag(event, this)" onmousemove="doImgDrag(event, this)">
                        ${isHasImage 
                            ? urls.map(url => `<img src="${url}" class="place-photo">`).join('') 
                            : `<img id="img-${place.id}" class="place-photo" src="" style="display:none;" onerror="this.style.display='none'; document.getElementById('header-wrap-${place.id}').classList.add('no-image');">`
                        }
                    </div>
                    ${urls.length > 1 ? `<div class="slider-dots" id="slider-dots-${place.id}">${urls.map((_, i) => `<div class="slider-dot ${i===0?'active':''}"></div>`).join('')}</div>` : ''}
                </div>
            </div>

            <div class="info-body-wrap">
                <div class="info-category" style="color: ${catColor}">${normalizeCat(place.category)}</div>
                <div class="title-row">
                    <div class="info-title-wrap" style="flex: 0 1 auto; overflow: hidden; white-space: nowrap; position: relative;">
                        <div class="info-title" id="dyn-title-${place.id}" style="padding-right:0;">${place.name}</div>
                    </div>
                    <button class="btn-edit-tiny" onclick="openEditModal(${place.id})">✏️</button>
                </div>

                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">
                    ${place.address ? `
                    <div class="info-address" onclick="openMapPopup('${place.name.replace(/'/g, "\\'")}', ${place.latitude}, ${place.longitude})" style="cursor:pointer; color:#4285F4; text-decoration:underline; display:flex; align-items:center; gap:4px; margin-bottom:0;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${place.address}
                    </div>
                    ` : ''}
                    ${place.website_url ? `
                    <a href="${place.website_url}" target="_blank" class="chip" style="padding: 4px 8px; font-size: 10px; margin: 0; background: rgba(255,255,255,0.9); box-shadow: 0 2px 6px rgba(0,0,0,0.15); color: #495057; text-decoration: none;">🌐 공식홈</a>
                    ` : ''}
                </div>
                
                <div class="info-tag-wrap">
                    <div class="info-tag-group">
                        ${place.business_hours ? `<div class="info-tag"><span class="tag-label">시간</span><span class="tag-value">${escapeHtml(place.business_hours).replace(/\n/g, '<br>')}</span></div>` : ''}
                        ${place.parking_fee ? `<div class="info-tag"><span class="tag-label">주차</span><span class="tag-value">${escapeHtml(place.parking_fee).replace(/\n/g, '<br>')}</span></div>` : ''}
                        ${place.entry_fee ? `<div class="info-tag"><span class="tag-label">입장료</span><span class="tag-value">${escapeHtml(place.entry_fee).replace(/\n/g, '<br>')}</span></div>` : ''}
                        ${place.nursing_room ? `<div class="info-tag"><span class="tag-label">수유실</span><span class="tag-value">${escapeHtml(place.nursing_room).replace(/\n/g, '<br>')}</span></div>` : ''}
                    </div>
                </div>
                
                ${place.comment && place.comment.trim() !== '' ? `<div class="info-desc">${formatDescription(place.comment)}</div>` : ''}
                <div style="font-size:10.5px; color:#adb5bd; margin-bottom:16px; margin-top:-8px; letter-spacing:-0.3px; margin-left: 6px;">*&nbsp;&nbsp;정확한 최신 정보는 방문 전 공식 홈페이지 등을 꼭 확인해주세요.</div>

                <div class="comments-section">
                    <div class="comment-inputs-top">
                        <input type="text" id="cmt-author-${place.id}" placeholder="닉네임">
                        <input type="password" id="cmt-pw-${place.id}" placeholder="비밀번호">
                    </div>
                    <div class="comment-input-wrap">
                        <textarea id="cmt-text-${place.id}" placeholder="내용" rows="1"></textarea>
                        <button onclick="addComment(${place.id})">등록</button>
                    </div>
                    ${commentsArr.length > 0 ? `<div style="font-size:12px; font-weight:800; margin-bottom:8px; margin-top:12px;">추가정보 (${commentsArr.length})</div>` : ''}
                    <div class="comments-list">${visibleComments}${moreBtn}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('info-content').classList.add('show');
    
    setTimeout(() => {
        const scrollArea = document.getElementById(`scroll-area-${place.id}`); if (scrollArea) scrollArea.scrollTop = 0;
        const titleWrap = document.querySelector('.info-title-wrap'); const titleEl = document.getElementById(`dyn-title-${place.id}`);
        if(titleEl.offsetWidth > titleWrap.offsetWidth) {
            const originalHTML = titleEl.innerHTML; titleEl.innerHTML = originalHTML + "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;" + originalHTML;
            titleWrap.style.webkitMaskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; titleWrap.style.maskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; titleEl.classList.add('marquee');
        } else { titleWrap.style.webkitMaskImage = 'none'; titleWrap.style.maskImage = 'none'; }
    }, 10);

    if(!isHasImage) {
        if(place.category !== '문센') { fetchKakaoImage(place.name, `img-${place.id}`, `top-bar-${place.id}`, `slider-${place.id}`, `header-wrap-${place.id}`); } 
        else { document.getElementById(`header-wrap-${place.id}`).classList.add('no-image'); }
    }
}

function openAddModal() {
    const modal = document.getElementById('add-modal'); modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content'); if (content) content.scrollTop = 0;
    setTimeout(() => { const searchInput = document.getElementById('kakao-keyword'); if (searchInput) searchInput.focus(); }, 100);
}

function openEditModal(id) {
    const place = placesData.find(p => p.id === id); document.getElementById('edit-place-id').value = id;
    document.querySelector('#edit-modal .modal-content').scrollTop = 0; 
    
    const nCat = normalizeCat(place.category); let catInput = document.querySelector(`input[name="edit-place-category"][value="${nCat}"]`); if(catInput) catInput.checked = true;
    document.getElementById('edit-website').value = place.website_url || ''; document.getElementById('edit-hours').value = place.business_hours || '';
    
    const pInput = document.getElementById('edit-parking'); const pBtnFree = document.getElementById('btn-edit-free-parking'); const pBtnNo = document.getElementById('btn-edit-no-parking');
    pBtnFree.classList.remove('active'); pBtnNo.classList.remove('active'); pInput.disabled = false;
    if(place.parking_fee === '무료') { pBtnFree.classList.add('active'); pInput.disabled = true; pInput.value = '무료'; pInput.dataset.oldVal = ''; } 
    else if(place.parking_fee === '불가') { pBtnNo.classList.add('active'); pInput.disabled = true; pInput.value = '불가'; pInput.dataset.oldVal = ''; } 
    else { pInput.value = place.parking_fee || ''; }

    const eInput = document.getElementById('edit-entry'); const eBtnNo = document.getElementById('btn-edit-no-entry');
    eBtnNo.classList.remove('active'); eInput.disabled = false;
    if(place.entry_fee === '없음') { eBtnNo.classList.add('active'); eInput.disabled = true; eInput.value = '없음'; eInput.dataset.oldVal = ''; } 
    else { eInput.value = place.entry_fee || ''; }
    
    const nInput = document.getElementById('edit-nursing'); const nBtn = document.getElementById('btn-edit-no-nursing');
    if(place.nursing_room === '없음') { nBtn.classList.add('active'); nInput.disabled = true; nInput.value = '없음'; nInput.dataset.oldVal = ''; } 
    else { nBtn.classList.remove('active'); nInput.disabled = false; nInput.value = place.nursing_room || ''; }

    document.getElementById('edit-comment').value = place.comment || ''; placeEditMediaManager.loadUrls(place.image_url); document.getElementById('edit-modal').style.display = 'flex';
}

async function submitEditInfo() {
    const id = document.getElementById('edit-place-id').value;
    const catRadio = document.querySelector('input[name="edit-place-category"]:checked'); const cat = catRadio ? catRadio.value : '';
    if(!cat) return alert("카테고리를 선택하세요.");

    const website = document.getElementById('edit-website').value.trim(); const hours = document.getElementById('edit-hours').value.trim();
    const parking = document.getElementById('edit-parking').value.trim(); const entry = document.getElementById('edit-entry').value.trim();
    const nursing = document.getElementById('edit-nursing').value.trim(); const comment = document.getElementById('edit-comment').value.trim();
    
    const btnSave = document.querySelector('#edit-modal .btn-save'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true;
    let newImgUrls = await placeEditMediaManager.uploadAll();
    
    // 유저가 수정하면 다시 승인을 받아야 하므로 is_approved를 false로 변경합니다. (운영 원칙)
    let updatePayload = { category: cat, website_url: website, business_hours: hours, parking_fee: parking, entry_fee: entry, nursing_room: nursing, comment: comment, is_approved: false };
    if(newImgUrls !== null) updatePayload.image_url = newImgUrls;

    const { error } = await supabaseClient.from('places').update(updatePayload).eq('id', id);
    if(!error) {
        alert("수정이 접수되었습니다. 관리자 승인 후 지도에 반영됩니다.");
        document.getElementById('edit-modal').style.display = 'none';
        closePanel(); loadPlaces(); // 승인 해제되었으므로 지도에서 제거됨
    } else alert("업데이트 실패: " + error.message);
    btnSave.innerText = "재승인 요청"; btnSave.disabled = false;
}

async function addComment(id) {
    const author = document.getElementById('cmt-author-' + id).value.trim() || '익명';
    const pw = document.getElementById('cmt-pw-' + id).value.trim();
    const text = document.getElementById('cmt-text-' + id).value.trim();
    const date = new Date().toISOString(); 

    if (!text || !pw) return alert('내용과 비밀번호를 모두 입력해주세요.');
    
    let place = placesData.find(p => p.id === id);
    let comments = place.comments_list ? JSON.parse(place.comments_list) : [];
    comments.unshift({ id: Date.now(), author, pw, text, date }); 
    
    let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson;
    renderPanel(id);
    let isZoomedOut = map.getZoom() < 13;
    place.marker.setIcon({ content: getMarkerHTML(place, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) });
    await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', id);
}

async function editComment(placeId, commentId) {
    const pwInput = await askPassword(); if (!pwInput) return;
    let place = placesData.find(p => p.id === placeId);
    let comments = place.comments_list ? JSON.parse(place.comments_list) : [];
    const target = comments.find(c => c.id === commentId);
    
    if (target && target.pw === pwInput) {
        const newText = await askTextPrompt(target.text);
        if (newText !== null && newText.trim() !== '') {
            target.text = newText.trim();
            let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson;
            renderPanel(placeId); await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId);
        }
    } else alert("비밀번호가 틀렸습니다.");
}

async function deleteComment(placeId, commentId) {
    const pwInput = await askPassword(); if (!pwInput) return;
    let place = placesData.find(p => p.id === placeId);
    let comments = place.comments_list ? JSON.parse(place.comments_list) : [];
    const target = comments.find(c => c.id === commentId);
    
    if (target && target.pw === pwInput) {
        comments = comments.filter(c => c.id !== commentId);
        let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson; renderPanel(placeId);
        let isZoomedOut = map.getZoom() < 13;
        place.marker.setIcon({ content: getMarkerHTML(place, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) });
        await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId);
    } else alert("비밀번호가 틀렸습니다.");
}

function moveToCurrentLocation() {
    const btn = document.querySelector('.btn-location'); btn.classList.add('btn-loading'); 
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); map.setZoom(15);
            fetchWeather(userLat, userLng); updateUserLocationMarker(userLat, userLng);
            btn.classList.remove('btn-loading');
        }, err => { btn.classList.remove('btn-loading'); }, { enableHighAccuracy: false, timeout: 5000 });
    } else btn.classList.remove('btn-loading');
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
    
    let duplicate = placesData.find(p => p.name === name);
    if (duplicate) {
        alert("이미 등록된 장소입니다. 추가 정보를 입력할 수 있도록 수정 창을 엽니다."); document.getElementById('add-modal').style.display='none';
        map.setCenter(new naver.maps.LatLng(duplicate.latitude, duplicate.longitude)); map.setZoom(16);
        renderPanel(duplicate.id); setTimeout(() => openEditModal(duplicate.id), 300); return;
    }
    
    const btnSave = document.getElementById('btn-save-place'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true;
    let imgUrls = await placeAddMediaManager.uploadAll();

    // is_approved: false 로 신규 등록 (관리자 페이지에서 승인해야 표시됨)
    const { data, error } = await supabaseClient.from('places').insert([{ 
        category: cat, name: name, address: document.getElementById('place-address').value.trim(), 
        website_url: document.getElementById('place-website').value.trim(), latitude: selectedLat || map.getCenter().y, longitude: selectedLng || map.getCenter().x, 
        business_hours: document.getElementById('place-hours-time').value.trim(), parking_fee: document.getElementById('place-parking-detail').value.trim(), 
        entry_fee: document.getElementById('place-entry-detail').value.trim(), nursing_room: document.getElementById('place-nursing-detail').value.trim(),
        comment: document.getElementById('place-comment').value, image_url: imgUrls, is_approved: false
    }]).select();
    
    if (!error && data && data.length > 0) { 
        document.getElementById('add-modal').style.display='none';
        document.getElementById('place-name').value = ''; document.getElementById('place-address').value = ''; document.getElementById('kakao-keyword').value = ''; document.getElementById('place-website').value = ''; document.getElementById('place-hours-time').value = ''; document.getElementById('place-parking-detail').value = ''; document.getElementById('place-entry-detail').value = ''; document.getElementById('place-nursing-detail').value = ''; document.getElementById('place-comment').value = ''; placeAddMediaManager.loadUrls('');
        
        alert("장소가 접수되었습니다! 관리자 승인 후 지도에 노출됩니다.");
        btnSave.innerText = "승인 요청하기"; btnSave.disabled = false;
    } else {
        alert("등록 실패: DB에 is_approved 컬럼이 추가되었는지 확인하세요!\n" + error.message); btnSave.innerText = "승인 요청하기"; btnSave.disabled = false;
    }
}

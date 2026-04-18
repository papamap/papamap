const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const KAKao_REST_KEY = "f971a5a1cc6ae49cf691f170f5e03dfd"; 

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) document.documentElement.classList.add('is-mobile');
else document.documentElement.classList.add('is-pc');

var map;
var placesData = []; 
var noticesData = [];
var currentSearchScope = 'all'; 
var activeCategory = '전체';
var userLat = 37.5238506, userLng = 126.9804702; 
var selectedLat = null, selectedLng = null;
var currentNoticeId = null;
var userLocationMarker = null;
var currentWeatherHtml = "⛅ --°C | 😐 보통";
window.isWeatherSuggestionVisible = false;

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

function escapeHtml(text) { const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }; return text.replace(/[&<>"']/g, m => map[m]); }
function linkify(text) { if (!text) return ''; var urlRegex = /(https?:\/\/[^\s]+)/g; return text.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#FF6B6B; text-decoration:underline;">${url}</a>`); }
function formatDescription(text) {
    if (!text) return ''; const aTags = [];
    let str = text.replace(/<a\s+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, (match, url, label) => { aTags.push({ url: url, label: label }); return `__A_TAG_${aTags.length - 1}__`; });
    str = escapeHtml(str);
    str = str.replace(/(https?:\/\/[^\s]+)/g, url => `<a href="${url}" target="_blank" style="color:#FF6B6B; text-decoration:underline;">${url}</a>`);
    str = str.replace(/__A_TAG_(\d+)__/g, (match, i) => `<a href="${aTags[i].url}" target="_blank" style="color:#FF6B6B; text-decoration:underline;">${aTags[i].label}</a>`);
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

        let dragSrcEl = null, startIdx = null;
        container.addEventListener('touchstart', e => {
            if(e.target.tagName === 'BUTTON') return;
            const item = e.target.closest('.media-preview-item');
            if(item) { dragSrcEl = item; startIdx = parseInt(item.dataset.idx); item.style.opacity = '0.5'; }
        }, {passive: true});
        container.addEventListener('touchmove', e => {
            if(!dragSrcEl) return; e.preventDefault();
            const touch = e.touches[0]; const target = document.elementFromPoint(touch.clientX, touch.clientY);
            const targetItem = target ? target.closest('.media-preview-item') : null;
            container.querySelectorAll('.media-preview-item').forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
            if(targetItem && targetItem !== dragSrcEl) {
                const rect = targetItem.getBoundingClientRect(); const isLeft = (touch.clientX - rect.left) < (rect.width/2);
                targetItem.classList.add(isLeft ? 'drag-over-left' : 'drag-over-right');
                this.dragTargetIndex = parseInt(targetItem.dataset.idx) + (isLeft ? 0 : 1);
            } else this.dragTargetIndex = null;
        }, {passive: false});
        container.addEventListener('touchend', e => {
            if(!dragSrcEl) return;
            dragSrcEl.style.opacity = '1'; container.querySelectorAll('.media-preview-item').forEach(el => el.classList.remove('drag-over-left', 'drag-over-right'));
            if(this.dragTargetIndex !== null) {
                let endIdx = this.dragTargetIndex;
                if(startIdx < endIdx) endIdx--;
                if(startIdx !== endIdx) this.reorder(startIdx, endIdx);
            }
            dragSrcEl = null; startIdx = null; this.dragTargetIndex = null;
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

window.noticeMediaManager = new MediaManager('notice-media-preview', 'noticeMediaManager', 10, false);
window.placeAddMediaManager = new MediaManager('place-add-media-preview', 'placeAddMediaManager', 3, true);
window.placeEditMediaManager = new MediaManager('place-edit-media-preview', 'placeEditMediaManager', 3, true);

async function submitInquiry() {
    const content = document.getElementById('inquiry-content').value.trim(); const contact = document.getElementById('inquiry-contact').value.trim();
    if(!content) return alert('내용을 입력해주세요.');
    const btn = document.querySelector('#inquiry-modal .btn-save'); btn.innerText = "전송 중..."; btn.disabled = true;
    const {error} = await supabaseClient.from('inquiries').insert([{ content: content, contact_info: contact }]);
    if(!error) { alert('접수 완료! 감사합니다.'); document.getElementById('inquiry-modal').style.display='none'; document.getElementById('inquiry-content').value = ''; document.getElementById('inquiry-contact').value = ''; } 
    else { alert('접수 실패. 관리자에게 문의하세요.'); }
    btn.innerText = "보내기"; btn.disabled = false;
}

async function loadNotices() {
    try {
        const { data, error } = await supabaseClient.from('notices').select('*');
        if (error) throw error;
        if (data) { 
            noticesData = data; renderNotices(); 
            checkAndShowPopup(); 
        }
    } catch (err) {
        const container = document.getElementById('notice-list-container');
        if(container) { container.innerHTML = `<div style="text-align:center; padding:40px; color:#FF6B6B; font-size:13px; line-height:1.5;">게시글을 불러오지 못했습니다.</div>`; }
    }
}

function checkAndShowPopup() {
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('hidePopup') === today) return;
    
    const validPopups = noticesData.filter(n => n.is_popup && n.image_url && n.popup_end_date && new Date(n.popup_end_date) >= new Date(today));
    if (validPopups.length > 0) {
        let urls = []; validPopups.forEach(n => urls = urls.concat(n.image_url.split(',')));
        if (urls.length === 0) return;
        
        const sliderInner = document.getElementById('popup-slider-inner');
        sliderInner.innerHTML = urls.map(url => `<img src="${url}" draggable="false" style="flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:start; user-select:none;">`).join('');
        
        if(urls.length > 1) {
            document.getElementById('popup-slider-dots').innerHTML = urls.map((_, i) => `<div class="slider-dot ${i===0?'active':''}"></div>`).join('');
            document.querySelectorAll('.popup-nav-btn').forEach(b => b.style.display = 'flex');
        } else {
            document.getElementById('popup-slider-dots').innerHTML = '';
            document.querySelectorAll('.popup-nav-btn').forEach(b => b.style.display = 'none');
        }
        
        document.getElementById('popup-modal').style.display = 'flex';
        initPopupDrag();
    }
}

function updatePopupDots() {
    const el = document.getElementById('popup-slider-inner');
    const index = Math.round(el.scrollLeft / el.offsetWidth);
    const dots = document.querySelectorAll('#popup-slider-dots .slider-dot');
    dots.forEach((dot, i) => dot.className = 'slider-dot' + (i === index ? ' active' : ''));
}

function scrollPopup(dir) {
    const el = document.getElementById('popup-slider-inner');
    el.scrollBy({ left: dir * el.offsetWidth, behavior: 'smooth' });
}

function initPopupDrag() {
    const el = document.getElementById('popup-slider-inner');
    let isDown = false; let startX; let scrollLeft;

    el.addEventListener('mousedown', (e) => {
        isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; el.style.scrollSnapType = 'none'; 
    });
    el.addEventListener('mouseleave', () => { isDown = false; el.style.scrollSnapType = 'x mandatory'; });
    el.addEventListener('mouseup', () => { isDown = false; el.style.scrollSnapType = 'x mandatory'; });
    el.addEventListener('mousemove', (e) => {
        if (!isDown) return; e.preventDefault(); const x = e.pageX - el.offsetLeft; const walk = (x - startX) * 2; el.scrollLeft = scrollLeft - walk;
    });
}

function closePopup(hideToday) {
    if(hideToday) localStorage.setItem('hidePopup', new Date().toISOString().split('T')[0]);
    document.getElementById('popup-modal').style.display = 'none';
}

function renderNotices() {
    const container = document.getElementById('notice-list-container');
    if(noticesData.length === 0) { container.innerHTML = '<div style="text-align:center; padding:40px; color:#adb5bd;">등록된 글이 없습니다.</div>'; return; }
    
    noticesData.sort((a, b) => { 
        if (a.is_notice !== b.is_notice) return a.is_notice ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); 
    });
    
    container.innerHTML = noticesData.map(n => {
        const dateStr = timeAgo(n.created_at); const firstImg = n.image_url ? n.image_url.split(',')[0] : null;
        const badge = n.is_notice ? `<span class="n-badge">공지</span> ` : '';
        const authorTxt = n.author ? `<span style="color:#868e96; margin-right:6px;">${escapeHtml(n.author)}</span>` : '';
        const autoDesc = escapeHtml(n.content || '').replace(/<br>/g, ' ').substring(0, 60) + ((n.content||'').length > 60 ? '...' : '');
        return `
        <div class="notice-card" onclick="showNoticeDetail(${n.id})">
            <div class="notice-content"><div class="n-date">${badge}${authorTxt}${dateStr}</div><div class="n-title">${n.title}</div><div class="n-desc">${autoDesc}</div></div>
            ${firstImg ? `<img src="${firstImg}" class="notice-thumb">` : ''}
        </div>`}).join('');
}

function showNoticeDetail(id) {
    const n = noticesData.find(x => x.id === id); currentNoticeId = id;
    document.getElementById('notice-list-view').style.display = 'none'; document.getElementById('notice-detail-view').style.display = 'flex';
    document.getElementById('detail-title').innerHTML = n.title;
    const authorTxt = n.author ? `<span style="margin-right:8px; color:#495057;">${escapeHtml(n.author)}</span>` : '';
    document.getElementById('detail-date').innerHTML = `${authorTxt}${timeAgo(n.created_at)}`;
    let bodyHtml = linkify(escapeHtml(n.content || '')).replace(/\n/g, '<br>');
    if (n.image_url) {
        let urls = n.image_url.split(','); let imgsHtml = urls.map(url => `<img src="${url}" class="notice-detail-img">`).join('');
        bodyHtml = `<div style="margin-bottom:16px;">${imgsHtml}</div>` + bodyHtml;
    }
    document.getElementById('detail-body').innerHTML = bodyHtml;
}

function showNoticeList() { document.getElementById('notice-list-view').style.display = 'block'; document.getElementById('notice-detail-view').style.display = 'none'; }
function openWriteNoticeModal(id = null) {
    const modal = document.getElementById('write-notice-modal'); const titleEl = document.getElementById('modal-notice-title');
    if (id) { const n = noticesData.find(x => x.id === id); document.getElementById('notice-title').value = n.title; document.getElementById('notice-content-text').value = n.content; document.getElementById('notice-author').value = n.author || ''; document.getElementById('notice-author').disabled = true; document.getElementById('notice-pw').value = ''; noticeMediaManager.loadUrls(n.image_url); modal.dataset.editId = id; titleEl.innerText = "게시글 수정"; } 
    else { document.getElementById('notice-title').value = ''; document.getElementById('notice-content-text').value = ''; document.getElementById('notice-author').value = ''; document.getElementById('notice-author').disabled = false; document.getElementById('notice-pw').value = ''; noticeMediaManager.loadUrls(''); delete modal.dataset.editId; titleEl.innerText = "게시글 작성"; }
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
        if (n.pw && n.pw !== pw) { alert("비밀번호 불일치"); btnSave.innerText = "등록하기"; btnSave.disabled = false; return; }
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
    if (n.pw && n.pw !== inputPw) return alert("비밀번호 불일치");
    if(confirm("이 글을 삭제하시겠습니까?")) { const { error } = await supabaseClient.from('notices').delete().eq('id', currentNoticeId); if(!error) { showNoticeList(); loadNotices(); } }
}

function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (tab === 'map') { document.getElementById('nav-map').classList.add('active'); document.getElementById('board-view').style.display = 'none'; document.getElementById('top-bar').style.display = 'flex'; document.getElementById('fab-buttons').style.display = 'flex'; } 
    else { document.getElementById('nav-board').classList.add('active'); document.getElementById('board-view').style.display = 'block'; document.getElementById('top-bar').style.display = 'none'; document.getElementById('fab-buttons').style.display = 'none'; closePanel(); closeSearchPanel(); showNoticeList(); }
}

function normalizeCat(c) { if(!c) return '실내'; if(c.includes('야외')) return '야외'; if(c.includes('문센')) return '문센'; return '실내'; }
function getMarkerClass(cat) { const nCat = normalizeCat(cat); return nCat === '야외' ? 'marker-outdoor' : (nCat === '문센' ? 'marker-moonsen' : 'marker-indoor'); }
function getMarkerHTML(place, isZoomedOut) {
    let emoji = place.category === '야외' ? '🌳' : (place.category === '문센' ? '🎨' : '🏢'); 
    let cls = getMarkerClass(place.category); const safeName = escapeHtml(place.name); 
    if (isZoomedOut) return `<div class="custom-marker zoomed ${cls}"><div class="marker-pin"></div><div class="marker-label">${safeName}</div></div>`; 
    return `<div class="custom-marker ${cls}"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div><div class="marker-label">${safeName}</div></div>`;
}
function getDistanceKm(lat1, lon1, lat2, lon2) {
    var R = 6371; var dLat = (lat2-lat1)*Math.PI/180; var dLon = (lon2-lon1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

let lastWeatherLat = null; let lastWeatherLng = null;
async function fetchWeather(lat, lng) {
    if (lastWeatherLat !== null && getDistanceKm(lastWeatherLat, lastWeatherLng, lat, lng) < 20.0) return;
    try {
        const [weatherRes, aqiRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`), 
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5`)
        ]);
        const weatherData = await weatherRes.json(); 
        const aqiData = await aqiRes.json();
        
        let temp = Math.round(weatherData.current_weather.temperature); 
        let code = weatherData.current_weather.weathercode; 
        let icon = (code >= 51 && code <= 77) ? '🌧️' : ((code >= 1 && code <= 3) ? '⛅' : '☀️');
        
        let pm10 = aqiData.current.pm10 * 0.8; 
        let pm25 = aqiData.current.pm2_5 * 0.8;
        let aqiText = '좋음'; let isBadAir = false; 
        
        if (pm10 > 150 || pm25 > 75) { aqiText = '매우나쁨'; isBadAir = true; } 
        else if (pm10 > 80 || pm25 > 35) { aqiText = '나쁨'; isBadAir = true; } 
        else if (pm10 > 30 || pm25 > 15) { aqiText = '보통'; }
        
        let isRaining = (code >= 51 && code <= 77);
        lastWeatherLat = lat; lastWeatherLng = lng;
        
        const wInfo = document.getElementById('weather-info');
        if (wInfo) wInfo.style.display = 'none';

        const sugEl = document.getElementById('weather-suggestion');
        if (sugEl) {
            let aiText = (isBadAir || isRaining) ? 
                `오늘은 ${isRaining?'비가 오니':'미세먼지가 나쁘니'} <b>실내</b> 위주로 살펴볼까요?` : 
                `날씨가 참 좋네요! <b>야외</b> 나들이를 추천해요!`;
            
            const blueStarSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px; flex-shrink:0;"><path d="M12 0C12 6.62742 17.3726 12 24 12C17.3726 12 12 17.3726 12 24C12 17.3726 6.62742 12 0 12C6.62742 12 12 6.62742 12 0Z" fill="#5c7cfa"/></svg>`;
            
            sugEl.innerHTML = `
                <div style="display:flex; align-items:center; width:100%; overflow:hidden;">
                    <div id="ai-banner-fixed" style="display:flex; align-items:center; flex-shrink:0; font-size:12px; color:#495057; white-space:nowrap;">
                        <span style="margin-right:1px; font-size:13px; line-height:1; display:flex; align-items:center; transform:translateY(-1px);">${icon}</span>
                        <b>${temp}°C</b> <span style="color:#adb5bd; margin:0 4px; font-weight:400;">/</span> <b>${aqiText}</b>
                        <span style="margin:0 8px; color:#dee2e6;">|</span>
                    </div>
                    <div id="ai-banner-wrap" style="flex:1; overflow:hidden; white-space:nowrap; position:relative; min-width:0;">
                        <div id="ai-banner-text" style="display:flex; align-items:center; font-size:12px; color:#495057; transform:translateY(-0.5px);">
                            ${blueStarSvg}<span style="font-weight:500;">${aiText}</span>
                        </div>
                    </div>
                </div>
            `;
            
            sugEl.style.marginTop = '8px';
            sugEl.style.width = 'fit-content';
            sugEl.style.maxWidth = 'calc(100vw - 32px)'; 
            sugEl.style.boxSizing = 'border-box';
            sugEl.style.padding = '7px 14px'; 
            sugEl.style.background = 'rgba(255, 255, 255, 0.7)'; 
            sugEl.style.backdropFilter = 'blur(16px)';
            sugEl.style.webkitBackdropFilter = 'blur(16px)';
            sugEl.style.border = '1px solid rgba(255,255,255,0.6)';
            sugEl.style.borderRadius = '16px';
            sugEl.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';

            window.isWeatherSuggestionVisible = true;
            const infoContent = document.getElementById('info-content');
            if (infoContent && !infoContent.classList.contains('show')) {
                sugEl.style.display = 'block';
            }

            setTimeout(() => {
                const textWrap = document.getElementById('ai-banner-wrap');
                const textEl = document.getElementById('ai-banner-text');
                if(textEl && textWrap && textEl.scrollWidth > textWrap.clientWidth) { 
                    const originalHTML = textEl.innerHTML;
                    textEl.innerHTML = originalHTML + "<span style='display:inline-block; width:40px;'></span>" + originalHTML;
                    textWrap.style.webkitMaskImage = 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)';
                    textWrap.style.maskImage = 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)';
                    textEl.style.animation = 'marquee 15s linear infinite'; 
                }
            }, 100);
        }
    } catch(e) {
        const wInfo = document.getElementById('weather-info');
        if (wInfo) wInfo.innerHTML = `⛅ --°C | 😐 보통`;
    }
}

function updateUserLocationMarker(lat, lng) {
    var pos = new naver.maps.LatLng(lat, lng);
    if (!userLocationMarker) { userLocationMarker = new naver.maps.Marker({ position: pos, map: map, icon: { content: '<div style="width:16px; height:16px; background:#4285F4; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3); cursor:pointer;"></div>', anchor: new naver.maps.Point(11, 11) }, zIndex: 9999 }); } 
    else { userLocationMarker.setPosition(pos); }
}

let currentZoomedOut = false;
async function incrementViewCount(id) {
    let place = placesData.find(p => p.id === id); if (!place) return;
    const lastViewed = localStorage.getItem('last_view_' + id); const now = Date.now(); if (lastViewed && (now - parseInt(lastViewed)) < 1000 * 60 * 5) return; 
    place.views = (place.views || 0) + 1; localStorage.setItem('last_view_' + id, now.toString());
    const { error } = await supabaseClient.from('places').update({ views: place.views }).eq('id', id);
    if (error) await supabaseClient.from('places').update({ likes: place.views }).eq('id', id);
}

function updateVisibleMarkers() {
    if (!map) return; const bounds = map.getBounds(); const isZoomedOut = map.getZoom() < 13;
    placesData.forEach(p => {
        if (!p.marker) return; const pCat = normalizeCat(p.category); const isCatActive = (activeCategory === '전체' || pCat === activeCategory);
        if (isCatActive && bounds.hasLatLng(p.marker.getPosition())) { if (!p.marker.getMap()) p.marker.setMap(map); } else { if (p.marker.getMap()) p.marker.setMap(null); }
    });
}

window.onload = function() {
    const topHeader = document.querySelector('.top-header');
    const weatherInfo = document.getElementById('weather-info');
    if(topHeader && weatherInfo) topHeader.appendChild(weatherInfo);
    map = new naver.maps.Map('map', { center: new naver.maps.LatLng(userLat, userLng), zoom: 14, mapDataControl: false });
    fetchWeather(userLat, userLng);
    if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; map.setCenter(new naver.maps.LatLng(userLat, userLng)); fetchWeather(userLat, userLng); updateUserLocationMarker(userLat, userLng); }, err => {}); }
    naver.maps.Event.addListener(map, 'click', function() { closePanel(); closeSearchPanel(); });
    naver.maps.Event.addListener(map, 'idle', function() { fetchWeather(map.getCenter().y, map.getCenter().x); updateVisibleMarkers(); });
    naver.maps.Event.addListener(map, 'zoom_changed', function() {
        let isZoomedOut = map.getZoom() < 13;
        if (currentZoomedOut !== isZoomedOut) { currentZoomedOut = isZoomedOut; placesData.forEach(p => { if (p.marker) p.marker.setIcon({ content: getMarkerHTML(p, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) }); }); }
        if (isZoomedOut) document.getElementById('map').classList.add('zoomed-out'); else document.getElementById('map').classList.remove('zoomed-out'); updateVisibleMarkers();
    });
    loadPlaces(); loadNotices();
    initBottomSheet();
};

function setCategory(cat) {
    if (activeCategory === cat && cat !== '전체') cat = '전체'; activeCategory = cat;
    document.querySelectorAll('.category-nav .chip').forEach(el => { if(el.dataset.cat === cat) el.classList.add('active'); else el.classList.remove('active'); }); applyFilters(cat);
}
function applyFilters(overrideCat) { activeCategory = overrideCat || activeCategory; updateVisibleMarkers(); if(document.getElementById('search-panel').classList.contains('show')) executeSearch(); }

let sheetState = 0; // 0: hidden, 1: mid, 2: max, 3: min
function closePanel() { 
    const panel = document.getElementById('info-content');
    panel.classList.remove('show'); 
    sheetState = 0;
    
    // PC와 모바일에 따라 닫히는 위치(방향) 지정
    panel.style.transform = isMobile ? 'translateY(100%)' : 'translateX(-20px)'; 
    
    // 💡 정보창을 닫을 때 숨겨졌던 카테고리 칩(전체/실내/야외/문센)을 다시 보이게 합니다.
    document.getElementById('category-nav').style.display = 'flex'; 

    updateVisibleMarkers(); 
    if (window.isWeatherSuggestionVisible) {
        const ws = document.getElementById('weather-suggestion');
        if(ws) ws.style.display = 'block';
    }
}

function initBottomSheet() {
    const panel = document.getElementById('info-content');
    if(!panel || !isMobile) return; 
    
    let startY = 0; let startX = 0; 
    let isDragging = false; let isDetermined = false; let startTransform = 0;

    function getTransformBase() { return sheetState === 1 ? 55 : 0; }
    
    window.applySheetState = function() {
        if (!isMobile) { panel.style.transform = 'none'; return; }
        panel.style.transition = 'transform 0.4s cubic-bezier(0.1, 0.7, 0.3, 1)';
        panel.style.transform = `translateY(${getTransformBase()}%)`;
        panel.style.borderRadius = sheetState === 2 ? '0' : '24px 24px 0 0';

        const scrollArea = document.getElementById(`scroll-area-${panel.dataset.placeId}`);
        if(scrollArea) {
            if (sheetState === 2) { 
                scrollArea.style.overflowY = 'auto'; 
                scrollArea.style.touchAction = 'pan-y'; // 브라우저에 상하 스크롤을 허용한다고 명시
            } else { 
                scrollArea.style.overflowY = 'hidden'; 
                scrollArea.style.touchAction = 'none'; 
                scrollArea.scrollTop = 0; 
            }
        }
    };

    const startDrag = (e) => {
        if (!isMobile) return; 
        startY = e.touches[0].clientY; startX = e.touches[0].clientX; 
        const scrollArea = document.getElementById(`scroll-area-${panel.dataset.placeId}`);
        if (e.target.closest('.image-slider')) return; 
        
        // 🔥 [핵심 수정 1] 최대화 상태(2)에서 스크롤 영역을 터치하면
        // 무조건 '드래그 대기' 상태로 두고 네이티브 스크롤을 뺏지 않습니다.
        if (sheetState === 2 && scrollArea && scrollArea.contains(e.target)) {
            isDragging = false; 
            isDetermined = false;
            return; 
        }

        isDragging = true; isDetermined = false; 
        startTransform = getTransformBase(); 
        panel.style.transition = 'none';
    };

    const moveDrag = (e) => {
        if (!isMobile) return;
        const scrollArea = document.getElementById(`scroll-area-${panel.dataset.placeId}`);
        const clientY = e.touches[0].clientY; const clientX = e.touches[0].clientX; 
        let deltaY = clientY - startY; let deltaX = clientX - startX;

        // 🔥 [핵심 수정 2] 최대화 상태에서 손가락이 움직일 때
        if (!isDragging && sheetState === 2 && scrollArea && scrollArea.contains(e.target)) {
            // 스크롤이 맨 위(0)인데 '아래로 당길 때(deltaY > 5)'만 창을 축소하는 드래그 모드로 전환!
            // '위로 올릴 때(deltaY < 0)'는 아무 짓도 안 하므로 자연스럽게 본문 스크롤이 작동합니다.
            if (scrollArea.scrollTop <= 0 && deltaY > 5 && Math.abs(deltaY) > Math.abs(deltaX)) {
                isDragging = true; isDetermined = true;
                startY = clientY; startTransform = getTransformBase();
                panel.style.transition = 'none';
                if(e.cancelable) e.preventDefault(); 
            }
            return;
        }

        if (!isDragging) return;

        if (!isDetermined) {
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
                isDragging = false; 
                panel.style.transform = `translateY(${startTransform}%)`;
                return;
            } else if (Math.abs(deltaY) > 5) {
                isDetermined = true; 
            } else { return; }
        }

        if(e.cancelable) e.preventDefault(); 
        let newY = startTransform + (deltaY / window.innerHeight * 100);
        if (newY < 0) newY = 0; 
        panel.style.transform = `translateY(${newY}%)`;
    };

    const endDrag = (e) => {
        if (!isDragging || !isMobile) return;
        isDragging = false; 
        const clientY = e.changedTouches[0].clientY; 
        let deltaY = clientY - startY;

        if (sheetState === 1) {
            if (deltaY < -20) sheetState = 2; 
            else if (deltaY > 30) { closePanel(); return; } 
        } else if (sheetState === 2) {
            if (deltaY > 50) sheetState = 1; 
            else sheetState = 2;
        }
        window.applySheetState();
    };

    panel.addEventListener('touchstart', startDrag, {passive: true});
    window.addEventListener('touchmove', moveDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
}

function renderPanel(id) {
    // 정보창 열 때 상단 카테고리 칩과 AI 배너 숨김
    const nav = document.getElementById('category-nav') || document.querySelector('.category-nav');
    if(nav) nav.style.display = 'none'; 
    const ws = document.getElementById('weather-suggestion');
    if(ws) ws.style.display = 'none';

    const place = placesData.find(p => p.id === id); if (!place) return;
    incrementViewCount(id); 

    let commentsArr = place.comments_list ? JSON.parse(place.comments_list) : [];
    let visibleComments = commentsArr.map((c, idx) => {
        let dateStr = timeAgo(c.date || c.id); 
        return `<div class="comment-item cmt-item-${place.id}" style="display: ${idx < 3 ? 'flex' : 'none'}; flex-direction:column; background:rgba(255,255,255,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); margin-bottom:8px; font-size:12px; line-height:1.5;"><div class="comment-header" style="display:flex; justify-content:space-between; margin-bottom:6px;"><div class="c-author" style="font-weight:800;">${escapeHtml(c.author)} <span style="font-weight:400; color:#868e96; margin-left:4px; font-size:10px;">${dateStr}</span></div><div style="display:flex; align-items:center; gap:8px;"><button class="comment-delete" onclick="editComment(${place.id}, ${c.id})" style="background:none; border:none; color:#adb5bd; cursor:pointer; font-size:11px; padding:0; font-family:inherit;">수정</button><button class="comment-delete" onclick="deleteComment(${place.id}, ${c.id})" style="background:none; border:none; color:#adb5bd; cursor:pointer; font-size:11px; padding:0; font-family:inherit;">삭제</button></div></div><div style="word-break:break-all;">${formatDescription(c.text)}</div></div>`
    }).join('');
    
    let moreBtn = commentsArr.length > 3 ? `<button id="btn-more-${place.id}" onclick="showMoreComments(${place.id})" style="background:none; border:none; color:#adb5bd; font-size:12px; font-weight:700; cursor:pointer; padding:8px 0; width:100%; text-align:center; font-family:inherit;">추가정보 더보기 ▼</button>` : '';
    let urls = place.image_url ? place.image_url.split(',') : []; 
    let isHasImage = urls.length > 0;
    let catColor = normalizeCat(place.category) === '야외' ? '#0ca678' : (place.category === '문센' ? '#f59f00' : '#5c7cfa');

    let dist = getDistanceKm(userLat, userLng, place.latitude, place.longitude);
    let distStr = dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + 'km';

    const panel = document.getElementById('info-content');
    panel.dataset.placeId = place.id;
    
    // 🔥 [조절 5] 투명도 조절 (0.75)
    panel.style.background = 'rgba(255, 255, 255, 0.75)';
    panel.style.backdropFilter = 'blur(20px)';
    panel.style.webkitBackdropFilter = 'blur(20px)';
    panel.style.boxShadow = '0 4px 24px rgba(0,0,0,0.1)';
    
    panel.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; background:transparent; padding-bottom:4px; flex-shrink:0; z-index:110;">
            
            <div style="width:100%; height:20px; display:${isMobile ? 'flex' : 'none'}; justify-content:center; align-items:center; cursor:grab; touch-action:none;">
                <div style="width:36px; height:4px; background:rgba(0,0,0,0.1); border-radius:2px;"></div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; box-sizing:border-box; padding: ${isMobile ? '8px' : '24px'} 20px 0 26px;">
                
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start;">
                    <div style="font-size:11px; font-weight:800; color:${catColor}; margin-bottom:6px;">${normalizeCat(place.category)}</div>
                    <div id="title-wrap-${place.id}" style="width:100%; overflow:hidden; white-space:nowrap; position:relative;">
                        <div class="info-title" id="dyn-title-${place.id}" style="font-size:22px; font-weight:800; color:#212529; display:inline-block;">${place.name}</div>
                    </div>
                </div>
                
                <div style="display:flex; gap:8px; flex-shrink:0; margin-left:12px; margin-top:-2px;">
                    <button class="icon-btn" onclick="openEditModal(${place.id})" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center; font-size:12px;">✏️</button>
                    <button class="icon-btn" onclick="sharePlace('${place.name.replace(/'/g, "\\'")}', '')" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center;">${shareIcon}</button>
                    <button class="icon-btn" onclick="closePanel()" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center; font-size:14px; font-weight:800;">✕</button>
                </div>
            </div>
        </div>

        <div class="info-scroll-area" id="scroll-area-${place.id}" style="flex:1; overflow-y:auto; overflow-x:hidden; width:100%; display:flex; flex-direction:column; -webkit-overflow-scrolling:touch; background:transparent;">
            <div class="info-body-wrap" style="padding: 0 20px 30px 26px; height:auto; display:flex; flex-direction:column;">
                
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                    <div style="font-size:12px; color:#495057; font-weight:700;">${distStr}</div>
                    <div style="width:1px; height:10px; background:#dee2e6;"></div>
                    <div style="font-size:12px; color:#868e96; cursor:pointer;" onclick="openMapPopup('${place.name.replace(/'/g, "\\'")}', ${place.latitude}, ${place.longitude})">${place.address}</div>
                    ${place.website_url ? `<a href="${place.website_url}" target="_blank" class="chip" style="display:inline-flex; align-items:center; padding: 4px 8px; background: rgba(241, 243, 245, 0.8); border-radius:8px; font-size:10px; font-weight:700; color:#495057; text-decoration:none; margin-left:4px;">🌐 공식홈</a>` : ''}
                </div>

                <div id="header-wrap-${place.id}" style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#f1f3f5; margin-bottom:16px; ${isHasImage ? '' : 'display:none;'}">
                    <div class="image-slider" id="slider-${place.id}" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; cursor:grab; height:200px;" 
                        onscroll="updateSliderDots(${place.id}, this)"
                        onmousedown="startImgDrag(event, this)" 
                        onmouseleave="stopImgDrag(event, this)" 
                        onmouseup="stopImgDrag(event, this)" 
                        onmousemove="doImgDrag(event, this)">
                        ${isHasImage ? urls.map(url => `<img src="${url}" style="flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:center; display:block; pointer-events:none;" draggable="false">`).join('') : ''}
                    </div>
                    ${urls.length > 1 ? `<div class="slider-dots" id="slider-dots-${place.id}" style="position:absolute; bottom:8px; left:0; right:0; display:flex; justify-content:center; gap:6px;">${urls.map((_, i) => `<div class="slider-dot ${i===0?'active':''}" style="width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.5);"></div>`).join('')}</div>` : ''}
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${place.seoul_api_area ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">혼잡도</span><span id="live-congest-${place.id}" style="flex:1; line-height:1.5; font-weight:700;">데이터 불러오는 중...</span></div>` : ''}
                    
                    ${place.business_hours ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">시간</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.business_hours).replace(/\n/g, '<br>')}</span></div>` : ''}
                    
                    ${place.parking_fee || place.seoul_api_area ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; flex-direction:column; font-size:12px; color:#495057;">
                        <div style="display:flex;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">주차</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.parking_fee || '요금 정보 없음').replace(/\n/g, '<br>')}</span></div>
                        ${place.seoul_api_area ? `<div id="live-park-${place.id}" style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.1); display:none;"></div>` : ''}
                    </div>` : ''}
                    
                    ${place.entry_fee ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">입장료</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.entry_fee).replace(/\n/g, '<br>')}</span></div>` : ''}
                    ${place.nursing_room ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">수유실</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.nursing_room).replace(/\n/g, '<br>')}</span></div>` : ''}
                </div>
                ${place.comment ? `<div style="font-size:13px; color:#495057; line-height:1.5; margin-top:16px; background:rgba(248,249,250,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); word-break:break-all;">${formatDescription(place.comment)}</div>` : ''}
                
                <div style="border-top:1px solid rgba(0,0,0,0.08); padding-top:16px; margin-top:20px; display:flex; flex-direction:column;">
                    <div style="display:flex; gap:6px; margin-bottom:6px; width:100%; box-sizing:border-box;">
                        <input type="text" id="cmt-author-${place.id}" placeholder="닉네임" style="flex:1; min-width:0; padding:8px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; font-family:inherit;">
                        <input type="password" id="cmt-pw-${place.id}" placeholder="비밀번호" style="flex:1; min-width:0; padding:8px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; font-family:inherit;">
                    </div>
                    <div style="display:flex; gap:6px; width:100%; box-sizing:border-box; height:38px; margin-bottom:16px;">
                        <textarea id="cmt-text-${place.id}" placeholder="댓글을 남겨주세요" rows="1" style="flex:1; min-width:0; padding:10px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; resize:none; line-height:1.4; font-family:inherit;"></textarea>
                        <button onclick="addComment(${place.id})" style="height:100%; background:#495057; color:white; border:none; border-radius:8px; padding:0 16px; font-weight:700; font-size:12px; cursor:pointer; flex-shrink:0; font-family:inherit;">등록</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">${visibleComments}${moreBtn}</div>
                </div>
            </div>
        </div>
    `;

    panel.classList.add('show');
    if (isMobile) { sheetState = 1; window.applySheetState(); } 
    else { panel.style.transform = 'translateX(0)'; }

    setTimeout(() => {
        const titleWrap = document.getElementById(`title-wrap-${place.id}`); 
        const titleEl = document.getElementById(`dyn-title-${place.id}`);
        if(titleEl && titleWrap && titleEl.scrollWidth > titleWrap.clientWidth) { 
            const originalHTML = titleEl.innerHTML; 
            titleEl.innerHTML = originalHTML + "<span style='display:inline-block; width:40px;'></span>" + originalHTML; 
            titleWrap.style.webkitMaskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; 
            titleWrap.style.maskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; 
            titleEl.classList.add('marquee'); 
        }
    }, 50);

    if(!isHasImage && place.category !== '문센') {
        fetchKakaoImage(place.name, `img-${place.id}`, null, `slider-${place.id}`, `header-wrap-${place.id}`); 
    }
}

async function loadPlaces() {
    try {
        const { data, error } = await supabaseClient.from('places').select('*').eq('is_approved', true);
        if (error) throw error;
        
        if (data) {
            placesData.forEach(p => { if(p.marker) p.marker.setMap(null); });
            placesData = data.map(p => { if(p.name) p.name = p.name.split('\\n')[0].split('\n')[0].trim(); return p; });
            let isZoomedOut = map.getZoom() < 13;
            placesData.forEach(place => {
                let jitterLat = place.latitude + (Math.random() - 0.5) * 0.0002; let jitterLng = place.longitude + (Math.random() - 0.5) * 0.0002;
                place.marker = new naver.maps.Marker({ position: new naver.maps.LatLng(jitterLat, jitterLng), icon: { content: getMarkerHTML(place, isZoomedOut), anchor: isZoomedOut ? new naver.maps.Point(7, 7) : new naver.maps.Point(15, 36) }, zIndex: (place.views || place.likes) || 0 });
                place.marker.addListener('click', function() { 
                    const pos = place.marker.getPosition();
                    map.setCenter(pos);                     
                    if (isMobile) {
                        map.panBy(new naver.maps.Point(0, map.getSize().height * 0.25));
                    }
                                        renderPanel(place.id); 
                    if(isMobile) closeSearchPanel(); 
                });
                place.marker.addListener('mouseover', function() { this.setZIndex(999999); });
                place.marker.addListener('mouseout', function() { this.setZIndex((place.views || place.likes) || 0); });
            });
            applyFilters('전체');
        }
    } catch (err) { alert("장소 데이터를 불러오는 데 실패했습니다: " + err.message); }
}

function closePanel() { 
    const panel = document.getElementById('info-content');
    panel.classList.remove('show'); sheetState = 0;
    panel.style.transform = isMobile ? 'translateY(100%)' : 'translateX(-20px)'; 
    
    const nav = document.getElementById('category-nav') || document.querySelector('.category-nav');
    if(nav) nav.style.display = 'flex'; 
    const weather = document.getElementById('weather-info');
    if(weather) weather.style.display = 'flex'; 

    updateVisibleMarkers(); 
    if (window.isWeatherSuggestionVisible) {
        const ws = document.getElementById('weather-suggestion');
        if(ws) ws.style.display = 'block';
    }
}

function closeSearchPanel() { document.getElementById('search-panel').classList.remove('show'); document.getElementById('search-scope-toggle').classList.remove('show'); applyFilters(); }

function setSearchScope(scope) {
    currentSearchScope = scope; document.querySelectorAll('.scope-btn').forEach(b => b.classList.remove('active')); document.getElementById('scope-' + scope).classList.add('active');
    if(scope === 'near' && navigator.geolocation) { const btn = document.querySelector('.search-input-area .scope-btn:last-child'); btn.style.opacity = '0.5'; navigator.geolocation.getCurrentPosition(pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; executeSearch(); btn.style.opacity = '1'; }, () => { btn.style.opacity = '1'; }, { enableHighAccuracy: false, timeout: 5000 }); } else executeSearch();
}

function executeSearch() {
    const query = document.getElementById('search-input').value.trim().toLowerCase(); 
    const listEl = document.getElementById('search-results-list'); 
    
    if (!query) {
        listEl.innerHTML = '<div class="res-empty">검색어를 입력해 주세요.</div>';
        return;
    }

    listEl.innerHTML = '';
    const bounds = map.getBounds(); let resultCount = 0;
    placesData.forEach(p => {
        const pCat = normalizeCat(p.category); 
        const nameMatch = p.name.toLowerCase().includes(query); 
        const catMatch = pCat.toLowerCase().includes(query); 
        
        let inScope = true; 
        if (currentSearchScope === 'bounds') inScope = bounds.hasLatLng(new naver.maps.LatLng(p.latitude, p.longitude)); 
        else if (currentSearchScope === 'near') inScope = (getDistanceKm(userLat, userLng, p.latitude, p.longitude) <= 5.0);
        
        if ((nameMatch || catMatch) && inScope) {
            const distText = currentSearchScope === 'near' ? `<span style="color:#FF6B6B; font-weight:800; font-size:11px;">📍 ${getDistanceKm(userLat, userLng, p.latitude, p.longitude).toFixed(1)}km</span>` : '';
            listEl.innerHTML += `<li class="search-result-item" onclick="switchTab('map'); map.setZoom(15); map.panTo(new naver.maps.LatLng(${p.latitude}, ${p.longitude})); renderPanel(${p.id});"><div style="font-weight:800; color:#343a40;">${p.name}</div><div style="font-size:11px; color:#868e96; display:flex; align-items:center;">${pCat} ${distText}</div></li>`; resultCount++;
        }
    });
    if(resultCount === 0) listEl.innerHTML = '<div class="res-empty">조건에 맞는 장소가 없습니다.</div>';
}

function openAppMap(type, name, lat, lng) {
    let scheme = '', fallback = '';
    if (type === 'kakao') { scheme = 'kakaomap://search?q=' + encodeURIComponent(name); fallback = 'https://map.kakao.com/link/search/' + encodeURIComponent(name); } else if (type === 'naver') { scheme = 'nmap://search?query=' + encodeURIComponent(name) + '&appname=appamap'; fallback = 'https://m.map.naver.com/search2/search.naver?query=' + encodeURIComponent(name); } else if (type === 'tmap') { scheme = 'tmap://search?name=' + encodeURIComponent(name); fallback = 'https://tmap.co.kr/tmap2/mobile/route.jsp?name=' + encodeURIComponent(name) + '&lat=' + lat + '&lon=' + lng; }
    if (isMobile) { const now = new Date().getTime(); setTimeout(() => { if (new Date().getTime() - now < 2000) window.open(fallback, '_blank'); }, 1000); location.href = scheme; } else { window.open(fallback, '_blank'); } document.getElementById('map-link-modal').style.display='none';
}

async function fetchKakaoImage(query, imgElementId, topBarId, sliderId, headerWrapId) {
    const topBarEl = topBarId ? document.getElementById(topBarId) : null; 
    const sliderEl = sliderId ? document.getElementById(sliderId) : null; 
    const headerWrapEl = headerWrapId ? document.getElementById(headerWrapId) : null;
    
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/search/image?query=${encodeURIComponent(query)}&size=1`, { headers: { "Authorization": `KakaoAK ${KAKao_REST_KEY}` } }); 
        const data = await res.json();
        
        if(data.documents && data.documents.length > 0) { 
            const imgEl = document.getElementById(imgElementId); 
            if(imgEl) { 
                // 혼합 콘텐츠(Mixed Content) 에러 방지를 위해 http를 https로 강제 변환
                const secureUrl = data.documents[0].image_url.replace('http://', 'https://');
                
                // 가상 이미지 객체로 백그라운드에서 먼저 로딩을 시도합니다.
                const tempImg = new Image();
                
                tempImg.onload = function() {
                    // 🔥 사진이 '완벽하게' 로딩 성공했을 때만 회색 박스와 사진을 화면에 노출합니다!
                    imgEl.src = secureUrl; 
                    imgEl.style.display = 'block'; 
                    
                    if(topBarEl) { topBarEl.classList.remove('no-image'); topBarEl.classList.add('has-image'); } 
                    if(sliderEl) { sliderEl.style.display = 'flex'; } 
                    if(headerWrapEl) { 
                        headerWrapEl.classList.remove('no-image'); 
                        headerWrapEl.classList.add('has-image'); 
                        headerWrapEl.style.display = 'block'; // 이때 박스가 나타남
                    } 
                };
                
                tempImg.onerror = function() {
                    // 🔥 로딩 실패 시 (엑박 등) 회색 박스 자체를 숨겨서 깔끔하게 유지합니다.
                    if(headerWrapEl) headerWrapEl.style.display = 'none';
                };
                
                // 로딩 테스트 시작
                tempImg.src = secureUrl; 
            } 
        } else { 
            if(headerWrapEl) headerWrapEl.style.display = 'none'; 
        }
    } catch(e) { 
        if(headerWrapEl) headerWrapEl.style.display = 'none'; 
    }
}

function sharePlace(name, address) { if (navigator.share) navigator.share({ title: `아빠맵 - ${name}`, text: `${name}\n아빠맵에서 확인하세요!`, url: window.location.href }); else alert("URL을 복사해주세요."); }
function openMapPopup(name, lat, lng) { document.getElementById('link-naver').onclick = () => openAppMap('naver', name, lat, lng); document.getElementById('link-kakao').onclick = () => openAppMap('kakao', name, lat, lng); document.getElementById('link-tmap').onclick = () => openAppMap('tmap', name, lat, lng); document.getElementById('map-link-modal').style.display = 'flex'; }
function showMoreComments(id) { const items = document.querySelectorAll(`.cmt-item-${id}`); let shown = 0; let hiddenCount = 0; items.forEach(item => { if (item.style.display === 'none') { if (shown < 3) { item.style.display = 'flex'; shown++; } else hiddenCount++; } }); const btn = document.getElementById(`btn-more-${id}`); if (hiddenCount > 0) btn.innerText = `추가정보 더보기 ▼`; else btn.style.display = 'none'; }
function updateSliderDots(id, el) { 
    const index = Math.round(el.scrollLeft / el.offsetWidth); 
    const dots = document.querySelectorAll('#slider-dots-' + id + ' .slider-dot'); 
    dots.forEach((dot, i) => { 
        dot.className = 'slider-dot' + (i === index ? ' active' : ''); 
        dot.style.background = i === index ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.5)';
        dot.style.transform = i === index ? 'scale(1.2)' : 'scale(1)';
        dot.style.transition = 'all 0.2s ease';
    }); 
}
function openAddModal() { const modal = document.getElementById('add-modal'); modal.style.display = 'flex'; const content = modal.querySelector('.modal-content'); if (content) content.scrollTop = 0; setTimeout(() => { const searchInput = document.getElementById('kakao-keyword'); if (searchInput) searchInput.focus(); }, 100); }
function openEditModal(id) {
    const place = placesData.find(p => p.id === id); document.getElementById('edit-place-id').value = id; document.querySelector('#edit-modal .modal-content').scrollTop = 0; 
    const nCat = normalizeCat(place.category); let catInput = document.querySelector(`input[name="edit-place-category"][value="${nCat}"]`); if(catInput) catInput.checked = true;
    document.getElementById('edit-website').value = place.website_url || ''; document.getElementById('edit-hours').value = place.business_hours || '';
    const pInput = document.getElementById('edit-parking'); const pBtnFree = document.getElementById('btn-edit-free-parking'); const pBtnNo = document.getElementById('btn-edit-no-parking'); pBtnFree.classList.remove('active'); pBtnNo.classList.remove('active'); pInput.disabled = false; if(place.parking_fee === '무료') { pBtnFree.classList.add('active'); pInput.disabled = true; pInput.value = '무료'; pInput.dataset.oldVal = ''; } else if(place.parking_fee === '불가') { pBtnNo.classList.add('active'); pInput.disabled = true; pInput.value = '불가'; pInput.dataset.oldVal = ''; } else { pInput.value = place.parking_fee || ''; }
    const eInput = document.getElementById('edit-entry'); const eBtnNo = document.getElementById('btn-edit-no-entry'); eBtnNo.classList.remove('active'); eInput.disabled = false; if(place.entry_fee === '없음') { eBtnNo.classList.add('active'); eInput.disabled = true; eInput.value = '없음'; eInput.dataset.oldVal = ''; } else { eInput.value = place.entry_fee || ''; }
    const nInput = document.getElementById('edit-nursing'); const nBtn = document.getElementById('btn-edit-no-nursing'); if(place.nursing_room === '없음') { nBtn.classList.add('active'); nInput.disabled = true; nInput.value = '없음'; nInput.dataset.oldVal = ''; } else { nBtn.classList.remove('active'); nInput.disabled = false; nInput.value = place.nursing_room || ''; }
    document.getElementById('edit-comment').value = place.comment || ''; placeEditMediaManager.loadUrls(place.image_url); document.getElementById('edit-modal').style.display = 'flex';
}

async function submitEditInfo() {
    const id = document.getElementById('edit-place-id').value;
    const place = placesData.find(p => p.id == id);
    const catRadio = document.querySelector('input[name="edit-place-category"]:checked'); 
    const cat = catRadio ? catRadio.value : '';
    
    if(!cat) return alert("카테고리를 선택하세요.");
    const btnSave = document.querySelector('#edit-modal .btn-save'); 
    btnSave.innerText = "업로드 중..."; btnSave.disabled = true;
    
    let newImgUrls = await placeEditMediaManager.uploadAll();
    
    const tag = `[수정요청_ID:${id}]\n`;
    const newDesc = document.getElementById('edit-comment').value.trim();

    let updatePayload = { 
        name: place.name,
        address: place.address, 
        latitude: place.latitude,
        longitude: place.longitude,
        category: cat, 
        website_url: document.getElementById('edit-website').value.trim(), 
        business_hours: document.getElementById('edit-hours').value.trim(), 
        parking_fee: document.getElementById('edit-parking').value.trim(), 
        entry_fee: document.getElementById('edit-entry').value.trim(), 
        nursing_room: document.getElementById('edit-nursing').value.trim(), 
        comment: tag + newDesc,
        is_approved: false 
    };
    if(newImgUrls !== null) updatePayload.image_url = newImgUrls;
    else updatePayload.image_url = place.image_url;

    const { error } = await supabaseClient.from('places').insert([updatePayload]);
    
    if(!error) { 
        alert("수정 요청이 접수되었습니다. 관리자 승인 후 원본에 반영됩니다."); 
        document.getElementById('edit-modal').style.display = 'none'; 
        closePanel(); 
    } else {
        alert("업데이트 실패: " + error.message);
    }
    btnSave.innerText = "재승인 요청"; btnSave.disabled = false;
}

async function addComment(id) {
    const author = document.getElementById('cmt-author-' + id).value.trim() || '익명'; const pw = document.getElementById('cmt-pw-' + id).value.trim(); const text = document.getElementById('cmt-text-' + id).value.trim(); const date = new Date().toISOString(); 
    if (!text || !pw) return alert('내용과 비밀번호를 모두 입력해주세요.');
    let place = placesData.find(p => p.id === id); let comments = place.comments_list ? JSON.parse(place.comments_list) : []; comments.unshift({ id: Date.now(), author, pw, text, date }); 
    let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson; renderPanel(id);
    await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', id);
}

async function editComment(placeId, commentId) {
    const pwInput = await askPassword(); if (!pwInput) return;
    let place = placesData.find(p => p.id === placeId); let comments = place.comments_list ? JSON.parse(place.comments_list) : []; const target = comments.find(c => c.id === commentId);
    if (target && target.pw === pwInput) { const newText = await askTextPrompt(target.text); if (newText !== null && newText.trim() !== '') { target.text = newText.trim(); let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson; renderPanel(placeId); await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId); } } else alert("비밀번호가 틀렸습니다.");
}

async function deleteComment(placeId, commentId) {
    const pwInput = await askPassword(); if (!pwInput) return;
    let place = placesData.find(p => p.id === placeId); let comments = place.comments_list ? JSON.parse(place.comments_list) : []; const target = comments.find(c => c.id === commentId);
    if (target && target.pw === pwInput) { comments = comments.filter(c => c.id !== commentId); let updatedJson = JSON.stringify(comments); place.comments_list = updatedJson; renderPanel(placeId); await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId); } else alert("비밀번호가 틀렸습니다.");
}

function moveToCurrentLocation() {
    const btn = document.querySelector('.btn-location'); btn.classList.add('btn-loading'); 
    if (navigator.geolocation) { navigator.geolocation.getCurrentPosition(pos => { userLat = pos.coords.latitude; userLng = pos.coords.longitude; map.setCenter(new naver.maps.LatLng(userLat, userLng)); map.setZoom(15); fetchWeather(userLat, userLng); updateUserLocationMarker(userLat, userLng); btn.classList.remove('btn-loading'); }, err => { btn.classList.remove('btn-loading'); }, { enableHighAccuracy: false, timeout: 5000 }); } else btn.classList.remove('btn-loading');
}

async function searchKakaoPlace() {
    const kw = document.getElementById('kakao-keyword').value.trim(); if(!kw) return;
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw)}`, { headers: { "Authorization": `KakaoAK ${KAKao_REST_KEY}` } });
        const data = await res.json(); const listEl = document.getElementById('kakao-result-list'); listEl.innerHTML = '';
        if(data.documents.length === 0) listEl.innerHTML = '<li style="text-align:center;">결과가 없습니다.</li>';
        else data.documents.forEach(doc => { const li = document.createElement('li'); li.innerHTML = `<strong>${doc.place_name}</strong><span>${doc.road_address_name || doc.address_name}</span>`; li.onclick = () => { document.getElementById('place-name').value = doc.place_name; document.getElementById('place-address').value = doc.road_address_name || doc.address_name; selectedLat = parseFloat(doc.y); selectedLng = parseFloat(doc.x); map.setCenter(new naver.maps.LatLng(selectedLat, selectedLng)); map.setZoom(16); listEl.style.display = 'none'; }; listEl.appendChild(li); }); listEl.style.display = 'block';
    } catch(e) {}
}

async function savePlace() {
    const catRadio = document.querySelector('input[name="place-category"]:checked'); const cat = catRadio ? catRadio.value : '';
    var name = document.getElementById('place-name').value.trim(); if (!name || !cat) return alert("장소명과 카테고리는 필수입니다!");
    let duplicate = placesData.find(p => p.name === name);
    if (duplicate) { alert("이미 등록된 장소입니다. 수정 창을 엽니다."); document.getElementById('add-modal').style.display='none'; map.setCenter(new naver.maps.LatLng(duplicate.latitude, duplicate.longitude)); map.setZoom(16); renderPanel(duplicate.id); setTimeout(() => openEditModal(duplicate.id), 300); return; }
    const btnSave = document.getElementById('btn-save-place'); btnSave.innerText = "업로드 중..."; btnSave.disabled = true; let imgUrls = await placeAddMediaManager.uploadAll();
    const { data, error } = await supabaseClient.from('places').insert([{ category: cat, name: name, address: document.getElementById('place-address').value.trim(), website_url: document.getElementById('place-website').value.trim(), latitude: selectedLat || map.getCenter().y, longitude: selectedLng || map.getCenter().x, business_hours: document.getElementById('place-hours-time').value.trim(), parking_fee: document.getElementById('place-parking-detail').value.trim(), entry_fee: document.getElementById('place-entry-detail').value.trim(), nursing_room: document.getElementById('place-nursing-detail').value.trim(), comment: document.getElementById('place-comment').value, image_url: imgUrls, is_approved: false }]).select();
    if (!error && data && data.length > 0) { 
        document.getElementById('add-modal').style.display='none'; document.getElementById('place-name').value = ''; document.getElementById('place-address').value = ''; document.getElementById('kakao-keyword').value = ''; document.getElementById('place-website').value = ''; document.getElementById('place-hours-time').value = ''; document.getElementById('place-parking-detail').value = ''; document.getElementById('place-entry-detail').value = ''; document.getElementById('place-nursing-detail').value = ''; document.getElementById('place-comment').value = ''; placeAddMediaManager.loadUrls(''); alert("장소가 접수되었습니다! 관리자 승인 후 지도에 노출됩니다."); btnSave.innerText = "승인 요청하기"; btnSave.disabled = false;
    } else { alert("등록 실패. " + error.message); btnSave.innerText = "승인 요청하기"; btnSave.disabled = false; }
}

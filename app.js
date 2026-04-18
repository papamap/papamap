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
const viewIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:2px; margin-bottom:-2px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

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
        console.error("Notices DB Error:", err);
        const container = document.getElementById('notice-list-container');
        if(container) {
            container.innerHTML = `<div style="text-align:center; padding:40px; color:#FF6B6B; font-size:13px; line-height:1.5;">게시글을 불러오지 못했습니다.</div>`;
        }
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
        const [weatherRes, aqiRes] = await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`), fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10,pm2_5`)]);
        const weatherData = await weatherRes.json(); const aqiData = await aqiRes.json();
        let temp = Math.round(weatherData.current_weather.temperature); let code = weatherData.current_weather.weathercode; 
        let icon = (code >= 51 && code <= 77) ? '🌧️' : ((code >= 1 && code <= 3) ? '⛅' : '☀️');
        
        let pm10 = aqiData.current.pm10 * 0.8; 
        let pm25 = aqiData.current.pm2_5 * 0.8;
        let aqiIcon = '😊'; let aqiText = '좋음'; let isBadAir = false; 
        
        if (pm10 > 150 || pm25 > 75) { aqiIcon = '👿'; aqiText = '매우나쁨'; isBadAir = true; } 
        else if (pm10 > 80 || pm25 > 35) { aqiIcon = '😷'; aqiText = '나쁨'; isBadAir = true; } 
        else if (pm10 > 30 || pm25 > 15) { aqiIcon = '😐'; aqiText = '보통'; }
        
        let isRaining = (code >= 51 && code <= 77);
        if (isRaining) aqiIcon = '☔';
        currentWeatherHtml = `${icon} ${temp}°C | ${aqiIcon} ${aqiText}`;
        lastWeatherLat = lat; lastWeatherLng = lng;
        
        document.getElementById('weather-info').innerHTML = currentWeatherHtml;

        const sugEl = document.getElementById('weather-suggestion');
        if (isBadAir || isRaining) { 
            sugEl.innerHTML = `💡 오늘은 ${isRaining?'비가 오니':'미세먼지가 나쁘니'} <b>실내</b> 위주로 살펴보는 건 어떨까요?`; 
        } else { 
            sugEl.innerHTML = `💡 날씨와 미세먼지가 모두 좋네요! <b>야외</b> 나들이를 떠나볼까요?`; 
        }
        
        window.isWeatherSuggestionVisible = true;
        if (!document.getElementById('info-content').classList.contains('show')) {
            sugEl.style.display = 'block';
        }
    } catch(e) {
        document.getElementById('weather-info').innerHTML = `⛅ --°C | 😐 보통`;
    }
}

function updateUserLocationMarker(lat, lng) {
    var pos = new naver.maps.LatLng(lat, lng);
    if (!userLocationMarker) { userLocationMarker = new naver.maps.Marker({ position: pos, map: map, icon: { content: '<div style="width:16px; height:16px; background:#4285F4; border-radius:50%; border:3px solid white; box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>', anchor: new naver.maps.Point(11, 11) }, zIndex: 9999 }); } 
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
    panel.classList.remove('show'); sheetState = 0;
    
    panel.style.transform = isMobile ? 'translateY(100%)' : 'translateX(-20px)'; 
    
    updateVisibleMarkers(); 
    if (window.isWeatherSuggestionVisible) {
        const ws = document.getElementById('weather-suggestion');
        if(ws) ws.style.display = 'block';
    }
}

function initBottomSheet() {
    const panel = document.getElementById('info-content');
    if(!panel || !isMobile) return; 
    
    let startY = 0; let startX = 0; let isDragging = false; 
    let isDetermined = false; let startTransform = 0;

    function getTransformBase() { return sheetState === 1 ? 55 : (sheetState === 2 ? 15 : 80); }
    
    window.applySheetState = function() {
        if (!isMobile) { panel.style.transform = 'none'; return; }
        panel.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
        panel.style.transform = `translateY(${getTransformBase()}%)`;
        const scrollArea = document.getElementById(`scroll-area-${panel.dataset.placeId}`);
        if(scrollArea) {
            if (sheetState === 2) { scrollArea.style.overflowY = 'auto'; scrollArea.style.touchAction = 'auto'; } 
            else { scrollArea.style.overflowY = 'hidden'; scrollArea.style.touchAction = 'none'; scrollArea.scrollTop = 0; }
        }
    };

    const startDrag = (e) => {
        if (!isMobile) return; 
        const scrollArea = document.getElementById(`scroll-area-${panel.dataset.placeId}`);
        
        // 최상단 상태에서 내용을 스크롤 중이면 창 드래그 취소
        if (sheetState === 2 && scrollArea && scrollArea.contains(e.target) && scrollArea.scrollTop > 0) return; 

        isDragging = true; 
        isDetermined = false; // 가로인지 세로인지 아직 모름
        startY = e.touches[0].clientY; 
        startX = e.touches[0].clientX; 
        startTransform = getTransformBase(); 
        panel.style.transition = 'none';
    };

    const moveDrag = (e) => {
        if (!isDragging || !isMobile) return;
        const clientY = e.touches[0].clientY; 
        const clientX = e.touches[0].clientX; 
        let deltaY = clientY - startY; 
        let deltaX = clientX - startX;

        // 움직임 방향 판단 (가로 스와이프면 창 이동 취소)
        if (!isDetermined) {
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
                isDragging = false; 
                panel.style.transition = 'transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1)';
                panel.style.transform = `translateY(${startTransform}%)`;
                return;
            } else if (Math.abs(deltaY) > 5) {
                isDetermined = true; // 세로 스와이프 확정
            } else {
                return;
            }
        }

        if(e.cancelable) e.preventDefault(); 
        let newY = startTransform + (deltaY / window.innerHeight * 100);
        if (newY < 15) newY = 15; 
        panel.style.transform = `translateY(${newY}%)`;
    };

    const endDrag = (e) => {
        if (!isDragging || !isMobile) return;
        isDragging = false; 
        const clientY = e.changedTouches[0].clientY; 
        let deltaY = clientY - startY;

        if (sheetState === 1 && Math.abs(deltaY) > 10) { sheetState = 2; } 
        else if (deltaY < -30) { if(sheetState === 1 || sheetState === 3) sheetState = 2; } 
        else if (deltaY > 30) { if(sheetState === 2) sheetState = 1; else if(sheetState === 1) sheetState = 3; else if(sheetState === 3) { closePanel(); return; } }
        window.applySheetState();
    };

    panel.addEventListener('touchstart', startDrag, {passive: true});
    window.addEventListener('touchmove', moveDrag, {passive: false});
    window.addEventListener('touchend', endDrag);
}

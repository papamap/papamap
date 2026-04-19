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

const shareIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`;

function timeAgo(dateInput) {
    const past = new Date(dateInput);
    const now = new Date();
    const seconds = Math.floor((now - past) / 1000);
    if (isNaN(seconds) || seconds < 0) return "방금 전";
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7);
    return `${weeks}주 전`;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
    const deg2rad = (deg) => deg * (Math.PI / 180);
    const R = 6371; 
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// 지도 초기화
function initMap() {
    map = new naver.maps.Map('map', {
        center: new naver.maps.LatLng(userLat, userLng),
        zoom: 14,
        minZoom: 10,
        maxZoom: 19,
        scaleControl: false,
        logoControl: false,
        mapDataControl: false,
        zoomControl: false,
        mapTypeControl: false
    });
    
    naver.maps.Event.addListener(map, 'click', function() {
        if (!isMobile) closePanel();
    });

    loadPlaces();
}

async function loadPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').eq('is_approved', true);
    if (!error && data) {
        placesData = data;
        renderMarkers();
    }
}

var markers = [];
function renderMarkers() {
    markers.forEach(m => m.setMap(null));
    markers = [];
    
    let filtered = placesData;
    if (activeCategory !== '전체') {
        filtered = placesData.filter(p => normalizeCat(p.category) === activeCategory);
    }

    filtered.forEach(p => {
        let iconHtml = `<div class="marker-container ${normalizeCat(p.category) === '야외' ? 'outdoor' : (p.category === '문센' ? 'moonsen' : 'indoor')}"><div class="marker-pin"></div></div>`;
        
        let marker = new naver.maps.Marker({
            position: new naver.maps.LatLng(p.latitude, p.longitude),
            map: map,
            icon: { content: iconHtml, anchor: new naver.maps.Point(12, 12) }
        });
        
        naver.maps.Event.addListener(marker, 'click', () => renderPanel(p.id));
        markers.push(marker);
    });
}

function filterCategory(cat) {
    activeCategory = cat;
    document.querySelectorAll('.nav-chip').forEach(c => {
        c.classList.toggle('active', c.innerText === cat);
    });
    renderMarkers();
}

// 🔥 정보창 렌더링 함수 (고정형 UI 적용)
function renderPanel(id) {
    const nav = document.getElementById('category-nav');
    if(nav) nav.style.display = 'none'; 
    const ws = document.getElementById('weather-suggestion');
    if(ws) ws.style.display = 'none';

    const place = placesData.find(p => p.id === id); if (!place) return;
    
    let commentsArr = place.comments_list ? JSON.parse(place.comments_list) : [];
    let visibleComments = commentsArr.map((c, idx) => {
        let dateStr = timeAgo(c.date || c.id); 
        return `<div class="comment-item cmt-item-${place.id}" style="display: ${idx < 3 ? 'flex' : 'none'}; flex-direction:column; background:rgba(255,255,255,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); margin-bottom:8px; font-size:12px; line-height:1.5;"><div class="comment-header" style="display:flex; justify-content:space-between; margin-bottom:6px;"><div class="c-author" style="font-weight:800;">${escapeHtml(c.author)} <span style="font-weight:400; color:#868e96; margin-left:4px; font-size:10px;">${dateStr}</span></div><div style="display:flex; align-items:center; gap:8px;"><button class="comment-delete" onclick="deleteComment(${place.id}, ${c.id})" style="background:none; border:none; color:#adb5bd; cursor:pointer; font-size:11px; padding:0; font-family:inherit;">삭제</button></div></div><div style="word-break:break-all;">${formatDescription(c.text)}</div></div>`
    }).join('');
    
    let moreBtn = commentsArr.length > 3 ? `<button id="btn-more-${place.id}" onclick="showMoreComments(${place.id})" style="background:none; border:none; color:#adb5bd; font-size:12px; font-weight:700; cursor:pointer; padding:8px 0; width:100%; text-align:center; font-family:inherit;">추가정보 더보기 ▼</button>` : '';
    let urls = place.image_url ? place.image_url.split(',') : []; 
    let isHasImage = urls.length > 0;
    let catColor = normalizeCat(place.category) === '야외' ? '#0ca678' : (place.category === '문센' ? '#f59f00' : '#5c7cfa');

    let dist = getDistanceKm(userLat, userLng, place.latitude, place.longitude);
    let distStr = dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + 'km';

    const panel = document.getElementById('info-content');
    panel.dataset.placeId = place.id;
    panel.style.background = 'rgba(255, 255, 255, 0.75)';
    panel.style.backdropFilter = 'blur(20px)';
    
    panel.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; background:transparent; padding-bottom:4px; flex-shrink:0; z-index:110;">
            <div style="width:100%; height:20px; display:${isMobile ? 'flex' : 'none'}; justify-content:center; align-items:center; cursor:grab; touch-action:none;">
                <div style="width:36px; height:4px; background:rgba(0,0,0,0.1); border-radius:2px;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; box-sizing:border-box; padding: ${isMobile ? '8px' : '24px'} 20px 0 26px;">
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start;">
                    <div style="font-size:11px; font-weight:800; color:${catColor}; margin-bottom:6px;">${normalizeCat(place.category)}</div>
                    <div id="title-wrap-${place.id}" style="width:100%; overflow:hidden; white-space:nowrap; position:relative;">
                        <div class="info-title" id="dyn-title-${place.id}" style="font-size:22px; font-weight:800; color:#212529;">${place.name}</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-shrink:0; margin-left:12px; margin-top:-2px;">
                    <button class="icon-btn" onclick="sharePlace('${place.name.replace(/'/g, "\\'")}', '')" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center;">${shareIcon}</button>
                    <button class="icon-btn" onclick="closePanel()" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center; font-size:14px; font-weight:800;">✕</button>
                </div>
            </div>
        </div>

        <div class="info-scroll-area" id="scroll-area-${place.id}" style="flex:1; overflow-y:auto; width:100%; display:flex; flex-direction:column;">
            <div class="info-body-wrap" style="padding: 0 20px 30px 26px; height:auto; display:flex; flex-direction:column;">
                
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                    <div style="font-size:12px; color:#495057; font-weight:700;">${distStr}</div>
                    <div style="width:1px; height:10px; background:#dee2e6;"></div>
                    <div style="font-size:12px; color:#868e96; cursor:pointer;" onclick="openMapPopup('${place.name.replace(/'/g, "\\'")}', ${place.latitude}, ${place.longitude})">${place.address}</div>
                    ${place.website_url ? `<a href="${place.website_url}" target="_blank" class="chip" style="display:inline-flex; align-items:center; padding: 4px 8px; background: rgba(241, 243, 245, 0.8); border-radius:8px; font-size:10px; font-weight:700; color:#495057; text-decoration:none; margin-left:4px;">🌐 공식홈</a>` : ''}
                </div>

                <div id="header-wrap-${place.id}" style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#f1f3f5; margin-bottom:16px; height:200px; ${isHasImage ? '' : 'display:none;'}">
                    <div class="image-slider" id="slider-${place.id}" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; height:100%;">
                        ${isHasImage ? urls.map(url => `<img src="${url}" style="flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:center;">`).join('') : ''}
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${place.seoul_api_area ? `
                    <div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; align-items:center; font-size:12px; color:#495057;">
                        <span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0;">혼잡도</span>
                        <span id="live-congest-cur-${place.id}" style="flex:1; font-weight:800; color:#5c7cfa;">데이터 확인중... 🚀</span>
                        <button id="btn-congest-toggle-${place.id}" style="display:none; background:rgba(92,124,250,0.1); border:1px solid rgba(92,124,250,0.3); color:#5c7cfa; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; padding:4px 8px; margin-left:8px; flex-shrink:0;">예측 보기</button>
                    </div>` : ''}
                    
                    ${place.business_hours ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">시간</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.business_hours).replace(/\n/g, '<br>')}</span></div>` : ''}
                    
                    ${place.parking_fee || place.seoul_api_area ? `
                    <div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; flex-direction:column; font-size:12px; color:#495057;">
                        <div style="display:flex;">
                            <span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">주차</span>
                            <span style="flex:1; line-height:1.5;">${escapeHtml(place.parking_fee || '요금 정보 없음').replace(/\n/g, '<br>')}</span>
                        </div>
                        ${place.seoul_api_area ? `
                        <div id="live-park-${place.id}" style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(0,0,0,0.1); display:flex; flex-direction:column; gap:6px;">
                            <span style="color:#adb5bd; font-size:11px; font-weight:700;">실시간 주차 확인중... 🚀</span>
                        </div>` : ''}
                    </div>` : ''}
                </div>

                ${place.comment ? `<div style="font-size:13px; color:#495057; line-height:1.5; margin-top:16px; background:rgba(248,249,250,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); word-break:break-all;">${formatDescription(place.comment)}</div>` : ''}
                
                <div style="border-top:1px solid rgba(0,0,0,0.08); padding-top:16px; margin-top:20px;">
                    <div style="display:flex; gap:6px; margin-bottom:16px;">
                        <textarea id="cmt-text-${place.id}" placeholder="아이와 다녀온 후기를 남겨주세요" rows="1" style="flex:1; padding:10px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; outline:none; resize:none;"></textarea>
                        <button onclick="addComment(${place.id})" style="background:#495057; color:white; border:none; border-radius:8px; padding:0 16px; font-weight:700; font-size:12px; cursor:pointer;">등록</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">${visibleComments}${moreBtn}</div>
                </div>
            </div>
        </div>
    `;

    panel.classList.add('show');
    if (isMobile) { sheetState = 1; window.applySheetState(); } 
    else { panel.style.transform = 'translateX(0)'; }

    if(place.seoul_api_area) {
        fetchSeoulApiData(place.seoul_api_area, place.id);
    }
}

// 🔥 API 통신 및 UI 업데이트 함수
async function fetchSeoulApiData(areaName, placeId) {
    const congestCur = document.getElementById(`live-congest-cur-${placeId}`);
    const congestBtn = document.getElementById(`btn-congest-toggle-${placeId}`);
    const parkBox = document.getElementById(`live-park-${placeId}`);
    
    try {
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(areaName)}`;
        // AllOrigins를 통해 HTTPS 차단 우회 및 데이터 파싱
        const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
        const wrapper = await response.json();
        const data = JSON.parse(wrapper.contents);
        
        if(data.CITYDATA) {
            const cd = data.CITYDATA;
            
            // 1. 혼잡도 처리
            if(cd.LIVE_PPLTN_STTS && cd.LIVE_PPLTN_STTS.length > 0) {
                const pop = cd.LIVE_PPLTN_STTS[0];
                let cur = pop.AREA_CONGEST_LVL;
                if(congestCur) congestCur.innerHTML = `<span style="color:${getCongestColor(cur)}; font-weight:800;">${cur}</span>`;
                
                let fcst = pop.FCST_PPLTN || [];
                if(fcst.length > 3 && congestBtn) {
                    let f2 = fcst[1], f4 = fcst[3];
                    let t2 = f2.FCST_TIME.split(' ')[1], t4 = f4.FCST_TIME.split(' ')[1];
                    congestBtn.style.display = 'block';
                    congestBtn.onclick = () => alert(`📡 [${areaName}] 혼잡도 예측\n\n• 2시간 뒤 (${t2}) : ${f2.FCST_CONGEST_LVL}\n• 4시간 뒤 (${t4}) : ${f4.FCST_CONGEST_LVL}`);
                }
            } else { if(congestCur) congestCur.innerHTML = "정보 없음"; }

            // 2. 주차장 처리
            const validPrk = (cd.PRK_STTS || []).filter(p => p.CUR_PRK_CNT !== "" && p.CUR_PRK_CNT !== undefined);
            if(validPrk.length > 0) {
                let prkHtml = validPrk.map(p => {
                    let remain = Math.max((parseInt(p.CPCTY) || 0) - (parseInt(p.CUR_PRK_CNT) || 0), 0);
                    return `<div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                        <span style="color:#495057; font-weight:600; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.PRK_NM}</span>
                        <span style="color:#37B24D; font-weight:800; font-size:11px; flex-shrink:0; margin-left:8px;">${remain}대 여유 <span style="color:#adb5bd; font-weight:500;">/${p.CPCTY}</span></span>
                    </div>`;
                }).join('');
                if(parkBox) parkBox.innerHTML = prkHtml; 
            } else { if(parkBox) parkBox.innerHTML = `<span style="color:#868e96; font-size:11px;">실시간 정보 없음</span>`; }
        } else if (data.RESULT) {
            if(congestCur) congestCur.innerHTML = `<span style="color:#FF6B6B;">${data.RESULT.MESSAGE}</span>`;
            if(parkBox) parkBox.innerHTML = "";
        }
    } catch(e) { 
        if(congestCur) congestCur.innerHTML = `<span style="color:#FF6B6B; font-size:11px;">통신 지연 (새로고침 요망)</span>`;
    }
}

function getCongestColor(lvl) {
    if(lvl === '여유') return '#37B24D';
    if(lvl === '보통') return '#f59f00';
    if(lvl === '약간 붐빔') return '#FF6B6B';
    if(lvl === '붐빔') return '#e03131';
    return '#495057';
}

function closePanel() {
    const panel = document.getElementById('info-content');
    panel.classList.remove('show');
    if (isMobile) { sheetState = 0; window.applySheetState(); }
    else { panel.style.transform = 'translateX(-100%)'; }
    document.getElementById('category-nav').style.display = 'flex';
}

function escapeHtml(text) {
    if(!text) return '';
    return text.replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
    });
}

function normalizeCat(cat) {
    if (!cat) return '실내';
    if (cat.includes('야외')) return '야외';
    if (cat.includes('문센')) return '문센';
    return '실내';
}

function formatDescription(text) {
    if(!text) return '';
    return escapeHtml(text).replace(/\n/g, '<br>');
}

function openMapPopup(name, lat, lng) {
    const url = `https://map.naver.com/v5/search/${encodeURIComponent(name)}?c=${lng},${lat},15,0,0,0,dh`;
    window.open(url, '_blank');
}

// 페이지 로드 시 시작
window.onload = initMap;

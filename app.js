const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const KAKAO_REST_KEY = "f971a5a1cc6ae49cf691f170f5e03dfd"; 

var map;
var placesData = []; 
var activeCategory = '전체';
var userLat = 37.5665, userLng = 126.9780; 

let sheetState = 'hidden'; // 모바일 바텀시트 상태 변수

function escapeHtml(t){const m={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};return!t?'':t.replace(/[&<>"']/g,x=>m[x]);}

// 모바일 바텀시트 터치 스와이프 제어
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
        
        if (deltaY < -30) { // 위로 올리기
            if (sheetState === 'peek') setSheetState('half');
            else if (sheetState === 'half') setSheetState('full');
        } else if (deltaY > 30) { // 아래로 내리기
            if (sheetState === 'full') setSheetState('half');
            else if (sheetState === 'half') setSheetState('peek');
            else if (sheetState === 'peek') setSheetState('hidden');
        }
    });
}

// 팝업 로드 로직 (관리자 설정 날짜 정상 작동)
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
            document.getElementById('popup-slider').innerHTML = validPopup.image_url.split(',').map(url => `<img src="${url}" style="width:100%; object-fit:contain; border-radius:24px 24px 0 0;">`).join('');
            document.getElementById('main-popup').style.display = 'flex';
        }
    }
}

function closeMainPopup() {
    if(document.getElementById('popup-hide-today').checked) localStorage.setItem('hidePopupDate', new Date().toDateString());
    document.getElementById('main-popup').style.display = 'none';
}

// 날씨 정보 가져오기
async function fetchWeather(lat, lng) {
    try {
        const [wRes, aRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`), 
            fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10`)
        ]);
        const w = await wRes.json(), a = await aRes.json();
        let temp = Math.round(w.current_weather.temperature), code = w.current_weather.weathercode, icon = '☀️';
        if(code >= 1 && code <= 3) icon = '⛅'; if(code >= 51 && code <= 77) icon = '☔';
        let pm10 = a.current.pm10, aqiIcon = '😊', aqiText = '좋음';
        if (pm10 > 80) { aqiIcon = '😷'; aqiText = '나쁨'; }

        const weatherHtml = `<div style="cursor:pointer; display:inline-flex; align-items:center; gap:6px; background:rgba(241,243,245,0.9); padding:8px 14px; border-radius:12px; font-size:13px; font-weight:800; color:#495057;" onclick="window.open('https://weather.naver.com/', '_blank')">${icon} ${temp}°C | ${aqiIcon} ${aqiText}</div>`;
        document.getElementById('weather-info-box').innerHTML = weatherHtml;
    } catch(e) { console.log(e); }
}

// 초기 로딩
window.onload = function() {
    // 1. 네이버 지도 초기화 (오류 수정)
    map = new naver.maps.Map('map', { 
        center: new naver.maps.LatLng(userLat, userLng), 
        zoom: 14, 
        mapDataControl: false 
    });

    initBottomSheet(); 
    loadMainPopup(); 
    
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            userLat = pos.coords.latitude; userLng = pos.coords.longitude;
            map.setCenter(new naver.maps.LatLng(userLat, userLng)); 
            fetchWeather(userLat, userLng);
        }, err => { fetchWeather(userLat, userLng); }, { timeout: 5000 });
    }

    naver.maps.Event.addListener(map, 'click', () => { setSheetState('hidden'); });
    naver.maps.Event.addListener(map, 'idle', () => updateVisibleMarkers());

    loadPlaces();
};

function normalizeCat(c) { return !c ? '실내' : c.includes('야외') ? '야외' : c.includes('문센') ? '문센' : '실내'; }

function getMarkerHTML(p) {
    let emoji = normalizeCat(p.category) === '야외' ? '🌳' : normalizeCat(p.category) === '문센' ? '🎨' : '🏢';
    let cls = normalizeCat(p.category) === '야외' ? 'marker-outdoor' : normalizeCat(p.category) === '문센' ? 'marker-moonsen' : 'marker-indoor';
    const n = escapeHtml(p.name);
    return `<div class="custom-marker ${cls}" title="${n}"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div><div class="marker-label">${n}</div></div>`;
}

function setCategory(cat) { 
    activeCategory = cat; 
    document.querySelectorAll('.category-nav .chip').forEach(e => e.classList.toggle('active', e.dataset.cat === cat)); 
    updateVisibleMarkers(); 
}

function updateVisibleMarkers() {
    if (!map) return; const b = map.getBounds();
    placesData.forEach(p => {
        if (!p.marker) return;
        const c = (activeCategory === '전체' || normalizeCat(p.category) === activeCategory);
        if (c && b.hasLatLng(p.marker.getPosition())) { if (!p.marker.getMap()) p.marker.setMap(map); } else p.marker.setMap(null);
    });
}

async function loadPlaces() {
    const { data } = await supabaseClient.from('places').select('*').eq('is_approved', true);
    if (data) {
        placesData = data;
        placesData.forEach(p => {
            p.marker = new naver.maps.Marker({ 
                position: new naver.maps.LatLng(p.latitude, p.longitude), 
                icon: { content: getMarkerHTML(p), anchor: new naver.maps.Point(14, 28) } 
            });
            p.marker.addListener('click', () => { map.panTo(p.marker.getPosition()); renderPanel(p.id); });
        });
        updateVisibleMarkers();
    }
}

function renderPanel(id) {
    const p = placesData.find(x => x.id === id); if (!p) return;
    
    let catColor = normalizeCat(p.category) === '야외' ? '#0ca678' : (p.category === '문센' ? '#f59f00' : '#5c7cfa');

    document.getElementById('info-scroll-area').innerHTML = `
        <div class="info-body-wrap" style="padding-top:10px;">
            <div style="font-size:12px; font-weight:800; color:${catColor};">${normalizeCat(p.category)}</div>
            <div style="font-size:22px; font-weight:800; margin-top:8px;">${p.name}</div>
            
            <div style="margin-top:16px;">
                ${p.business_hours ? `<div style="font-size:13px; margin-bottom:8px;"><strong>🕒 시간:</strong> ${escapeHtml(p.business_hours)}</div>` : ''}
                ${p.comment ? `<div style="margin-top:16px; font-size:14px; line-height:1.5; background:#f1f3f5; padding:16px; border-radius:12px;">${escapeHtml(p.comment)}</div>` : ''}
            </div>
        </div>
    `;
    
    // 처음에 정보창을 열 때 모바일은 절반(half)만 열리게 설정
    setSheetState('half');
}

function openAddModal() { document.getElementById('add-modal').style.display = 'flex'; }

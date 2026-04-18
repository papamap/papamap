const SUPABASE_URL="YOUR_URL";const SUPABASE_KEY="YOUR_KEY";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var map; var placesData=[]; var isPopupShown=false;

function initMap(){
    map=new naver.maps.Map('map',{center:new naver.maps.LatLng(37.5665,126.9780),zoom:14});
    loadPlaces(); checkMainPopup(); checkWeatherReco();
}

function checkWeatherReco(){
    const reco = document.getElementById('weather-reco');
    const todayWeather = "비"; 
    if(todayWeather === "비") reco.innerText = "오늘은 비가 오니 실내를 살펴보는 게 어떨까요? ☔";
    else reco.innerText = "날씨가 맑네요! 야외 나들이를 추천해요 ☀️";
}

async function checkMainPopup(){
    const hideUntil = localStorage.getItem('hidePopupDate');
    if(hideUntil && new Date().getTime() < parseInt(hideUntil)) return;

    const {data} = await supabaseClient.from('notices').select('*').eq('is_popup',true);
    if(data && data.length > 0){
        const validPopup = data.find(n => {
            const endDate = new Date(n.popup_end_date);
            endDate.setHours(23, 59, 59, 999);
            return endDate >= new Date();
        });
        if(validPopup && validPopup.image_url){
            const slider = document.getElementById('popup-images');
            slider.innerHTML = JSON.parse(validPopup.image_url).map(url => `<img src="${url}">`).join('');
            document.getElementById('main-popup').style.display='flex';
        }
    }
}

function closeMainPopup(){
    if(document.getElementById('hide-today-chk').checked){
        const now = new Date();
        const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
        localStorage.setItem('hidePopupDate', midnight);
    }
    document.getElementById('main-popup').style.display='none';
}

function getMarkerHTML(place, isZoomedOut) {
    let emoji = '🏢'; 
    if (place.category === '야외') emoji = '🌳'; 
    else if (place.category === '문센') emoji = '🎨';
    return `<div class="custom-marker"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div></div>`;
}

function renderPanel(placeId) {
    const panel = document.getElementById('info-panel');
    panel.classList.add('show');
    panel.classList.remove('mid', 'min');
    document.getElementById('top5-overlay').style.opacity = '0';
    document.getElementById('top5-overlay').style.pointerEvents = 'none';
}

function closePanel() {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('show', 'mid', 'min');
    document.getElementById('top5-overlay').style.opacity = '1';
    document.getElementById('top5-overlay').style.pointerEvents = 'auto';
}

async function requestPlaceEdit(placeId, content) {
    await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${placeId}] ${content}` }]);
    alert("수정 요청이 접수되었습니다. 관리자 확인 후 반영되며, 기존 정보는 정상적으로 서비스됩니다.");
}

// 모바일 바텀시트 스와이프 로직
document.addEventListener('DOMContentLoaded', () => {
    const panel = document.getElementById('info-panel');
    let startY = 0;
    let currentY = 0;
    let currentState = 'show'; // show(33%), mid(80%), min(15%)

    panel.addEventListener('touchstart', (e) => {
        if(window.innerWidth > 768) return;
        startY = e.touches[0].clientY;
        panel.style.transition = 'none';
    }, {passive: true});

    panel.addEventListener('touchend', (e) => {
        if(window.innerWidth > 768) return;
        panel.style.transition = 'transform 0.3s ease';
        const deltaY = e.changedTouches[0].clientY - startY;
        
        if (deltaY < -50) {
            // 위로 스와이프
            if (panel.classList.contains('min')) { panel.className = 'info-panel show'; }
            else if (panel.classList.contains('show')) { panel.className = 'info-panel mid'; }
        } else if (deltaY > 50) {
            // 아래로 스와이프
            if (panel.classList.contains('mid')) { panel.className = 'info-panel show'; }
            else if (panel.classList.contains('show')) { panel.className = 'info-panel min'; }
            else if (panel.classList.contains('min')) { closePanel(); }
        } else {
            // 스와이프 거리가 짧으면 원래 상태 복귀
            const currentClasses = panel.className;
            panel.className = currentClasses; 
        }
    });
});

window.onload=initMap;

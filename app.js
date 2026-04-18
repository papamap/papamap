const SUPABASE_URL="YOUR_URL";const SUPABASE_KEY="YOUR_KEY";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var map; var placesData=[]; var isPopupShown=false;

function initMap(){
    map=new naver.maps.Map('map',{center:new naver.maps.LatLng(37.5665,126.9780),zoom:14});
    loadPlaces(); checkMainPopup(); checkWeatherReco(); initPhotoGridTouch();
}

function checkWeatherReco(){
    const reco = document.getElementById('weather-reco');
    if(!reco) return;
    const todayWeather = "비"; 
    if(todayWeather === "비") reco.innerText = "오늘은 비가 오니 실내를 살펴보는 게 어떨까요? ☔";
    else reco.innerText = "날씨가 맑네요! 야외 나들이를 추천해요 ☀️";
}

async function checkMainPopup(){
    if(localStorage.getItem('hidePopupDate') === new Date().toDateString()) return;
    const {data} = await supabaseClient.from('notices').select('*').eq('is_popup',true);
    if(data && data.length > 0){
        const validPopup = data.find(n => new Date(n.popup_end_date) >= new Date());
        if(validPopup && validPopup.image_url){
            const slider = document.getElementById('popup-images');
            slider.innerHTML = JSON.parse(validPopup.image_url).map(url => `<img src="${url}">`).join('');
            document.getElementById('main-popup').style.display='flex';
        }
    }
}

function closeMainPopup(){
    if(document.getElementById('hide-today-chk').checked){
        localStorage.setItem('hidePopupDate', new Date().toDateString());
    }
    document.getElementById('main-popup').style.display='none';
}

function getMarkerHTML(place, isZoomedOut) {
    let emoji = '🏢'; 
    if (place.category === '야외') emoji = '🌳'; 
    else if (place.category === '문센') emoji = '🎨';
    return `<div class="custom-marker"><div class="marker-pin"><div class="marker-icon">${emoji}</div></div></div>`;
}

// Bottom Sheet Logic for Mobile
let sheetState = 0; // 0: closed, 1: 1/3 (33%), 2: 80%, 3: 15%
let startY = 0;
let currentY = 0;

function renderPanel(placeId) {
    const panel = document.getElementById('info-panel');
    panel.classList.add('show');
    if (window.innerWidth <= 768) {
        setSheetState(1); 
    } else {
        panel.style.transform = 'translateX(0)';
    }
    document.getElementById('top5-overlay').style.opacity = '0';
    document.getElementById('top5-overlay').style.pointerEvents = 'none';
}

function closePanel() {
    const panel = document.getElementById('info-panel');
    panel.classList.remove('show');
    if (window.innerWidth <= 768) {
        panel.style.transform = 'translateY(100%)';
        sheetState = 0;
    } else {
        panel.style.transform = 'translateX(-20px)';
    }
    document.getElementById('top5-overlay').style.opacity = '1';
    document.getElementById('top5-overlay').style.pointerEvents = 'auto';
}

const infoPanel = document.getElementById('info-panel');
if(infoPanel) {
    infoPanel.addEventListener('touchstart', e => { startY = e.touches[0].clientY; });
    infoPanel.addEventListener('touchmove', e => { currentY = e.touches[0].clientY; });
    infoPanel.addEventListener('touchend', e => {
        if (window.innerWidth > 768) return;
        let diff = startY - currentY; 
        if (diff > 50) { // Swipe Up
            if (sheetState === 3) setSheetState(1);
            else if (sheetState === 1) setSheetState(2);
        } else if (diff < -50) { // Swipe Down
            if (sheetState === 2) setSheetState(1);
            else if (sheetState === 1) setSheetState(3);
            else if (sheetState === 3) closePanel();
        }
    });
}

function setSheetState(state) {
    const panel = document.getElementById('info-panel');
    sheetState = state;
    if (state === 1) panel.style.transform = 'translateY(66vh)'; // 34% exposed
    else if (state === 2) panel.style.transform = 'translateY(20vh)'; // 80% exposed
    else if (state === 3) panel.style.transform = 'translateY(85vh)'; // 15% exposed
}

function initPhotoGridTouch() {
    let draggedItem = null;
    document.querySelectorAll('.photo-item').forEach(item => {
        item.addEventListener('touchstart', (e) => { 
            draggedItem = item; 
            item.style.opacity = '0.6'; 
        });
        item.addEventListener('touchmove', (e) => {
            e.preventDefault();
            let touch = e.touches[0];
            let target = document.elementFromPoint(touch.clientX, touch.clientY);
            if (!target) return;
            let targetItem = target.closest('.photo-item');
            if (targetItem && targetItem !== draggedItem) {
                let items = Array.from(targetItem.parentNode.children);
                if (items.indexOf(draggedItem) < items.indexOf(targetItem)) {
                    targetItem.after(draggedItem);
                } else {
                    targetItem.before(draggedItem);
                }
            }
        }, {passive: false});
        item.addEventListener('touchend', (e) => { 
            if(draggedItem) draggedItem.style.opacity = '1'; 
            draggedItem = null; 
        });
    });
}

async function requestPlaceEdit(placeId, content) {
    await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${placeId}] ${content}` }]);
    alert("수정 요청이 접수되었습니다. 관리자 확인 후 반영되며, 기존 정보는 정상적으로 서비스됩니다.");
}

async function loadPlaces() {
    // Dummy function for map loading
}

window.onload=initMap;

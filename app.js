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

function renderPanel(placeId) {
    document.getElementById('info-panel').classList.add('show');
    document.getElementById('top5-overlay').style.opacity = '0';
    document.getElementById('top5-overlay').style.pointerEvents = 'none';
}

function closePanel() {
    document.getElementById('info-panel').classList.remove('show');
    document.getElementById('top5-overlay').style.opacity = '1';
    document.getElementById('top5-overlay').style.pointerEvents = 'auto';
}

async function requestPlaceEdit(placeId, content) {
    await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${placeId}] ${content}` }]);
    alert("수정 요청이 접수되었습니다. 관리자 확인 후 반영되며, 기존 정보는 정상적으로 서비스됩니다.");
}
window.onload=initMap;
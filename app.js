const SUPABASE_URL="YOUR_URL";const SUPABASE_KEY="YOUR_KEY";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
var map; var placesData=[]; var isPopupShown=false;
let bottomSheetState = 67; // 모바일 바텀시트 상태 (100:닫힘, 85:15%노출, 67:33%노출, 20:80%노출)

function initMap(){
    map=new naver.maps.Map('map',{center:new naver.maps.LatLng(37.5665,126.9780),zoom:14});
    loadPlaces(); checkMainPopup(); checkWeatherReco(); initBottomSheet(); initPhotoGrid();
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
        // 팝업 설정 기능 완벽 연동: 자정까지 노출되도록 날짜 체크 (오늘 날짜와 비교)
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
    const panel = document.getElementById('info-panel');
    panel.classList.add('show');
    if(window.innerWidth <= 768) {
        bottomSheetState = 67; // 클릭 시 1/3(33%) 노출
        panel.style.transform = `translateY(${bottomSheetState}%)`;
    }
    document.getElementById('top5-overlay').style.opacity = '0';
    document.getElementById('top5-overlay').style.pointerEvents = 'none';
}

function closePanel() {
    const panel = document.getElementById('info-panel');
    if(window.innerWidth <= 768) {
        bottomSheetState = 100;
        panel.style.transform = `translateY(100%)`;
        setTimeout(() => panel.classList.remove('show'), 300);
    } else {
        panel.classList.remove('show');
    }
    document.getElementById('top5-overlay').style.opacity = '1';
    document.getElementById('top5-overlay').style.pointerEvents = 'auto';
}

// 1. 모바일 바텀시트 스와이프 로직
function initBottomSheet() {
    const panel = document.getElementById('info-panel');
    let startY = 0;
    
    panel.addEventListener('touchstart', (e) => {
        if(window.innerWidth > 768) return;
        startY = e.touches[0].clientY;
        panel.style.transition = 'none'; // 드래그 중엔 애니메이션 제거
    }, {passive: true});

    panel.addEventListener('touchmove', (e) => {
        if(window.innerWidth > 768) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - startY;
        let newTranslateY = bottomSheetState + (deltaY / window.innerHeight) * 100;
        if(newTranslateY < 20) newTranslateY = 20; // 최대 80%까지만 올라가게
        panel.style.transform = `translateY(${newTranslateY}%)`;
    }, {passive: true});

    panel.addEventListener('touchend', (e) => {
        if(window.innerWidth > 768) return;
        panel.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
        const endY = e.changedTouches[0].clientY;
        const deltaY = endY - startY;

        if (deltaY < -40) { // 위로 스와이프
            if(bottomSheetState === 85) bottomSheetState = 67;
            else if(bottomSheetState === 67) bottomSheetState = 20;
        } else if (deltaY > 40) { // 아래로 스와이프
            if(bottomSheetState === 20) bottomSheetState = 67;
            else if(bottomSheetState === 67) bottomSheetState = 85;
            else if(bottomSheetState === 85) { closePanel(); return; }
        }
        panel.style.transform = `translateY(${bottomSheetState}%)`;
    });
}

// 2. 10장 사진 그리드 및 터치 D&D 로직
function initPhotoGrid() {
    const grid = document.getElementById('photo-grid');
    if(!grid) return;
    // 10장 빈 슬롯 렌더링 (실제론 이미지 데이터 반영)
    for(let i=0; i<10; i++){
        const item = document.createElement('div');
        item.className = 'photo-item';
        item.innerHTML = `<span>+</span>`;
        grid.appendChild(item);
    }

    let draggedItem = null;
    let longPressTimer;

    grid.addEventListener('touchstart', (e) => {
        const item = e.target.closest('.photo-item');
        if(!item) return;
        longPressTimer = setTimeout(() => {
            draggedItem = item;
            item.classList.add('dragging');
            navigator.vibrate && navigator.vibrate(50); // 햅틱 피드백
        }, 300); // 300ms 롱터치 시 드래그 시작
    }, {passive: false});

    grid.addEventListener('touchmove', (e) => {
        if(!draggedItem) {
            clearTimeout(longPressTimer);
            return;
        }
        e.preventDefault(); // 스크롤 방지
        const touch = e.touches[0];
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const overItem = element ? element.closest('.photo-item') : null;
        
        if(overItem && overItem !== draggedItem) {
            const gridRect = grid.getBoundingClientRect();
            const overRect = overItem.getBoundingClientRect();
            // 위치 기반 요소 삽입 (간단한 swap/insert 로직)
            if(touch.clientY < overRect.top + overRect.height / 2) {
                grid.insertBefore(draggedItem, overItem);
            } else {
                grid.insertBefore(draggedItem, overItem.nextSibling);
            }
        }
    }, {passive: false});

    grid.addEventListener('touchend', (e) => {
        clearTimeout(longPressTimer);
        if(draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });
}

// 게시판 최신글/공지 우선 정렬 (게시판 불러오기 예시용 함수)
async function fetchBoardPosts() {
    // 4. 공지사항 우선(is_notice), 그 다음 최신글(created_at) 순으로 정렬
    const { data, error } = await supabaseClient
        .from('board')
        .select('*')
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });
    return data;
}

async function requestPlaceEdit(placeId, content) {
    await supabaseClient.from('inquiries').insert([{ content: `[장소수정요청 ID:${placeId}] ${content}` }]);
    alert("수정 요청이 접수되었습니다. 관리자 확인 후 반영되며, 기존 정보는 정상적으로 서비스됩니다.");
}
async function loadPlaces() {} // 더미
window.onload=initMap;

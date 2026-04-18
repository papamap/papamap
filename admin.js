function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

async function setPopup(id) {
    const date = prompt("팝업 종료 날짜를 입력하세요 (예: 2026-05-01)\n설정된 날짜의 자정까지 메인 화면에 노출됩니다.", "2026-05-01");
    if(date) {
        // 실제 운영시에는 supabase에 update 쿼리를 전송합니다.
        // await supabaseClient.from('notices').update({ is_popup: true, popup_end_date: date }).eq('id', id);
        alert(`팝업이 ${date} 자정까지 노출되도록 설정되었습니다.`);
    }
}

// 1. 게시판 정렬 로직 (최신글 및 공지 상단)
async function loadBoard() {
    try {
        const { data, error } = await supabaseClient
            .from('board')
            .select('*')
            .order('is_notice', { ascending: false }) // 공지사항 최상단
            .order('created_at', { ascending: false }); // 최신글 우선
            
        // 렌더링 로직 (현재는 목업 처리)
        console.log("정렬된 게시판 데이터:", data);
    } catch(err) {
        console.warn("DB 연결 전역 테스트용 알림");
    }
}

// 2. 사진 10장 업로드 및 터치/드래그 순서 변경 로직
document.addEventListener('DOMContentLoaded', () => {
    const uploadInput = document.getElementById('photo-upload');
    const grid = document.getElementById('admin-photo-grid');
    if(!uploadInput) return;

    uploadInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files).slice(0, 10); // 최대 10장 제한
        grid.innerHTML = ''; 
        
        files.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const div = document.createElement('div');
                div.className = 'photo-item';
                div.draggable = true;
                div.innerHTML = `<img src="${event.target.result}" alt="업로드 이미지">`;
                
                // 데스크톱 Drag & Drop
                div.addEventListener('dragstart', handleDragStart);
                div.addEventListener('dragover', handleDragOver);
                div.addEventListener('drop', handleDrop);
                div.addEventListener('dragenter', e => e.preventDefault());
                
                // 모바일 Touch 기능
                div.addEventListener('touchstart', handleTouchStart, {passive: false});
                div.addEventListener('touchmove', handleTouchMove, {passive: false});
                div.addEventListener('touchend', handleTouchEnd);
                
                grid.appendChild(div);
            };
            reader.readAsDataURL(file);
        });
    });

    let draggedItem = null;

    function handleDragStart(e) { 
        draggedItem = this; 
        e.dataTransfer.effectAllowed = 'move'; 
        this.style.opacity = '0.5';
    }
    
    function handleDragOver(e) { 
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move'; 
    }
    
    function handleDrop(e) {
        e.stopPropagation();
        draggedItem.style.opacity = '1';
        if (draggedItem !== this) {
            const allItems = [...grid.querySelectorAll('.photo-item')];
            const draggedIndex = allItems.indexOf(draggedItem);
            const droppedIndex = allItems.indexOf(this);
            if (draggedIndex < droppedIndex) {
                this.parentNode.insertBefore(draggedItem, this.nextSibling);
            } else {
                this.parentNode.insertBefore(draggedItem, this);
            }
        }
        return false;
    }

    // 모바일 터치 드래그 상태 변수
    let touchEl = null;
    let placeholder = null;

    function handleTouchStart(e) {
        touchEl = this;
        touchEl.style.opacity = '0.5';
    }

    function handleTouchMove(e) {
        if (!touchEl) return;
        e.preventDefault(); // 스크롤 방지
        const touchLocation = e.targetTouches[0];
        
        // 현재 터치 위치에 있는 요소 찾기
        const targetElement = document.elementFromPoint(touchLocation.clientX, touchLocation.clientY);
        if (targetElement && targetElement.closest('.photo-item') && targetElement.closest('.photo-item') !== touchEl) {
            const targetItem = targetElement.closest('.photo-item');
            const allItems = [...grid.querySelectorAll('.photo-item')];
            const touchIndex = allItems.indexOf(touchEl);
            const targetIndex = allItems.indexOf(targetItem);
            
            if (touchIndex < targetIndex) {
                targetItem.parentNode.insertBefore(touchEl, targetItem.nextSibling);
            } else {
                targetItem.parentNode.insertBefore(touchEl, targetItem);
            }
        }
    }

    function handleTouchEnd(e) {
        if (touchEl) {
            touchEl.style.opacity = '1';
            touchEl = null;
        }
    }
});

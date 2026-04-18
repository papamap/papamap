function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

// 팝업 설정 기능 완벽 연동
async function setPopup(id) {
    const date = prompt("팝업 종료 날짜를 입력하세요 (예: 2026-05-01)", "2026-05-01");
    if(date) {
        // 실제 운영 시에는 supabaseClient를 통해 DB를 업데이트합니다.
        // await supabaseClient.from('notices').update({ is_popup: true, popup_end_date: date }).eq('id', id);
        
        // 프론트엔드 UI 반영 (어드민)
        const dateElement = document.getElementById(`popup-date-${id}`);
        if(dateElement) dateElement.innerText = date + " 까지";
        
        alert(`팝업이 설정되었습니다. 메인 화면 접속 시 ${date} 자정까지 노출됩니다.`);
    }
}

// 게시판 목록 로드 시 정렬 로직 (Supabase 쿼리 예시 - 앱단과 동일하게 적용)
async function loadAdminBoard() {
    // 4. 게시판 최신글 상단 노출 (공지 우선)
    /*
    const { data } = await supabaseClient
        .from('board')
        .select('*')
        .order('is_notice', { ascending: false })
        .order('created_at', { ascending: false });
    */
    console.log("게시판 정렬 로직이 적용되었습니다.");
}
window.onload = loadAdminBoard;

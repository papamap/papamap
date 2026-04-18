function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}
async function setPopup(id) {
    const date = prompt("팝업 종료 날짜를 입력하세요 (예: 2026-05-01)", "2026-05-01");
    if(date) {
        alert("팝업이 설정되었습니다. 메인 화면 접속 시 노출됩니다.");
    }
}
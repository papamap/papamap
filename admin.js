const SUPABASE_URL="YOUR_URL";const SUPABASE_KEY="YOUR_KEY";
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY);

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

async function setPopup(id) {
    const date = prompt("팝업 종료 날짜를 입력하세요 (예: 2026-05-01)", "2026-05-01");
    if(date && supabaseClient) {
        await supabaseClient.from('notices').update({ is_popup: true, popup_end_date: date }).eq('id', id);
        alert("팝업이 설정되었습니다. 메인 화면 접속 시 노출됩니다.");
        loadBoardList();
    }
}

// 4. 게시판 정렬 기능: 공지가 최우선, 그 다음 최신글 순
async function loadBoardList() {
    if(!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('board')
        .select('*')
        .order('is_notice', { ascending: false }) // 공지사항 최상단
        .order('created_at', { ascending: false }); // 최신글 순서

    if(data) {
        const tbody = document.getElementById('board-tbody');
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.id}</td>
                <td>${row.is_notice ? '📢 공지' : '일반'}</td>
                <td>${row.title}</td>
                <td>${new Date(row.created_at).toLocaleDateString()}</td>
                <td>${row.popup_end_date || '-'}</td>
                <td><button onclick="setPopup(${row.id})">팝업설정</button></td>
            </tr>
        `).join('');
    }
}

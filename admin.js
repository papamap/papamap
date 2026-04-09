const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 보안을 위한 초간단 비밀번호 설정 (기존 앱의 ADMIN_PW와 동일하게 설정)
const ADMIN_PW = "admin1234";
let adminPlaces = [];

// 페이지 진입 시 비밀번호 확인
window.onload = function() {
    const pw = prompt("관리자 비밀번호를 입력하세요:");
    if(pw === ADMIN_PW) {
        loadAdminPlaces();
    } else {
        alert("비밀번호가 틀렸습니다.");
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:100px; color:#adb5bd;'>접근 권한이 없습니다.</h2>";
    }
};

// Supabase에서 모든 장소 데이터 불러오기 (최신 등록순)
async function loadAdminPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (!error && data) {
        adminPlaces = data;
        renderAdminTable();
    } else {
        alert("데이터를 불러오는 중 오류가 발생했습니다.\n" + error.message);
    }
}

// 화면에 엑셀 형태의 테이블 그리기
function renderAdminTable() {
    const tbody = document.getElementById('admin-tbody');
    const searchWord = document.getElementById('admin-search').value.trim().toLowerCase();
    const filterCat = document.getElementById('admin-category').value;

    // 필터링 적용
    let filtered = adminPlaces.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchWord);
        // 야외가 포함되면 야외, 아니면 실내로 간주 (프론트엔드 정규화 로직 적용)
        const pCat = (p.category && p.category.includes('야외')) ? '야외' : '실내';
        const matchCat = (filterCat === "") || (pCat === filterCat);
        return matchName && matchCat;
    });

    document.getElementById('total-count').innerText = `총 ${filtered.length}개 검색됨`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 40px; color:#adb5bd;">조건에 맞는 장소가 없습니다.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const nCat = (p.category && p.category.includes('야외')) ? '야외' : '실내';
        const catClass = nCat === '야외' ? 'cat-outdoor' : 'cat-indoor';
        
        return `
        <tr>
            <td style="color:#adb5bd; font-weight:700;">#${p.id}</td>
            <td>
                <select id="cat-${p.id}" class="cat-chip ${catClass}" onchange="this.className='cat-chip ' + (this.value==='야외'?'cat-outdoor':'cat-indoor')">
                    <option value="실내" ${nCat === '실내' ? 'selected' : ''}>실내</option>
                    <option value="야외" ${nCat === '야외' ? 'selected' : ''}>야외</option>
                </select>
            </td>
            <td><input type="text" id="name-${p.id}" value="${escapeQuote(p.name)}" placeholder="장소명"></td>
            <td><input type="text" id="park-${p.id}" value="${escapeQuote(p.parking_fee || '')}" placeholder="무료, 1시간 2천원 등"></td>
            <td><input type="text" id="entry-${p.id}" value="${escapeQuote(p.entry_fee || '')}" placeholder="없음, 성인 5천원 등"></td>
            <td><input type="text" id="nurse-${p.id}" value="${escapeQuote(p.nursing_room || '')}" placeholder="없음, 1층 화장실 옆 등"></td>
            <td><button class="btn btn-save" onclick="quickSave(${p.id}, this)">저장</button></td>
            <td><button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button></td>
        </tr>
    `}).join('');
}

// 엑셀처럼 입력 후 [저장] 버튼 누르면 즉시 DB 업데이트
async function quickSave(id, btnElement) {
    const newCat = document.getElementById(`cat-${id}`).value;
    const newName = document.getElementById(`name-${id}`).value.trim();
    const newPark = document.getElementById(`park-${id}`).value.trim();
    const newEntry = document.getElementById(`entry-${id}`).value.trim();
    const newNurse = document.getElementById(`nurse-${id}`).value.trim();

    if(!newName) return alert("장소명은 비워둘 수 없습니다.");

    // 버튼 상태를 로딩중으로 변경
    const originalText = btnElement.innerText;
    btnElement.innerText = "저장중..";
    btnElement.disabled = true;

    const { error } = await supabaseClient.from('places').update({
        category: newCat,
        name: newName,
        parking_fee: newPark,
        entry_fee: newEntry,
        nursing_room: newNurse
    }).eq('id', id);

    if(!error) {
        // 로컬 배열에도 반영
        const p = adminPlaces.find(x => x.id === id);
        p.category = newCat; p.name = newName; p.parking_fee = newPark; p.entry_fee = newEntry; p.nursing_room = newNurse;
        
        btnElement.innerText = "✔ 완료";
        btnElement.style.background = "#20c997";
        setTimeout(() => {
            btnElement.innerText = originalText;
            btnElement.style.background = "#5c7cfa";
            btnElement.disabled = false;
        }, 1500);
    } else {
        alert("수정 에러: " + error.message);
        btnElement.innerText = originalText;
        btnElement.disabled = false;
    }
}

// 삭제 기능
async function deletePlace(id) {
    if(!confirm("정말 이 장소를 삭제하시겠습니까?\n(삭제 시 관련된 사진과 댓글 정보도 모두 사라집니다)")) return;
    
    const { error } = await supabaseClient.from('places').delete().eq('id', id);
    if(!error) {
        adminPlaces = adminPlaces.filter(p => p.id !== id);
        renderAdminTable(); // 화면 갱신
    } else {
        alert("삭제 에러: " + error.message);
    }
}

// input value 렌더링 시 따옴표 깨짐 방지용 헬퍼 함수
function escapeQuote(str) {
    return str.replace(/"/g, '&quot;');
}
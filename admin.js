const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_PW = "admin1234";
let adminPlaces = [];
let adminInquiries = [];

window.onload = function() {
    const pw = prompt("관리자 비밀번호를 입력하세요:");
    if(pw === ADMIN_PW) {
        loadAdminPlaces();
    } else {
        alert("비밀번호가 틀렸습니다.");
        document.body.innerHTML = "<h2 style='text-align:center; margin-top:100px; color:#adb5bd;'>접근 권한이 없습니다.</h2>";
    }
};

// --- 탭 전환 로직 ---
function switchTab(tab) {
    document.getElementById('btn-tab-places').classList.remove('active');
    document.getElementById('btn-tab-inquiries').classList.remove('active');
    document.getElementById('section-places').classList.remove('active');
    document.getElementById('section-inquiries').classList.remove('active');

    document.getElementById(`btn-tab-${tab}`).classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');

    if (tab === 'inquiries') {
        loadInquiries();
    }
}

// --- 장소 관리 로직 ---
async function loadAdminPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (!error && data) {
        adminPlaces = data;
        renderAdminTable();
    } else {
        alert("데이터를 불러오는 중 오류가 발생했습니다.\n" + error.message);
    }
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-tbody');
    const searchWord = document.getElementById('admin-search').value.trim().toLowerCase();
    const filterCat = document.getElementById('admin-category').value;

    let filtered = adminPlaces.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchWord);
        const pCat = (p.category && p.category.includes('야외')) ? '야외' : '실내';
        const matchCat = (filterCat === "") || (pCat === filterCat);
        return matchName && matchCat;
    });

    document.getElementById('total-count').innerText = `총 ${filtered.length}개 검색됨`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color:#adb5bd;">조건에 맞는 장소가 없습니다.</td></tr>`;
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
            <td><input type="text" id="park-${p.id}" value="${escapeQuote(p.parking_fee || '')}" placeholder="무료 등"></td>
            <td><input type="text" id="entry-${p.id}" value="${escapeQuote(p.entry_fee || '')}" placeholder="없음 등"></td>
            <td><input type="text" id="nurse-${p.id}" value="${escapeQuote(p.nursing_room || '')}" placeholder="수유실 정보"></td>
            <td><input type="text" id="desc-${p.id}" value="${escapeQuote(p.comment || '')}" placeholder="상세 설명 (링크 포함 가능)"></td>
            <td><button class="btn btn-save" onclick="quickSave(${p.id}, this)">저장</button></td>
            <td><button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button></td>
        </tr>
    `}).join('');
}

async function quickSave(id, btnElement) {
    const newCat = document.getElementById(`cat-${id}`).value;
    const newName = document.getElementById(`name-${id}`).value.trim();
    const newPark = document.getElementById(`park-${id}`).value.trim();
    const newEntry = document.getElementById(`entry-${id}`).value.trim();
    const newNurse = document.getElementById(`nurse-${id}`).value.trim();
    const newDesc = document.getElementById(`desc-${id}`).value.trim();

    if(!newName) return alert("장소명은 비워둘 수 없습니다.");

    const originalText = btnElement.innerText;
    btnElement.innerText = "저장중..";
    btnElement.disabled = true;

    const { error } = await supabaseClient.from('places').update({
        category: newCat,
        name: newName,
        parking_fee: newPark,
        entry_fee: newEntry,
        nursing_room: newNurse,
        comment: newDesc
    }).eq('id', id);

    if(!error) {
        const p = adminPlaces.find(x => x.id === id);
        p.category = newCat; p.name = newName; p.parking_fee = newPark; p.entry_fee = newEntry; p.nursing_room = newNurse; p.comment = newDesc;
        
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

async function deletePlace(id) {
    if(!confirm("정말 이 장소를 삭제하시겠습니까?\n(삭제 시 관련된 사진과 댓글 정보도 모두 사라집니다)")) return;
    
    const { error } = await supabaseClient.from('places').delete().eq('id', id);
    if(!error) {
        adminPlaces = adminPlaces.filter(p => p.id !== id);
        renderAdminTable();
    } else {
        alert("삭제 에러: " + error.message);
    }
}

// --- 문의사항 관리 로직 ---
async function loadInquiries() {
    const tbody = document.getElementById('inquiries-tbody');
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color:#adb5bd;">문의사항을 불러오는 중...</td></tr>`;

    const { data, error } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
    
    if (!error && data) {
        adminInquiries = data;
        renderInquiriesTable();
    } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color:#FF6B6B;">오류가 발생했거나 아직 문의 테이블이 없습니다.</td></tr>`;
    }
}

function renderInquiriesTable() {
    const tbody = document.getElementById('inquiries-tbody');
    
    if (adminInquiries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color:#adb5bd;">아직 접수된 문의사항이 없습니다.</td></tr>`;
        return;
    }

    tbody.innerHTML = adminInquiries.map(i => {
        const dateStr = new Date(i.created_at).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
        });
        return `
        <tr>
            <td style="color:#adb5bd; font-weight:700;">#${i.id}</td>
            <td style="color:#868e96; font-size:12px;">${dateStr}</td>
            <td><div style="white-space: pre-wrap; line-height: 1.5; color:#343a40;">${escapeHtml(i.content)}</div></td>
            <td style="color:#5c7cfa; font-weight:600;">${escapeHtml(i.contact_info || '연락처 없음')}</td>
        </tr>
    `}).join('');
}

// --- 유틸리티 함수 ---
function escapeQuote(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
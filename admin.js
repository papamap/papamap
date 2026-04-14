const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// 인스타식 상대 시간 계산 함수
function timeAgo(dateInput) {
    const past = new Date(dateInput);
    const now = new Date();
    const seconds = Math.floor((now - past) / 1000);
    
    if (isNaN(seconds) || seconds < 0) return dateInput; 
    if (seconds < 60) return "방금 전";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}분 전`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}일 전`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}주 전`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}개월 전`;
    const years = Math.floor(days / 365);
    return `${years}년 전`;
}

const ADMIN_PW = "123qwe"; // 요청하신 관리자 비밀번호
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 10; 

let adminPlaces = [];
let adminInquiries = [];

window.onload = function() {
    checkSecurityAndLogin();
};

function checkSecurityAndLogin() {
    let attempts = parseInt(localStorage.getItem('adminAttempts') || '0');
    let lockoutTime = parseInt(localStorage.getItem('adminLockout') || '0');
    const now = Date.now();

    if (lockoutTime > now) {
        const remaining = Math.ceil((lockoutTime - now) / 60000);
        document.getElementById('login-screen').innerHTML = `<h2>보안 잠금 중</h2><p>${remaining}분 후에 다시 시도해주세요.</p>`;
        document.getElementById('login-screen').style.display = 'block';
        return;
    } else {
        localStorage.removeItem('adminLockout');
    }

    // 세션 체크 (간단히 localStorage로 유지)
    if (sessionStorage.getItem('adminAuthenticated') === 'true') {
        document.getElementById('admin-main').style.display = 'block';
        loadAdminPlaces();
    } else {
        document.getElementById('login-screen').style.display = 'block';
        // Enter키 지원
        document.getElementById('admin-pw-input').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') submitAdminLogin();
        });
    }
}

function submitAdminLogin() {
    const pwInput = document.getElementById('admin-pw-input');
    const pw = pwInput.value;
    let attempts = parseInt(localStorage.getItem('adminAttempts') || '0');
    const now = Date.now();

    if(pw === ADMIN_PW) {
        localStorage.setItem('adminAttempts', '0'); 
        sessionStorage.setItem('adminAuthenticated', 'true');
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('admin-main').style.display = 'block';
        loadAdminPlaces();
    } else {
        attempts += 1;
        localStorage.setItem('adminAttempts', attempts);
        if (attempts >= MAX_ATTEMPTS) {
            localStorage.setItem('adminLockout', now + (LOCKOUT_MINUTES * 60000));
            alert(`${MAX_ATTEMPTS}회 오류로 ${LOCKOUT_MINUTES}분간 접속이 차단됩니다.`);
            location.reload();
        } else {
            alert(`비밀번호가 틀렸습니다. (남은 기회: ${MAX_ATTEMPTS - attempts}번)`);
            pwInput.value = '';
            pwInput.focus();
        }
    }
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`btn-tab-${tab}`).classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');

    if (tab === 'inquiries') loadInquiries();
    if (tab === 'comments') loadAllComments();
}

async function loadAdminPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (!error && data) {
        adminPlaces = data;
        renderAdminTable();
    } else alert("데이터 로드 오류: " + error.message);
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-tbody');
    const searchWord = document.getElementById('admin-search').value.trim().toLowerCase();
    const filterCat = document.getElementById('admin-category').value;
    const filterApprove = document.getElementById('admin-approval').value;

    let filtered = adminPlaces.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchWord);
        const pCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const matchCat = (filterCat === "") || (pCat === filterCat);
        const matchApprove = (filterApprove === "") || (String(p.is_approved) === filterApprove);
        return matchName && matchCat && matchApprove;
    });

    document.getElementById('total-count').innerText = `총 ${filtered.length}개 검색됨`;
    document.getElementById('cb-all').checked = false;
    updateBulkBar();

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color:#adb5bd;">데이터가 없습니다. DB에 is_approved 컬럼이 있는지 확인하세요.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(p => {
        const nCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const catClass = nCat === '야외' ? 'cat-outdoor' : (nCat === '문센' ? 'cat-moonsen' : 'cat-indoor');
        const approvedBadge = p.is_approved ? `<span style="color:#20c997; font-weight:800;">✅ 표시됨</span>` : `<span style="color:#FF6B6B; font-weight:800;">❗ 미승인</span>`;

        return `
        <tr>
            <td style="text-align: center;"><input type="checkbox" class="cb-item" value="${p.id}" onchange="updateBulkBar()"></td>
            <td style="font-size:11px;">${approvedBadge}<br><span style="color:#adb5bd;">#${p.id}</span></td>
            <td>
                <select id="cat-${p.id}" class="cat-chip ${catClass}" onchange="this.className='cat-chip ' + (this.value==='야외'?'cat-outdoor':(this.value==='문센'?'cat-moonsen':'cat-indoor'))">
                    <option value="실내" ${nCat === '실내' ? 'selected' : ''}>실내</option>
                    <option value="야외" ${nCat === '야외' ? 'selected' : ''}>야외</option>
                    <option value="문센" ${nCat === '문센' ? 'selected' : ''}>문센</option>
                </select>
            </td>
            <td><input type="text" id="name-${p.id}" value="${escapeQuote(p.name)}" placeholder="장소명"></td>
            <td><input type="text" id="park-${p.id}" value="${escapeQuote(p.parking_fee || '')}" placeholder="무료 등"></td>
            <td><input type="text" id="entry-${p.id}" value="${escapeQuote(p.entry_fee || '')}" placeholder="없음 등"></td>
            <td><input type="text" id="nurse-${p.id}" value="${escapeQuote(p.nursing_room || '')}" placeholder="수유실 정보"></td>
            <td><input type="text" id="desc-${p.id}" value="${escapeQuote(p.comment || '')}" placeholder="상세 설명"></td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <button class="btn btn-save" onclick="quickSave(${p.id}, this)">저장</button>
                    ${!p.is_approved ? `<button class="btn btn-approve" onclick="approvePlace(${p.id})">승인</button>` : ''}
                    <button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button>
                </div>
            </td>
        </tr>
    `}).join('');
}

document.getElementById('admin-tbody').addEventListener('keydown', function(e) {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const target = e.target; if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
    
    const td = target.closest('td'); const tr = target.closest('tr'); const tbody = target.closest('tbody');
    const cellIndex = Array.from(tr.children).indexOf(td); const rowIndex = Array.from(tbody.children).indexOf(tr);
    let nextInput = null;
    
    if (e.key === 'ArrowUp') { e.preventDefault(); const nextTr = tbody.children[rowIndex - 1]; if (nextTr) nextInput = nextTr.children[cellIndex].querySelector('input, select'); } 
    else if (e.key === 'ArrowDown') { e.preventDefault(); const nextTr = tbody.children[rowIndex + 1]; if (nextTr) nextInput = nextTr.children[cellIndex].querySelector('input, select'); } 
    else if (e.key === 'ArrowLeft') { if (target.tagName === 'INPUT' && target.selectionStart > 0) return; e.preventDefault(); const nextTd = tr.children[cellIndex - 1]; if (nextTd) nextInput = nextTd.querySelector('input, select'); } 
    else if (e.key === 'ArrowRight') { if (target.tagName === 'INPUT' && target.selectionEnd < target.value.length) return; e.preventDefault(); const nextTd = tr.children[cellIndex + 1]; if (nextTd) nextInput = nextTd.querySelector('input, select'); }
    
    if (nextInput) nextInput.focus();
});

function toggleAll(source) {
    document.querySelectorAll('.cb-item').forEach(cb => cb.checked = source.checked);
    updateBulkBar();
}

function updateBulkBar() {
    const checked = document.querySelectorAll('.cb-item:checked');
    const bar = document.getElementById('bulk-bar');
    document.getElementById('sel-count').innerText = checked.length;
    bar.style.display = checked.length > 0 ? 'flex' : 'none';
}

async function bulkAction(actionType) {
    const checked = document.querySelectorAll('.cb-item:checked');
    if (checked.length === 0) return;
    const ids = Array.from(checked).map(cb => parseInt(cb.value));

    if (actionType === 'category') {
        const newCat = document.getElementById('bulk-category').value;
        if (!confirm(`선택한 ${ids.length}개 장소를 '${newCat}'(으)로 일괄 변경하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').update({ category: newCat }).in('id', ids);
        if (!error) { adminPlaces.forEach(p => { if (ids.includes(p.id)) p.category = newCat; }); renderAdminTable(); }
    } 
    else if (actionType === 'approve') {
        if (!confirm(`선택한 ${ids.length}개 장소를 지도에 노출(승인)하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').update({ is_approved: true }).in('id', ids);
        if (!error) { adminPlaces.forEach(p => { if (ids.includes(p.id)) p.is_approved = true; }); renderAdminTable(); }
    }
    else if (actionType === 'delete') {
        if (!confirm(`경고: 선택한 ${ids.length}개 장소를 영구 삭제하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').delete().in('id', ids);
        if (!error) { adminPlaces = adminPlaces.filter(p => !ids.includes(p.id)); renderAdminTable(); }
    }
}

async function quickSave(id, btnElement) {
    const newCat = document.getElementById(`cat-${id}`).value; const newName = document.getElementById(`name-${id}`).value.trim();
    const newPark = document.getElementById(`park-${id}`).value.trim(); const newEntry = document.getElementById(`entry-${id}`).value.trim();
    const newNurse = document.getElementById(`nurse-${id}`).value.trim(); const newDesc = document.getElementById(`desc-${id}`).value.trim();
    if(!newName) return alert("장소명은 필수입니다.");

    const originalText = btnElement.innerText; btnElement.innerText = "저장중.."; btnElement.disabled = true;
    const { error } = await supabaseClient.from('places').update({ category: newCat, name: newName, parking_fee: newPark, entry_fee: newEntry, nursing_room: newNurse, comment: newDesc }).eq('id', id);

    if(!error) {
        const p = adminPlaces.find(x => x.id === id);
        p.category = newCat; p.name = newName; p.parking_fee = newPark; p.entry_fee = newEntry; p.nursing_room = newNurse; p.comment = newDesc;
        btnElement.innerText = "✔ 완료"; btnElement.style.background = "#20c997";
        setTimeout(() => { btnElement.innerText = originalText; btnElement.style.background = "#5c7cfa"; btnElement.disabled = false; }, 1500);
    } else { alert("수정 에러: " + error.message); btnElement.disabled = false; }
}

async function approvePlace(id) {
    const { error } = await supabaseClient.from('places').update({ is_approved: true }).eq('id', id);
    if(!error) { adminPlaces.find(x => x.id === id).is_approved = true; renderAdminTable(); }
}

async function deletePlace(id) {
    if(!confirm("이 장소를 삭제하시겠습니까?")) return;
    const { error } = await supabaseClient.from('places').delete().eq('id', id);
    if(!error) { adminPlaces = adminPlaces.filter(p => p.id !== id); renderAdminTable(); }
}

function loadAllComments() {
    const tbody = document.getElementById('comments-tbody');
    let allComments = [];
    adminPlaces.forEach(p => {
        if(p.comments_list) {
            try { const arr = JSON.parse(p.comments_list); arr.forEach(c => { allComments.push({ placeId: p.id, placeName: p.name, ...c }); }); } catch(e){}
        }
    });

    allComments.sort((a,b) => b.id - a.id);
    if(allComments.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px; color:#adb5bd;">작성된 댓글이 없습니다.</td></tr>`; return; }

    tbody.innerHTML = allComments.map(c => {
        const dateStr = timeAgo(c.date || c.id);
        return `
        <tr>
            <td style="font-weight:700; color:#5c7cfa;">${escapeHtml(c.placeName)}</td>
            <td style="font-weight:600;">${escapeHtml(c.author)}</td>
            <td>${escapeHtml(c.text)}</td>
            <td style="font-size:12px; color:#868e96;">${dateStr}</td>
            <td><button class="btn btn-del" onclick="deleteCommentByAdmin(${c.placeId}, ${c.id})">삭제</button></td>
        </tr>
    `}).join('');
}

async function deleteCommentByAdmin(placeId, commentId) {
    if(!confirm("이 댓글을 삭제하시겠습니까?")) return;
    const place = adminPlaces.find(p => p.id === placeId);
    let comments = place.comments_list ? JSON.parse(place.comments_list) : [];
    comments = comments.filter(c => c.id !== commentId);
    const updatedJson = JSON.stringify(comments);
    const { error } = await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId);
    if(!error) { place.comments_list = updatedJson; loadAllComments(); } else alert("삭제 에러: " + error.message);
}

async function loadInquiries() {
    const tbody = document.getElementById('inquiries-tbody');
    const { data, error } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
    if (!error && data) { adminInquiries = data; renderInquiriesTable(); } 
    else tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px;">데이터가 없습니다.</td></tr>`;
}

function renderInquiriesTable() {
    const tbody = document.getElementById('inquiries-tbody');
    if (adminInquiries.length === 0) { tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">문의가 없습니다.</td></tr>`; return; }
    tbody.innerHTML = adminInquiries.map(i => {
        const dateStr = new Date(i.created_at).toLocaleString('ko-KR');
        return `<tr><td style="color:#adb5bd; font-weight:700;">#${i.id}</td><td style="color:#868e96; font-size:12px;">${dateStr}</td><td><div style="white-space: pre-wrap;">${escapeHtml(i.content)}</div></td><td style="color:#5c7cfa; font-weight:600;">${escapeHtml(i.contact_info || '-')}</td></tr>`
    }).join('');
}

function escapeQuote(str) { return !str ? '' : str.replace(/"/g, '&quot;'); }
function escapeHtml(text) { return !text ? '' : text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m])); }

const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

let adminPlaces = [];
let adminInquiries = [];
let adminBoardData = [];

window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) showAdminMain();
    else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('admin-password').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') submitAdminLogin();
        });
    }
};

async function submitAdminLogin() {
    const email = document.getElementById('admin-email').value.trim();
    const password = document.getElementById('admin-password').value;
    const errorEl = document.getElementById('login-error');
    if(!email || !password) return;
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (error) { errorEl.innerText = "로그인 정보가 일치하지 않습니다."; errorEl.style.display = 'block'; } 
    else showAdminMain();
}

function showAdminMain() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = 'block';
    loadAdminPlaces();
}

async function adminLogout() {
    await supabaseClient.auth.signOut();
    location.reload();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`btn-tab-${tab}`).classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
    if (tab === 'inquiries') loadInquiries();
    if (tab === 'comments') loadAllComments();
    if (tab === 'board') loadAdminBoard();
}

async function loadAdminPlaces() {
    const { data, error } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (error) {
        alert("장소 데이터를 불러오는 중 DB 에러가 발생했습니다: " + error.message);
        return;
    }
    if (data) { adminPlaces = data; renderAdminTable(); }
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-tbody');
    const searchWord = document.getElementById('admin-search').value.trim().toLowerCase();
    
    const activeCats = Array.from(document.querySelectorAll('.cat-toggle.active')).map(b => b.dataset.val);
    const activeStatuses = Array.from(document.querySelectorAll('.status-toggle.active')).map(b => b.dataset.val);

    let filtered = adminPlaces.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchWord);
        const pCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const matchCat = activeCats.includes(pCat);
        const matchApprove = activeStatuses.includes(String(p.is_approved));
        return matchName && matchCat && matchApprove;
    });

    document.getElementById('total-count').innerText = `총 ${filtered.length}개 검색됨`;
    document.getElementById('cb-all').checked = false;
    updateBulkBar();

    if (filtered.length === 0) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px;">데이터가 없습니다.</td></tr>`; return; }

    tbody.innerHTML = filtered.map(p => {
        const nCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const catClass = nCat === '야외' ? 'cat-outdoor' : (nCat === '문센' ? 'cat-moonsen' : 'cat-indoor');
        
        // 🔥 수정 요청글인지 확인하고 꼬리표 떼어내기
        const match = (p.comment || '').match(/^\[수정요청_ID:(\d+)\]\n/);
        let origId = null;
        let isEditReq = false;
        let displayComment = p.comment || '';

        if (match) {
            isEditReq = true;
            origId = parseInt(match[1]);
            displayComment = displayComment.replace(match[0], ''); // 화면에 보일 땐 꼬리표 숨김
        }

        const nameBadge = isEditReq ? `<div style="color:#f59f00; font-weight:800; font-size:11px; margin-bottom:2px;">[📝수정요청]</div>` : '';
        const approvedBadge = p.is_approved ? `<span style="color:#20c997; font-weight:800;">✅ 표시됨</span>` : `<span style="color:#FF6B6B; font-weight:800;">❗ 미승인</span>`;

        // 🔥 버튼 분기 처리 (수정요청이면 '수정 반영' 버튼 노출)
        let actionBtns = `<button class="btn btn-save" onclick="quickSave(${p.id}, this)">저장</button>`;
        if (!p.is_approved) {
            if (isEditReq) {
                actionBtns += `<button class="btn btn-approve" style="background:#f59f00;" onclick="approveEdit(${p.id}, ${origId})">수정 반영</button>`;
            } else {
                actionBtns += `<button class="btn btn-approve" onclick="approvePlace(${p.id})">승인</button>`;
            }
        }
        actionBtns += `<button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button>`;

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
            <td>${nameBadge}<input type="text" id="name-${p.id}" value="${escapeQuote(p.name)}" placeholder="장소명"></td>
            <td><input type="text" id="park-${p.id}" value="${escapeQuote(p.parking_fee || '')}" placeholder="무료 등"></td>
            <td>
    <select class="api-area-select" onchange="updateApiArea(${place.id}, this.value)">
        <option value="" ${place.seoul_api_area === null || place.seoul_api_area === '' ? 'selected' : ''}>연동 안 함</option>
        
        <option value="여의도한강공원" ${place.seoul_api_area === '여의도한강공원' ? 'selected' : ''}>여의도한강공원</option>
        <option value="광화문·덕수궁" ${place.seoul_api_area === '광화문·덕수궁' ? 'selected' : ''}>광화문·덕수궁</option>
        <option value="더현대서울" ${place.seoul_api_area === '더현대서울' ? 'selected' : ''}>더현대서울</option>
        <option value="잠실종합운동장" ${place.seoul_api_area === '잠실종합운동장' ? 'selected' : ''}>잠실종합운동장</option>
        </select>
</td>
            <td><input type="text" id="entry-${p.id}" value="${escapeQuote(p.entry_fee || '')}" placeholder="없음 등"></td>
            <td><input type="text" id="nurse-${p.id}" value="${escapeQuote(p.nursing_room || '')}" placeholder="수유실 정보"></td>
            <td><input type="text" id="desc-${p.id}" value="${escapeQuote(displayComment)}" placeholder="상세 설명"></td>
            <td>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    ${actionBtns}
                </div>
            </td>
        </tr>`}).join('');
}

function toggleAll(source) { document.querySelectorAll('.cb-item').forEach(cb => cb.checked = source.checked); updateBulkBar(); }
function updateBulkBar() { const checked = document.querySelectorAll('.cb-item:checked'); const bar = document.getElementById('bulk-bar'); document.getElementById('sel-count').innerText = checked.length; bar.style.display = checked.length > 0 ? 'flex' : 'none'; }

async function bulkAction(actionType) {
    const checked = document.querySelectorAll('.cb-item:checked');
    if (checked.length === 0) return;
    const ids = Array.from(checked).map(cb => parseInt(cb.value));

    if (actionType === 'category') {
        const newCat = document.getElementById('bulk-category').value;
        if (!confirm(`선택한 ${ids.length}개 장소를 '${newCat}'(으)로 일괄 변경하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').update({ category: newCat }).in('id', ids);
        if (!error) { adminPlaces.forEach(p => { if (ids.includes(p.id)) p.category = newCat; }); renderAdminTable(); }
    } else if (actionType === 'approve') {
        if (!confirm(`선택한 ${ids.length}개 장소를 승인하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').update({ is_approved: true }).in('id', ids);
        if (!error) { adminPlaces.forEach(p => { if (ids.includes(p.id)) p.is_approved = true; }); renderAdminTable(); }
    } else if (actionType === 'delete') {
        if (!confirm(`경고: 영구 삭제하시겠습니까?`)) return;
        const { error } = await supabaseClient.from('places').delete().in('id', ids);
        if (!error) { adminPlaces = adminPlaces.filter(p => !ids.includes(p.id)); renderAdminTable(); }
    }
}

async function quickSave(id, btnElement) {
    const newCat = document.getElementById(`cat-${id}`).value; 
    const newName = document.getElementById(`name-${id}`).value.trim();
    const newPark = document.getElementById(`park-${id}`).value.trim(); 
    const newEntry = document.getElementById(`entry-${id}`).value.trim();
    const newNurse = document.getElementById(`nurse-${id}`).value.trim(); 
    const newDesc = document.getElementById(`desc-${id}`).value.trim();
    
    if(!newName) return alert("장소명 필수");

    // 🔥 꼬리표 유지 로직 (저장할 때 꼬리표가 날아가지 않도록 붙여줌)
    const p = adminPlaces.find(x => x.id === id);
    let finalDesc = newDesc;
    const match = (p.comment || '').match(/^\[수정요청_ID:\d+\]\n/);
    if (match) finalDesc = match[0] + newDesc;

    const originalText = btnElement.innerText; 
    btnElement.innerText = "저장중.."; btnElement.disabled = true;
    
    const { error } = await supabaseClient.from('places').update({ category: newCat, name: newName, parking_fee: newPark, entry_fee: newEntry, nursing_room: newNurse, comment: finalDesc }).eq('id', id);
    
    if(!error) {
        p.category = newCat; p.name = newName; p.parking_fee = newPark; p.entry_fee = newEntry; p.nursing_room = newNurse; p.comment = finalDesc;
        btnElement.innerText = "✔ 완료"; btnElement.style.background = "#20c997";
        setTimeout(() => { btnElement.innerText = originalText; btnElement.style.background = "#5c7cfa"; btnElement.disabled = false; }, 1500);
    } else { 
        alert("수정 에러: " + error.message); btnElement.disabled = false; 
    }
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
    const tbody = document.getElementById('comments-tbody'); let allComments = [];
    adminPlaces.forEach(p => {
        if(p.comments_list) { try { const arr = JSON.parse(p.comments_list); arr.forEach(c => { allComments.push({ placeId: p.id, placeName: p.name, ...c }); }); } catch(e){} }
    });
    allComments.sort((a,b) => b.id - a.id);
    if(allComments.length === 0) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:40px;">작성된 댓글이 없습니다.</td></tr>`; return; }
    tbody.innerHTML = allComments.map(c => {
        const dateStr = timeAgo(c.date || c.id);
        return `<tr><td style="font-weight:700; color:#5c7cfa;">${escapeHtml(c.placeName)}</td><td style="font-weight:600;">${escapeHtml(c.author)}</td><td>${escapeHtml(c.text)}</td><td style="font-size:12px; color:#868e96;">${dateStr}</td><td><button class="btn btn-del" onclick="deleteCommentByAdmin(${c.placeId}, ${c.id})">삭제</button></td></tr>`
    }).join('');
}

async function deleteCommentByAdmin(placeId, commentId) {
    if(!confirm("이 댓글을 삭제하시겠습니까?")) return;
    const place = adminPlaces.find(p => p.id === placeId);
    let comments = place.comments_list ? JSON.parse(place.comments_list) : [];
    comments = comments.filter(c => c.id !== commentId);
    const updatedJson = JSON.stringify(comments);
    const { error } = await supabaseClient.from('places').update({ comments_list: updatedJson }).eq('id', placeId);
    if(!error) { place.comments_list = updatedJson; loadAllComments(); }
}

async function loadInquiries() {
    const tbody = document.getElementById('inquiries-tbody');
    const { data, error } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
    if (!error && data) { adminInquiries = data; renderInquiriesTable(); }
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

async function loadAdminBoard() {
    const tbody = document.getElementById('board-tbody');
    const { data, error } = await supabaseClient.from('notices').select('*').order('created_at', { ascending: false });
    if (error) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#FF6B6B;">DB 통신 에러가 발생했습니다: ${error.message}</td></tr>`;
        return;
    }
    if (data) { adminBoardData = data; renderAdminBoard(); }
}

function renderAdminBoard() {
    const tbody = document.getElementById('board-tbody');
    if (adminBoardData.length === 0) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">게시글이 없습니다.</td></tr>`; return; }

    tbody.innerHTML = adminBoardData.map(n => {
        const dateStr = new Date(n.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        const noticeBtn = n.is_notice ? `<button class="btn btn-save" style="background:#FF6B6B;" onclick="toggleNotice(${n.id}, false)">📌 해제</button>` : `<button class="btn btn-save" style="background:#adb5bd;" onclick="toggleNotice(${n.id}, true)">일반</button>`;
        const popupBtn = n.is_popup ? `<button class="btn btn-save" style="background:#845EF7;" onclick="togglePopup(${n.id}, false)">✨ 팝업해제</button><div style="font-size:10px; color:#868e96;">~${n.popup_end_date||''}</div>` : `<button class="btn btn-save" style="background:#adb5bd;" onclick="togglePopup(${n.id}, true)">팝업설정</button>`;

        return `
        <tr>
            <td style="color:#adb5bd; font-weight:700;">#${n.id}</td>
            <td style="text-align:center;">${noticeBtn}</td>
            <td style="text-align:center;">${popupBtn}</td>
            <td style="font-weight:600;">${escapeHtml(n.author || '익명')}</td>
            <td style="font-weight:700;">${escapeHtml(n.title)}</td>
            <td style="font-size:12px; color:#868e96;">${dateStr}</td>
            <td><button class="btn btn-del" onclick="deleteAdminBoard(${n.id})">삭제</button></td>
        </tr>`}).join('');
}

async function toggleNotice(id, isNotice) {
    const { error } = await supabaseClient.from('notices').update({ is_notice: isNotice }).eq('id', id);
    if (!error) { adminBoardData.find(x => x.id === id).is_notice = isNotice; renderAdminBoard(); }
}

async function togglePopup(id, isPopup) {
    let endDate = null;
    if(isPopup) {
        endDate = prompt("팝업 종료일을 입력하세요 (YYYY-MM-DD 형식)", new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0]);
        if(!endDate) return;
        if(isNaN(new Date(endDate).getTime())) return alert('올바른 날짜 형식이 아닙니다.');
    }
    const { error } = await supabaseClient.from('notices').update({ is_popup: isPopup, popup_end_date: endDate }).eq('id', id);
    if (!error) { 
        const item = adminBoardData.find(x => x.id == id); 
        if(item) { item.is_popup = isPopup; item.popup_end_date = endDate; } 
        renderAdminBoard(); 
        alert(isPopup ? '팝업이 설정되었습니다.' : '팝업이 해제되었습니다.');
    } else alert("팝업 설정 실패 (DB에 is_popup, popup_end_date 컬럼을 먼저 생성하거나 캐시를 초기화해주세요): " + error.message);
}

async function deleteAdminBoard(id) {
    if(!confirm("이 게시글을 삭제하시겠습니까?")) return;
    const { error } = await supabaseClient.from('notices').delete().eq('id', id);
    if (!error) { adminBoardData = adminBoardData.filter(x => x.id !== id); renderAdminBoard(); }
}

function toggleAdminFilter(btn) {
    btn.classList.toggle('active');
    renderAdminTable();
}

// 🔥 '수정 반영' 버튼 클릭 시 실행되는 함수
async function approveEdit(reqId, origId) {
    if(!confirm("이 수정 요청을 '원본 장소'에 덮어씌워 반영하시겠습니까?")) return;

    const reqPlace = adminPlaces.find(x => x.id === reqId);
    
    // DB에 넣기 전 꼬리표 떼어내기
    const cleanComment = (reqPlace.comment || '').replace(/^\[수정요청_ID:\d+\]\n/, '');

    // 1. 원본 데이터 덮어쓰기
    const updateData = {
        category: reqPlace.category,
        name: reqPlace.name,
        parking_fee: reqPlace.parking_fee,
        entry_fee: reqPlace.entry_fee,
        nursing_room: reqPlace.nursing_room,
        comment: cleanComment,
        website_url: reqPlace.website_url,
        business_hours: reqPlace.business_hours,
    };
    if (reqPlace.image_url) updateData.image_url = reqPlace.image_url;

    const { error: updateErr } = await supabaseClient.from('places').update(updateData).eq('id', origId);
    if (updateErr) return alert("원본 반영 실패: " + updateErr.message);

    // 2. 반영 끝난 임시글(수정요청글) 삭제
    const { error: delErr } = await supabaseClient.from('places').delete().eq('id', reqId);
    if (delErr) return alert("반영은 완료되었으나 임시 요청글 삭제에 실패했습니다.");

    alert("수정 내용이 원본에 성공적으로 반영되었습니다!");
    loadAdminPlaces(); // 데이터 목록 새로고침
}

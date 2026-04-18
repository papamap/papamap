const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let adminPlaces = []; let adminBoardData = [];

window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { showAdminMain(); } else {
        document.getElementById('login-screen').style.display = 'block';
        document.getElementById('admin-password').addEventListener('keypress', function(e) { if (e.key === 'Enter') submitAdminLogin(); });
    }
};

async function submitAdminLogin() {
    const email = document.getElementById('admin-email').value.trim(); const password = document.getElementById('admin-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });
    if (!error) showAdminMain(); else { document.getElementById('login-error').innerText = "로그인 실패"; document.getElementById('login-error').style.display = 'block'; }
}

function showAdminMain() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = 'block';
    loadAdminPlaces(); loadAdminBoard(); loadInquiries();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active'); document.getElementById(`section-${tab}`).classList.add('active');
    if (tab === 'stats') updateStats();
}

function escapeQuote(str) { return !str ? '' : str.replace(/"/g, '&quot;'); }

async function loadAdminPlaces() {
    const { data } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (data) { adminPlaces = data; renderAdminTable(); updateStats(); }
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-tbody');
    const searchWord = document.getElementById('admin-search').value.trim().toLowerCase();
    const filterCat = document.getElementById('admin-category').value; const filterApprove = document.getElementById('admin-approval').value;

    let filtered = adminPlaces.filter(p => {
        const matchName = p.name.toLowerCase().includes(searchWord);
        const pCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const matchCat = (filterCat === "") || (pCat === filterCat);
        const matchApprove = (filterApprove === "") || (String(p.is_approved) === filterApprove);
        return matchName && matchCat && matchApprove;
    });

    document.getElementById('total-count').innerText = `총 ${filtered.length}개 검색됨`;

    tbody.innerHTML = filtered.map(p => {
        const nCat = (p.category && p.category.includes('야외')) ? '야외' : (p.category && p.category.includes('문센') ? '문센' : '실내');
        const catClass = nCat === '야외' ? 'cat-outdoor' : (nCat === '문센' ? 'cat-moonsen' : 'cat-indoor');
        const approvedBadge = p.is_approved ? `<span style="color:#20c997; font-weight:800;">✅ 승인됨</span>` : `<span style="color:#FF6B6B; font-weight:800;">❗ 미승인</span>`;

        return `
        <tr>
            <td style="font-size:11px;">${approvedBadge}<br><span style="color:#adb5bd;">#${p.id}</span></td>
            <td><select id="cat-${p.id}" class="cat-chip ${catClass}" onchange="this.className='cat-chip ' + (this.value==='야외'?'cat-outdoor':(this.value==='문센'?'cat-moonsen':'cat-indoor'))"><option value="실내" ${nCat === '실내' ? 'selected' : ''}>실내</option><option value="야외" ${nCat === '야외' ? 'selected' : ''}>야외</option><option value="문센" ${nCat === '문센' ? 'selected' : ''}>문센</option></select></td>
            <td><input type="text" id="name-${p.id}" value="${escapeQuote(p.name)}" placeholder="장소명"></td>
            <td><input type="text" id="park-${p.id}" value="${escapeQuote(p.parking_fee || '')}" placeholder="무료 등"></td>
            <td><input type="text" id="entry-${p.id}" value="${escapeQuote(p.entry_fee || '')}" placeholder="없음 등"></td>
            <td><input type="text" id="nurse-${p.id}" value="${escapeQuote(p.nursing_room || '')}" placeholder="수유실 정보"></td>
            <td><input type="text" id="desc-${p.id}" value="${escapeQuote(p.comment || '')}" placeholder="상세 설명"></td>
            <td><div style="display:flex; flex-direction:column; gap:4px;"><button class="btn btn-save" onclick="quickSave(${p.id}, this)">저장</button>${!p.is_approved ? `<button class="btn btn-approve" onclick="approvePlace(${p.id})">승인</button>` : ''}<button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button></div></td>
        </tr>`
    }).join('');
}

function updateStats() {
    if(adminPlaces.length > 0) {
        document.getElementById('stat-total-places').innerText = adminPlaces.length + "개";
        const totalViews = adminPlaces.reduce((sum, p) => sum + ((p.views || p.likes) || 0), 0);
        document.getElementById('stat-total-views').innerText = totalViews + "회";
        const sortedPlaces = [...adminPlaces].sort((a,b) => ((b.views || b.likes) || 0) - ((a.views || a.likes) || 0));
        document.getElementById('stat-top-place').innerText = `${sortedPlaces[0].name} (${(sortedPlaces[0].views || sortedPlaces[0].likes) || 0}회)`;
    }
}

async function quickSave(id, btn) {
    const newCat = document.getElementById(`cat-${id}`).value; const newName = document.getElementById(`name-${id}`).value.trim();
    const newPark = document.getElementById(`park-${id}`).value.trim(); const newEntry = document.getElementById(`entry-${id}`).value.trim();
    const newNurse = document.getElementById(`nurse-${id}`).value.trim(); const newDesc = document.getElementById(`desc-${id}`).value.trim();
    if(!newName) return; const oText = btn.innerText; btn.innerText = "저장중.."; btn.disabled = true;
    const { error } = await supabaseClient.from('places').update({ category: newCat, name: newName, parking_fee: newPark, entry_fee: newEntry, nursing_room: newNurse, comment: newDesc }).eq('id', id);
    if(!error) { btn.innerText = "✔ 완료"; btn.style.background = "#20c997"; setTimeout(() => { btn.innerText = oText; btn.style.background = "#5c7cfa"; btn.disabled = false; }, 1500); }
}

async function approvePlace(id) { await supabaseClient.from('places').update({ is_approved: true }).eq('id', id); loadAdminPlaces(); }
async function deletePlace(id) { if(confirm("이 장소를 삭제하시겠습니까?")) { await supabaseClient.from('places').delete().eq('id', id); loadAdminPlaces(); } }

// 💡 팝업 기능 완벽 버그 수정! (문자열 파싱 없이 JS 이벤트 직접 연결)
async function loadAdminBoard() {
    const { data } = await supabaseClient.from('notices').select('*').order('created_at', { ascending: false });
    if (data) {
        adminBoardData = data;
        document.getElementById('board-tbody').innerHTML = adminBoardData.map(n => `
        <tr>
            <td style="color:#adb5bd; font-weight:700;">#${n.id}</td>
            <td style="display:flex; flex-direction:column; gap:4px; font-weight:800;">
                <span style="color:${n.is_popup ? '#f59f00' : '#adb5bd'}">${n.is_popup ? '🎈 팝업 중' : '일반'}</span>
                <span style="color:${n.is_notice ? '#FF6B6B' : '#adb5bd'}">${n.is_notice ? '📌 공지 중' : '일반'}</span>
            </td>
            <td style="font-weight:600;">${n.author || '익명'}</td>
            <td style="font-weight:700;">${n.title}</td>
            <td><input type="date" value="${n.popup_end_date || ''}" onchange="updatePopupDate(${n.id}, this.value)" style="padding:4px; border:1px solid #dee2e6; border-radius:6px; font-family:inherit;"></td>
            <td>
                <div style="display:flex; gap:4px; flex-direction:column;">
                    <button class="btn btn-save" style="background:${n.is_popup ? '#f59f00' : '#adb5bd'};" onclick="togglePopup(${n.id}, ${!n.is_popup})">${n.is_popup ? '팝업 해제' : '팝업 설정'}</button>
                    <button class="btn btn-save" style="background:${n.is_notice ? '#FF6B6B' : '#adb5bd'};" onclick="toggleNotice(${n.id}, ${!n.is_notice})">${n.is_notice ? '공지 해제' : '공지 설정'}</button>
                </div>
            </td>
        </tr>`).join('');
    }
}

async function togglePopup(id, state) { await supabaseClient.from('notices').update({ is_popup: state }).eq('id', id); loadAdminBoard(); }
async function toggleNotice(id, state) { await supabaseClient.from('notices').update({ is_notice: state }).eq('id', id); loadAdminBoard(); }
async function updatePopupDate(id, val) { await supabaseClient.from('notices').update({ popup_end_date: val || null }).eq('id', id); alert("팝업 종료일이 업데이트 되었습니다."); }

async function loadInquiries() {
    const { data } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
    if (data) document.getElementById('inquiries-tbody').innerHTML = data.map(i => `<tr><td style="color:#adb5bd; font-weight:700;">#${i.id}</td><td style="color:#868e96; font-size:12px;">${new Date(i.created_at).toLocaleString('ko-KR')}</td><td><div style="white-space: pre-wrap;">${i.content}</div></td><td style="color:#5c7cfa; font-weight:600;">${i.contact_info || '-'}</td></tr>`).join('');
}
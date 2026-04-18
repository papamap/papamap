const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.onload = async function() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) showAdminMain();
};

async function submitAdminLogin() {
    const e = document.getElementById('admin-email').value; const p = document.getElementById('admin-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email: e, password: p });
    if (!error) showAdminMain(); else alert("로그인 실패");
}

function showAdminMain() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-main').style.display = 'block';
    loadAdminPlaces(); loadAdminBoard(); loadInquiries();
}

function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`section-${tab}`).classList.add('active');
}

async function loadAdminPlaces() {
    const { data } = await supabaseClient.from('places').select('*').order('id', { ascending: false });
    if (data) document.getElementById('admin-tbody').innerHTML = data.map(p => `<tr><td>${p.id}</td><td>${p.is_approved ? '✅' : '❗'}</td><td>${p.name}</td><td>${p.category}</td><td><button class="btn btn-save" onclick="approvePlace(${p.id})">승인</button> <button class="btn btn-del" onclick="deletePlace(${p.id})">삭제</button></td></tr>`).join('');
}
async function approvePlace(id) { await supabaseClient.from('places').update({ is_approved: true }).eq('id', id); loadAdminPlaces(); }
async function deletePlace(id) { if(confirm("삭제?")) { await supabaseClient.from('places').delete().eq('id', id); loadAdminPlaces(); } }

async function loadAdminBoard() {
    const { data } = await supabaseClient.from('notices').select('*').order('created_at', { ascending: false });
    if (data) {
        document.getElementById('board-tbody').innerHTML = data.map(n => `
        <tr>
            <td>${n.id}</td>
            <td>${n.is_popup ? '🎈 팝업' : '일반'} / ${n.is_notice ? '📌 공지' : '일반'}</td>
            <td>${n.title}</td>
            <td><input type="date" value="${n.popup_end_date || ''}" onchange="updatePopupDate(${n.id}, this.value)"></td>
            <td>
                <button class="btn btn-save" style="background:#f59f00;" onclick="togglePopup(${n.id}, ${!n.is_popup})">팝업 토글</button>
                <button class="btn btn-save" onclick="toggleNotice(${n.id}, ${!n.is_notice})">공지 토글</button>
            </td>
        </tr>`).join('');
    }
}
async function togglePopup(id, state) { await supabaseClient.from('notices').update({ is_popup: state }).eq('id', id); loadAdminBoard(); }
async function toggleNotice(id, state) { await supabaseClient.from('notices').update({ is_notice: state }).eq('id', id); loadAdminBoard(); }
async function updatePopupDate(id, val) { await supabaseClient.from('notices').update({ popup_end_date: val || null }).eq('id', id); alert("저장됨"); }

async function loadInquiries() {
    const { data } = await supabaseClient.from('inquiries').select('*').order('created_at', { ascending: false });
    if (data) document.getElementById('inquiries-tbody').innerHTML = data.map(i => `<tr><td>${i.id}</td><td><pre>${i.content}</pre></td></tr>`).join('');
}
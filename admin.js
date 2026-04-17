const SUPABASE_URL="https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY="sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);

let adminPlaces=[];
window.onload=async()=>{const{data:{session}}=await supabaseClient.auth.getSession();if(session)showAdminMain();};
async function submitAdminLogin(){const e=document.getElementById('admin-email').value,p=document.getElementById('admin-password').value;const{error}=await supabaseClient.auth.signInWithPassword({email:e,password:p});if(!error)showAdminMain();else alert('오류');}
function showAdminMain(){document.getElementById('login-screen').style.display='none';document.getElementById('admin-main').style.display='block';loadAdminPlaces();loadBoard();loadInquiries();}
function switchTab(t){document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));event.target.classList.add('active');document.getElementById(`section-${t}`).classList.add('active');}

async function loadAdminPlaces(){
    const{data}=await supabaseClient.from('places').select('*').order('id',{ascending:false});
    if(data){
        adminPlaces=data;
        document.getElementById('admin-tbody').innerHTML=data.map(p=>`<tr><td>${p.id}</td><td>${p.is_approved?'✅':'❗'}</td><td>${p.name}</td><td>${p.category}</td><td><button class="btn" onclick="approve(${p.id})">승인</button> <button class="btn" style="background:#FF6B6B" onclick="delPlace(${p.id})">삭제</button></td></tr>`).join('');
        // 통계 계산
        document.getElementById('stat-places').innerText=data.length;
        const totalV=data.reduce((s,p)=>s+(p.views||0),0);document.getElementById('stat-views').innerText=totalV;
        const topP=data.sort((a,b)=>(b.views||0)-(a.views||0))[0];
        document.getElementById('stat-top-place').innerText=topP?`${topP.name} (${topP.views||0}회)`:'-';
    }
}
async function approve(id){await supabaseClient.from('places').update({is_approved:true}).eq('id',id);loadAdminPlaces();}
async function delPlace(id){if(confirm('삭제?')){await supabaseClient.from('places').delete().eq('id',id);loadAdminPlaces();}}

async function loadBoard(){
    const{data}=await supabaseClient.from('notices').select('*').order('id',{ascending:false});
    if(data){
        document.getElementById('board-tbody').innerHTML=data.map(n=>`<tr><td>${n.id}</td><td>${n.title}</td><td>${n.is_popup?'🎈 팝업':'일반'} / ${n.is_notice?'📌 공지':'일반'}</td><td>${n.popup_end_date||'-'}</td><td><button class="btn" onclick="setPopup(${n.id}, ${!n.is_popup})">팝업 토글</button> <button class="btn" onclick="setEndDate(${n.id})">날짜설정</button></td></tr>`).join('');
    }
}
async function setPopup(id, state){await supabaseClient.from('notices').update({is_popup:state}).eq('id',id);loadBoard();}
async function setEndDate(id){const d=prompt('팝업 종료 날짜 (YYYY-MM-DD)','2026-05-01');if(d){await supabaseClient.from('notices').update({popup_end_date:d}).eq('id',id);loadBoard();}}

async function loadInquiries(){
    const{data}=await supabaseClient.from('inquiries').select('*').order('id',{ascending:false});
    if(data)document.getElementById('inquiries-tbody').innerHTML=data.map(i=>`<tr><td>${new Date(i.created_at).toLocaleString()}</td><td>${i.content}</td></tr>`).join('');
}

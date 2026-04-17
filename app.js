const SUPABASE_URL="https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY="sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const KAKAO_REST_KEY="f971a5a1cc6ae49cf691f170f5e03dfd";
var map;var placesData=[];var noticesData=[];var currentSearchScope='all';var activeCategory='전체';
var userLat=37.5238506,userLng=126.9804702;var selectedLat=null,selectedLng=null;var currentNoticeId=null;var userLocationMarker=null;
const shareIcon=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>`;

function timeAgo(d){const s=Math.floor((new Date()-new Date(d))/1000);if(s<60)return"방금 전";const m=Math.floor(s/60);if(m<60)return`${m}분 전`;const h=Math.floor(m/60);if(h<24)return`${h}시간 전`;const dy=Math.floor(h/24);if(dy<7)return`${dy}일 전`;return`${Math.floor(dy/7)}주 전`;}
let pwResolve=null;let textResolve=null;
function askPassword(){return new Promise(r=>{pwResolve=r;document.getElementById('pw-modal').style.display='flex';document.getElementById('pw-input').value='';document.getElementById('pw-input').focus();});}
function resolvePw(v){document.getElementById('pw-modal').style.display='none';if(pwResolve)pwResolve(v);}
function askTextPrompt(t){return new Promise(r=>{textResolve=r;document.getElementById('text-prompt-modal').style.display='flex';document.getElementById('text-prompt-input').value=t||'';document.getElementById('text-prompt-input').focus();});}
function resolveTextPrompt(v){document.getElementById('text-prompt-modal').style.display='none';if(textResolve)textResolve(v);}
function escapeHtml(t){const m={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};return!t?'':t.replace(/[&<>"']/g,x=>m[x]);}

class MediaManager{
    constructor(cId,iName,maxF){this.cId=cId;this.iName=iName;this.maxF=maxF;this.m=[];}
    loadUrls(u){this.m=[];if(u)u.split(',').forEach(x=>{if(x.trim())this.m.push({t:'u',d:x.trim()});});this.render();}
    addFiles(i){Array.from(i.files).forEach(f=>{if(this.m.length<this.maxF)this.m.push({t:'f',d:f});});i.value='';this.render();}
    remove(i){this.m.splice(i,1);this.render();}
    render(){const c=document.getElementById(this.cId);c.innerHTML='';this.m.forEach((x,i)=>{const div=document.createElement('div');div.className='media-preview-item';div.innerHTML=x.t==='u'?`<img src="${x.d}" class="media-preview-img"><button class="media-preview-del" onclick="${this.iName}.remove(${i})">✖</button>`:`<span style="font-size:10px;padding:4px;">새 파일</span><button class="media-preview-del" onclick="${this.iName}.remove(${i})">✖</button>`;c.appendChild(div);});}
    async uploadAll(){let res=[];for(let x of this.m){if(x.t==='u')res.push(x.d);else{const fn=`${Date.now()}_${Math.random().toString(36).substr(2)}.${x.d.name.split('.').pop()}`;const{error}=await supabaseClient.storage.from('places').upload(fn,x.d);if(!error)res.push(supabaseClient.storage.from('places').getPublicUrl(fn).data.publicUrl);}}return res.length?res.join(','):null;}
}
window.noticeMediaManager=new MediaManager('notice-media-preview','noticeMediaManager',10);
window.placeAddMediaManager=new MediaManager('place-add-media-preview','placeAddMediaManager',3);
window.placeEditMediaManager=new MediaManager('place-edit-media-preview','placeEditMediaManager',3);

async function loadMainPopup(){
    if(localStorage.getItem('hidePopupDate')===new Date().toDateString())return;
    const{data}=await supabaseClient.from('notices').select('*').eq('is_popup',true);
    if(data&&data.length>0){
        const v=data.find(n=>!n.popup_end_date||new Date(n.popup_end_date)>=new Date());
        if(v&&v.image_url){
            document.getElementById('popup-slider').innerHTML=v.image_url.split(',').map(u=>`<img src="${u}" style="width:100%;object-fit:contain;flex-shrink:0;">`).join('');
            document.getElementById('main-popup').style.display='flex';
        }
    }
}
function closeMainPopup(){
    if(document.getElementById('popup-hide-today').checked)localStorage.setItem('hidePopupDate',new Date().toDateString());
    document.getElementById('main-popup').style.display='none';
}

function getDistanceKm(lat1,lon1,lat2,lon2){const R=6371;const dLat=(lat2-lat1)*Math.PI/180;const a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin((lon2-lon1)*Math.PI/180/2)*Math.sin((lon2-lon1)*Math.PI/180/2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function normalizeCat(c){return!c?'실내':c.includes('야외')?'야외':c.includes('문센')?'문센':'실내';}
function getMarkerHTML(p,z){let e=normalizeCat(p.category)==='야외'?'🌳':normalizeCat(p.category)==='문센'?'🎨':'🏢';let c=normalizeCat(p.category)==='야외'?'marker-outdoor':normalizeCat(p.category)==='문센'?'marker-moonsen':'marker-indoor';const n=escapeHtml(p.name);return z?`<div class="custom-marker zoomed ${c}" title="${n}"><div class="marker-pin"></div><div class="marker-label">${n}</div></div>`:`<div class="custom-marker ${c}" title="${n}"><div class="marker-pin"><div class="marker-icon">${e}</div></div><div class="marker-label">${n}</div></div>`;}

async function fetchWeather(lat,lng){
    try{
        const[wRes,aRes]=await Promise.all([fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`),fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm10`)]);
        const w=await wRes.json(),a=await aRes.json();
        let t=Math.round(w.current_weather.temperature),c=w.current_weather.weathercode,i='☀️';
        if(c>=1&&c<=3)i='⛅';if(c>=51&&c<=67)i='🌧️';if(c>=71&&c<=77)i='❄️';
        let pm=a.current.pm10,ai='😊',at='좋음',bad=false;
        if(pm>150){ai='👿';at='매우나쁨';bad=true;}else if(pm>80){ai='😷';at='나쁨';bad=true;}else if(pm>30){ai='😐';at='보통';}
        let rain=(c>=51&&c<=77);if(rain)ai='☔';
        const str=`${i} ${t}°C | ${ai} ${at}`;
        const b=document.getElementById('weather-banner');b.style.display='block';
        if((rain||bad)&&activeCategory==='전체'){
            document.getElementById('weather-banner-text').innerHTML=`${str} - 오늘은 실내 활동을 추천해요!`;
            setTimeout(()=>{setCategory('실내');},800);
        }else document.getElementById('weather-banner-text').innerHTML=`${str} - 나들이 가기 좋은 날씨예요!`;
    }catch(e){}
}

function updateVisibleMarkers(){
    if(!map)return;const b=map.getBounds();
    placesData.forEach(p=>{if(!p.marker)return;const c=(activeCategory==='전체'||normalizeCat(p.category)===activeCategory);if(c&&b.hasLatLng(p.marker.getPosition())){if(!p.marker.getMap())p.marker.setMap(map);}else p.marker.setMap(null);});
    if(activeCategory==='전체'){
        const v=placesData.filter(p=>b.hasLatLng(new naver.maps.LatLng(p.latitude,p.longitude)));
        v.sort((x,y)=>((y.views||y.likes)||0)-((x.views||x.likes)||0));const t=v.slice(0,5);
        let c=document.getElementById('top5-container');if(!c){c=document.createElement('div');c.id='top5-container';c.className='top5-overlay';document.body.appendChild(c);}
        if(t.length===0)c.style.display='none';
        else{c.style.display='block';c.innerHTML=`<div class="top5-header">🔥 조회수 top 5</div><div class="top5-list">${t.map((p,i)=>`<div class="top5-item" onclick="map.panTo(new naver.maps.LatLng(${p.latitude}, ${p.longitude})); renderPanel(${p.id});"><span class="top5-rank">${i+1}</span><span class="top5-name">${p.name}</span></div>`).join('')}</div>`;}
    }else{const c=document.getElementById('top5-container');if(c)c.style.display='none';}
}

window.onload=function(){
    map=new naver.maps.Map('map',{center:new naver.maps.LatLng(userLat,userLng),zoom:14,mapDataControl:false});
    fetchWeather(userLat,userLng);loadMainPopup();
    if(navigator.geolocation)navigator.geolocation.getCurrentPosition(pos=>{userLat=pos.coords.latitude;userLng=pos.coords.longitude;map.setCenter(new naver.maps.LatLng(userLat,userLng));fetchWeather(userLat,userLng);},e=>{},{timeout:5000});
    naver.maps.Event.addListener(map,'click',()=>{closePanel();closeSearchPanel();});
    naver.maps.Event.addListener(map,'idle',()=>updateVisibleMarkers());
    naver.maps.Event.addListener(map,'zoom_changed',()=>{
        let z=map.getZoom()<13;placesData.forEach(p=>{if(p.marker)p.marker.setIcon({content:getMarkerHTML(p,z),anchor:z?new naver.maps.Point(7,7):new naver.maps.Point(14,28)});});updateVisibleMarkers();
    });
    loadPlaces();loadNotices();
};

function setCategory(c){activeCategory=c;document.querySelectorAll('.category-nav .chip').forEach(e=>e.classList.toggle('active',e.dataset.cat===c));updateVisibleMarkers();}
function closePanel(){document.getElementById('info-content').classList.remove('show');const tc=document.getElementById('top5-container');if(tc)tc.style.display='block';updateVisibleMarkers();}

async function loadPlaces(){
    const{data}=await supabaseClient.from('places').select('*').eq('is_approved',true);
    if(data){
        placesData=data.map(p=>{if(p.name)p.name=p.name.split('\\n')[0].split('\n')[0].trim();return p;});
        placesData.forEach(p=>{p.marker=new naver.maps.Marker({position:new naver.maps.LatLng(p.latitude+(Math.random()-0.5)*0.0002,p.longitude+(Math.random()-0.5)*0.0002),icon:{content:getMarkerHTML(p,false),anchor:new naver.maps.Point(14,28)},zIndex:p.views||0});p.marker.addListener('click',()=>{map.panTo(p.marker.getPosition());renderPanel(p.id);});});
        updateVisibleMarkers();
    }
}

async function renderPanel(id){
    const p=placesData.find(x=>x.id===id);if(!p)return;
    const tc=document.getElementById('top5-container');if(tc)tc.style.display='none';
    const{error}=await supabaseClient.from('places').update({views:(p.views||0)+1}).eq('id',id);if(!error)p.views=(p.views||0)+1;
    
    let cArr=p.comments_list?JSON.parse(p.comments_list):[];
    let imgHtml='';if(p.image_url){const u=p.image_url.split(',');imgHtml=`<div class="image-slider">${u.map(x=>`<img src="${x}" class="place-photo">`).join('')}</div>`;}
    
    document.getElementById('info-content').innerHTML=`
        <div class="panel-top-bar"><button class="btn-back-arrow" onclick="closePanel()">←</button><button class="icon-btn" onclick="navigator.share({url:window.location.href})">${shareIcon}</button></div>
        <div class="info-scroll-area">
            ${imgHtml}
            <div class="info-body-wrap">
                <div class="info-category">${normalizeCat(p.category)}</div>
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div class="info-title">${p.name}</div>
                    <button class="btn-edit-tiny" style="background:none;border:none;font-size:20px;padding:0;" onclick="openEditModal(${p.id})">✏️</button>
                </div>
                <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">
                    <button class="btn-map-text bg-naver" style="padding:6px 12px;font-size:12px;" onclick="window.open('nmap://search?query=${p.name}')">네이버맵</button>
                    <button class="btn-map-text bg-kakao" style="padding:6px 12px;font-size:12px;" onclick="window.open('kakaomap://search?q=${p.name}')">카카오맵</button>
                </div>
                <div style="margin-top:16px;">
                    ${p.business_hours?`<div class="info-tag"><span class="tag-label">시간</span><span class="tag-value">${escapeHtml(p.business_hours).replace(/\n/g,'<br>')}</span></div>`:''}
                    ${p.parking_fee?`<div class="info-tag"><span class="tag-label">주차</span><span class="tag-value">${escapeHtml(p.parking_fee).replace(/\n/g,'<br>')}</span></div>`:''}
                    ${p.entry_fee?`<div class="info-tag"><span class="tag-label">요금</span><span class="tag-value">${escapeHtml(p.entry_fee).replace(/\n/g,'<br>')}</span></div>`:''}
                </div>
                ${p.comment?`<div class="info-desc" style="margin-top:12px;">${escapeHtml(p.comment).replace(/\n/g,'<br>')}</div>`:''}
                <div class="comments-section">
                    <div class="comment-input-wrap" style="margin-bottom:12px;">
                        <input type="text" id="cmt-pw-${p.id}" placeholder="비밀번호" style="width:70px;padding:8px;border-radius:8px;border:1px solid #dee2e6;">
                        <textarea id="cmt-text-${p.id}" placeholder="댓글 입력"></textarea><button onclick="addComment(${p.id})">등록</button>
                    </div>
                    ${cArr.map(c=>`<div class="comment-item"><div style="display:flex;justify-content:space-between;color:#868e96;margin-bottom:4px;"><span>익명</span><button class="comment-delete" onclick="deleteComment(${p.id},${c.id})">삭제</button></div><div>${escapeHtml(c.text)}</div></div>`).join('')}
                </div>
            </div>
        </div>`;
    document.getElementById('info-content').classList.add('show');
}

function openEditModal(id){
    const p=placesData.find(x=>x.id===id);document.getElementById('edit-place-id').value=id;
    document.getElementById('edit-website').value=p.website_url||'';document.getElementById('edit-hours').value=p.business_hours||'';
    document.getElementById('edit-parking').value=p.parking_fee||'';document.getElementById('edit-entry').value=p.entry_fee||'';
    document.getElementById('edit-nursing').value=p.nursing_room||'';document.getElementById('edit-comment').value=p.comment||'';
    document.getElementById('edit-modal').style.display='flex';
}

async function submitEditInfo(){
    const id=document.getElementById('edit-place-id').value;const b=document.querySelector('#edit-modal .btn-save');b.innerText="요청중...";b.disabled=true;
    const pay={
        cat:document.querySelector('input[name="edit-place-category"]:checked')?.value,
        url:document.getElementById('edit-website').value, hours:document.getElementById('edit-hours').value,
        park:document.getElementById('edit-parking').value, entry:document.getElementById('edit-entry').value,
        nurse:document.getElementById('edit-nursing').value, comment:document.getElementById('edit-comment').value,
        imgs:await placeEditMediaManager.uploadAll()
    };
    const{error}=await supabaseClient.from('inquiries').insert([{content:`[장소수정요청 ID:${id}] ${JSON.stringify(pay)}`,contact_info:'시스템접수'}]);
    if(!error){alert("수정 요청이 접수되었습니다. 관리자 확인 후 반영됩니다.");document.getElementById('edit-modal').style.display='none';}
    b.innerText="수정 접수";b.disabled=false;
}

async function addComment(id){
    const pw=document.getElementById(`cmt-pw-${id}`).value, txt=document.getElementById(`cmt-text-${id}`).value;if(!pw||!txt)return alert('입력해주세요.');
    const p=placesData.find(x=>x.id===id);let c=p.comments_list?JSON.parse(p.comments_list):[];c.unshift({id:Date.now(),pw,text:txt});
    const s=JSON.stringify(c);await supabaseClient.from('places').update({comments_list:s}).eq('id',id);p.comments_list=s;renderPanel(id);
}
async function deleteComment(pid,cid){
    const pw=await askPassword();if(!pw)return;const p=placesData.find(x=>x.id===pid);let c=p.comments_list?JSON.parse(p.comments_list):[];
    const t=c.find(x=>x.id===cid);if(t&&t.pw===pw){c=c.filter(x=>x.id!==cid);const s=JSON.stringify(c);await supabaseClient.from('places').update({comments_list:s}).eq('id',pid);p.comments_list=s;renderPanel(pid);}else alert('비밀번호 오류');
}

// 게시판 등 나머지 기본 UI 로직 유지
function switchTab(t){if(t==='map'){document.getElementById('board-view').style.display='none';}else{document.getElementById('board-view').style.display='block';closePanel();}}
function openSearchPanel(){document.getElementById('search-panel').classList.add('show');}
function closeSearchPanel(){document.getElementById('search-panel').classList.remove('show');}
function openAddModal(){document.getElementById('add-modal').style.display='flex';}
async function submitInquiry(){const c=document.getElementById('inquiry-content').value;if(!c)return;await supabaseClient.from('inquiries').insert([{content:c}]);alert('접수 완료!');document.getElementById('inquiry-modal').style.display='none';}
async function loadNotices(){const{data}=await supabaseClient.from('notices').select('*');if(data){noticesData=data;const c=document.getElementById('notice-list-container');c.innerHTML=data.map(n=>`<div class="notice-card" onclick="showNoticeDetail(${n.id})"><div style="flex:1"><div style="font-size:11px;color:#adb5bd;">${n.is_notice?'[공지] ':''}${timeAgo(n.created_at)}</div><div style="font-weight:800;">${n.title}</div></div></div>`).join('');}}
function showNoticeDetail(id){const n=noticesData.find(x=>x.id===id);currentNoticeId=id;document.getElementById('notice-list-view').style.display='none';document.getElementById('notice-detail-view').style.display='flex';document.getElementById('detail-title').innerText=n.title;document.getElementById('detail-body').innerText=n.content;}
function showNoticeList(){document.getElementById('notice-list-view').style.display='block';document.getElementById('notice-detail-view').style.display='none';}
function openWriteNoticeModal(){document.getElementById('write-notice-modal').style.display='flex';}
async function saveNotice(){const t=document.getElementById('notice-title').value,c=document.getElementById('notice-content-text').value;if(!t)return;await supabaseClient.from('notices').insert([{title:t,content:c,is_notice:false}]);document.getElementById('write-notice-modal').style.display='none';loadNotices();}
async function deleteNotice(){const pw=await askPassword();const n=noticesData.find(x=>x.id===currentNoticeId);if(n&&n.pw===pw){await supabaseClient.from('notices').delete().eq('id',currentNoticeId);showNoticeList();loadNotices();}}
async function searchKakaoPlace(){
    const k=document.getElementById('kakao-keyword').value;if(!k)return;
    const r=await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(k)}`,{headers:{"Authorization":`KakaoAK ${KAKAO_REST_KEY}`}});
    const d=await r.json();const l=document.getElementById('kakao-result-list');l.innerHTML='';
    d.documents.forEach(x=>{const li=document.createElement('li');li.innerHTML=x.place_name;li.onclick=()=>{document.getElementById('place-name').value=x.place_name;selectedLat=x.y;selectedLng=x.x;l.style.display='none';};l.appendChild(li);});l.style.display='block';
}
async function savePlace(){const n=document.getElementById('place-name').value;if(!n)return;await supabaseClient.from('places').insert([{name:n,latitude:selectedLat,longitude:selectedLng,is_approved:false}]);alert('승인 요청됨');document.getElementById('add-modal').style.display='none';}
function moveToCurrentLocation(){map.setCenter(new naver.maps.LatLng(userLat,userLng));}

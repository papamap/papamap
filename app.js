function renderPanel(id) {
    const nav = document.getElementById('category-nav') || document.querySelector('.category-nav');
    if(nav) nav.style.display = 'none'; 
    const ws = document.getElementById('weather-suggestion');
    if(ws) ws.style.display = 'none';

    const place = placesData.find(p => p.id === id); if (!place) return;
    incrementViewCount(id); 

    let commentsArr = place.comments_list ? JSON.parse(place.comments_list) : [];
    let visibleComments = commentsArr.map((c, idx) => {
        let dateStr = timeAgo(c.date || c.id); 
        return `<div class="comment-item cmt-item-${place.id}" style="display: ${idx < 3 ? 'flex' : 'none'}; flex-direction:column; background:rgba(255,255,255,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); margin-bottom:8px; font-size:12px; line-height:1.5;"><div class="comment-header" style="display:flex; justify-content:space-between; margin-bottom:6px;"><div class="c-author" style="font-weight:800;">${escapeHtml(c.author)} <span style="font-weight:400; color:#868e96; margin-left:4px; font-size:10px;">${dateStr}</span></div><div style="display:flex; align-items:center; gap:8px;"><button class="comment-delete" onclick="editComment(${place.id}, ${c.id})" style="background:none; border:none; color:#adb5bd; cursor:pointer; font-size:11px; padding:0; font-family:inherit;">수정</button><button class="comment-delete" onclick="deleteComment(${place.id}, ${c.id})" style="background:none; border:none; color:#adb5bd; cursor:pointer; font-size:11px; padding:0; font-family:inherit;">삭제</button></div></div><div style="word-break:break-all;">${formatDescription(c.text)}</div></div>`
    }).join('');
    
    let moreBtn = commentsArr.length > 3 ? `<button id="btn-more-${place.id}" onclick="showMoreComments(${place.id})" style="background:none; border:none; color:#adb5bd; font-size:12px; font-weight:700; cursor:pointer; padding:8px 0; width:100%; text-align:center; font-family:inherit;">추가정보 더보기 ▼</button>` : '';
    let urls = place.image_url ? place.image_url.split(',') : []; 
    let isHasImage = urls.length > 0;
    let catColor = normalizeCat(place.category) === '야외' ? '#0ca678' : (place.category === '문센' ? '#f59f00' : '#5c7cfa');

    let dist = getDistanceKm(userLat, userLng, place.latitude, place.longitude);
    let distStr = dist < 1 ? Math.round(dist * 1000) + 'm' : dist.toFixed(1) + 'km';

    const panel = document.getElementById('info-content');
    panel.dataset.placeId = place.id;
    
    panel.style.background = 'rgba(255, 255, 255, 0.75)';
    panel.style.backdropFilter = 'blur(20px)';
    panel.style.webkitBackdropFilter = 'blur(20px)';
    panel.style.boxShadow = '0 4px 24px rgba(0,0,0,0.1)';
    
    panel.innerHTML = `
        <div style="width:100%; display:flex; flex-direction:column; background:transparent; padding-bottom:4px; flex-shrink:0; z-index:110;">
            <div style="width:100%; height:20px; display:${isMobile ? 'flex' : 'none'}; justify-content:center; align-items:center; cursor:grab; touch-action:none;">
                <div style="width:36px; height:4px; background:rgba(0,0,0,0.1); border-radius:2px;"></div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%; box-sizing:border-box; padding: ${isMobile ? '8px' : '24px'} 20px 0 26px;">
                <div style="flex:1; min-width:0; display:flex; flex-direction:column; align-items:flex-start;">
                    <div style="font-size:11px; font-weight:800; color:${catColor}; margin-bottom:6px;">${normalizeCat(place.category)}</div>
                    <div id="title-wrap-${place.id}" style="width:100%; overflow:hidden; white-space:nowrap; position:relative;">
                        <div class="info-title" id="dyn-title-${place.id}" style="font-size:22px; font-weight:800; color:#212529; display:inline-block;">${place.name}</div>
                    </div>
                </div>
                
                <div style="display:flex; gap:8px; flex-shrink:0; margin-left:12px; margin-top:-2px;">
                    <button class="icon-btn" onclick="openEditModal(${place.id})" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center; font-size:12px;">✏️</button>
                    <button class="icon-btn" onclick="sharePlace('${place.name.replace(/'/g, "\\'")}', '')" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center;">${shareIcon}</button>
                    <button class="icon-btn" onclick="closePanel()" style="width:32px; height:32px; border-radius:50%; background:rgba(0,0,0,0.04); border:none; cursor:pointer; display:flex; justify-content:center; align-items:center; font-size:14px; font-weight:800;">✕</button>
                </div>
            </div>
        </div>

        <div class="info-scroll-area" id="scroll-area-${place.id}" style="flex:1; overflow-y:auto; overflow-x:hidden; width:100%; display:flex; flex-direction:column; -webkit-overflow-scrolling:touch; background:transparent;">
            <div class="info-body-wrap" style="padding: 0 20px 30px 26px; height:auto; display:flex; flex-direction:column;">
                
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;">
                    <div style="font-size:12px; color:#495057; font-weight:700;">${distStr}</div>
                    <div style="width:1px; height:10px; background:#dee2e6;"></div>
                    <div style="font-size:12px; color:#868e96; cursor:pointer;" onclick="openMapPopup('${place.name.replace(/'/g, "\\'")}', ${place.latitude}, ${place.longitude})">${place.address}</div>
                    ${place.website_url ? `<a href="${place.website_url}" target="_blank" class="chip" style="display:inline-flex; align-items:center; padding: 4px 8px; background: rgba(241, 243, 245, 0.8); border-radius:8px; font-size:10px; font-weight:700; color:#495057; text-decoration:none; margin-left:4px;">🌐 공식홈</a>` : ''}
                </div>

                <div id="header-wrap-${place.id}" style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#f1f3f5; margin-bottom:16px; ${isHasImage ? '' : 'display:none;'}">
                    <div class="image-slider" id="slider-${place.id}" style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; cursor:grab; height:200px;" 
                        onscroll="updateSliderDots(${place.id}, this)"
                        onmousedown="startImgDrag(event, this)" 
                        onmouseleave="stopImgDrag(event, this)" 
                        onmouseup="stopImgDrag(event, this)" 
                        onmousemove="doImgDrag(event, this)">
                        ${isHasImage ? urls.map(url => `<img src="${url}" style="flex:0 0 100%; width:100%; height:100%; object-fit:cover; scroll-snap-align:center; display:block; pointer-events:none;" draggable="false">`).join('') : ''}
                    </div>
                    ${urls.length > 1 ? `<div class="slider-dots" id="slider-dots-${place.id}" style="position:absolute; bottom:8px; left:0; right:0; display:flex; justify-content:center; gap:6px;">${urls.map((_, i) => `<div class="slider-dot ${i===0?'active':''}" style="width:6px; height:6px; border-radius:50%; background:rgba(255,255,255,0.5);"></div>`).join('')}</div>` : ''}
                </div>

                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${place.seoul_api_area ? `
                    <div id="live-congest-wrap-${place.id}" style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; flex-direction:column; font-size:12px; color:#495057;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div style="display:flex; align-items:center;">
                                <span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0;">혼잡도</span>
                                <span id="live-congest-cur-${place.id}" style="font-weight:800; color:#adb5bd;">데이터 로딩중... ⏳</span>
                            </div>
                            <button id="btn-congest-toggle-${place.id}" onclick="toggleLiveDetail('congest-detail-${place.id}', this)" style="display:none; background:none; border:none; font-size:11px; color:#adb5bd; font-weight:700; cursor:pointer; padding:0; transition:0.2s;">예측 보기 ▼</button>
                        </div>
                        <div id="congest-detail-${place.id}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(0,0,0,0.08); font-size:11px;">
                            </div>
                    </div>` : ''}
                    
                    ${place.business_hours ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">시간</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.business_hours).replace(/\n/g, '<br>')}</span></div>` : ''}
                    
                    ${place.parking_fee || place.seoul_api_area ? `
                    <div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; flex-direction:column; font-size:12px; color:#495057;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div style="display:flex; flex:1;">
                                <span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">주차</span>
                                <span style="flex:1; line-height:1.5;">${escapeHtml(place.parking_fee || '요금 정보 없음').replace(/\n/g, '<br>')}</span>
                            </div>
                            ${place.seoul_api_area ? `<button id="btn-park-toggle-${place.id}" onclick="toggleLiveDetail('live-park-${place.id}', this)" style="display:none; background:rgba(55,178,77,0.1); border:1px solid #37B24D; color:#37B24D; border-radius:6px; font-size:10px; font-weight:800; cursor:pointer; padding:4px 8px; margin-left:8px; flex-shrink:0; transition:0.2s;">실시간 현황 ▼</button>` : ''}
                        </div>
                        <div id="live-park-${place.id}" style="display:none; margin-top:10px; padding-top:10px; border-top:1px dashed rgba(0,0,0,0.08); flex-direction:column; gap:6px;">
                            </div>
                    </div>` : ''}
                    
                    ${place.entry_fee ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">입장료</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.entry_fee).replace(/\n/g, '<br>')}</span></div>` : ''}
                    ${place.nursing_room ? `<div style="background:rgba(255,255,255,0.6); border:1px solid rgba(0,0,0,0.05); padding:10px 12px; border-radius:12px; display:flex; font-size:12px; color:#495057;"><span style="color:#868e96; font-weight:800; font-size:11px; width:40px; flex-shrink:0; margin-top:2px;">수유실</span><span style="flex:1; line-height:1.5;">${escapeHtml(place.nursing_room).replace(/\n/g, '<br>')}</span></div>` : ''}
                </div>

                ${place.comment ? `<div style="font-size:13px; color:#495057; line-height:1.5; margin-top:16px; background:rgba(248,249,250,0.6); padding:12px; border-radius:12px; border:1px solid rgba(0,0,0,0.05); word-break:break-all;">${formatDescription(place.comment)}</div>` : ''}
                
                <div style="border-top:1px solid rgba(0,0,0,0.08); padding-top:16px; margin-top:20px; display:flex; flex-direction:column;">
                    <div style="display:flex; gap:6px; margin-bottom:6px; width:100%; box-sizing:border-box;">
                        <input type="text" id="cmt-author-${place.id}" placeholder="닉네임" style="flex:1; min-width:0; padding:8px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; font-family:inherit;">
                        <input type="password" id="cmt-pw-${place.id}" placeholder="비밀번호" style="flex:1; min-width:0; padding:8px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; font-family:inherit;">
                    </div>
                    <div style="display:flex; gap:6px; width:100%; box-sizing:border-box; height:38px; margin-bottom:16px;">
                        <textarea id="cmt-text-${place.id}" placeholder="댓글을 남겨주세요" rows="1" style="flex:1; min-width:0; padding:10px; border:1px solid rgba(0,0,0,0.1); border-radius:8px; font-size:12px; background:rgba(255,255,255,0.6); outline:none; resize:none; line-height:1.4; font-family:inherit;"></textarea>
                        <button onclick="addComment(${place.id})" style="height:100%; background:#495057; color:white; border:none; border-radius:8px; padding:0 16px; font-weight:700; font-size:12px; cursor:pointer; flex-shrink:0; font-family:inherit;">등록</button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px;">${visibleComments}${moreBtn}</div>
                </div>
            </div>
        </div>
    `;

    panel.classList.add('show');
    if (isMobile) { sheetState = 1; window.applySheetState(); } 
    else { panel.style.transform = 'translateX(0)'; }

    setTimeout(() => {
        const titleWrap = document.getElementById(`title-wrap-${place.id}`); 
        const titleEl = document.getElementById(`dyn-title-${place.id}`);
        if(titleEl && titleWrap && titleEl.scrollWidth > titleWrap.clientWidth) { 
            const originalHTML = titleEl.innerHTML; 
            titleEl.innerHTML = originalHTML + "<span style='display:inline-block; width:40px;'></span>" + originalHTML; 
            titleWrap.style.webkitMaskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; 
            titleWrap.style.maskImage = 'linear-gradient(to right, black 85%, transparent 100%)'; 
            titleEl.classList.add('marquee'); 
        }
    }, 50);

    if(!isHasImage && place.category !== '문센') {
        fetchKakaoImage(place.name, `img-${place.id}`, null, `slider-${place.id}`, `header-wrap-${place.id}`); 
    }

    // 🔥 API 데이터 호출!
    if(place.seoul_api_area) {
        fetchSeoulApiData(place.seoul_api_area, place.id);
    }
}

// 🔥 API 통신 함수 (HTTPS 깨짐 우회)
async function fetchSeoulApiData(areaName, placeId) {
    const congestCur = document.getElementById(`live-congest-cur-${placeId}`);
    const congestDetail = document.getElementById(`congest-detail-${placeId}`);
    const congestBtn = document.getElementById(`btn-congest-toggle-${placeId}`);
    
    const parkBox = document.getElementById(`live-park-${placeId}`);
    const parkBtn = document.getElementById(`btn-park-toggle-${placeId}`);
    
    try {
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(areaName)}`;
        const fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

        const res = await fetch(fetchUrl);
        const data = await res.json();
        
        if(data.CITYDATA) {
            const cd = data.CITYDATA;
            
            // 1. 혼잡도 적용
            if(cd.LIVE_PPLTN_STTS && cd.LIVE_PPLTN_STTS.length > 0) {
                const pop = cd.LIVE_PPLTN_STTS[0];
                let cur = pop.AREA_CONGEST_LVL;
                if(congestCur) congestCur.innerHTML = `<span style="color:${getCongestColor(cur)};">${cur}</span>`;
                
                let fcst = pop.FCST_PPLTN || [];
                if(fcst.length > 3 && congestDetail && congestBtn) {
                    let f2 = fcst[1]; 
                    let f4 = fcst[3];
                    let t2 = f2.FCST_TIME.split(' ')[1]; 
                    let t4 = f4.FCST_TIME.split(' ')[1];
                    
                    congestDetail.innerHTML = `
                        <div style="display:flex; gap:16px;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="color:#adb5bd;">${t2} 예측</span>
                                <strong style="color:${getCongestColor(f2.FCST_CONGEST_LVL)}">${f2.FCST_CONGEST_LVL}</strong>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="color:#adb5bd;">${t4} 예측</span>
                                <strong style="color:${getCongestColor(f4.FCST_CONGEST_LVL)}">${f4.FCST_CONGEST_LVL}</strong>
                            </div>
                        </div>
                    `;
                    congestBtn.style.display = 'block';
                }
            } else {
                if(congestCur) congestCur.innerHTML = `<span style="color:#FF6B6B;">정보 없음</span>`;
            }

            // 2. 주차장 적용
            const validPrk = (cd.PRK_STTS || []).filter(p => p.CUR_PRK_CNT !== "" && p.CUR_PRK_CNT !== undefined && p.CUR_PRK_CNT !== null);
            if(validPrk.length > 0) {
                let totalRemain = 0;
                let prkHtml = validPrk.map(p => {
                    let remain = Math.max((parseInt(p.CPCTY) || 0) - (parseInt(p.CUR_PRK_CNT) || 0), 0);
                    totalRemain += remain;
                    return `<div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="color:#495057; font-weight:600; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.PRK_NM}</span>
                        <span style="color:#37B24D; font-weight:800; font-size:11px; flex-shrink:0; margin-left:8px;">${remain}대 여유 <span style="color:#adb5bd; font-weight:500;">/${p.CPCTY}</span></span>
                    </div>`;
                }).join('');
                
                if(parkBox && parkBtn) { 
                    parkBox.innerHTML = prkHtml; 
                    parkBtn.style.display = 'block'; 
                    parkBtn.innerHTML = `🚗 총 ${totalRemain}대 여유 ▼`; 
                }
            }
        } else if (data.RESULT) {
             if(congestCur) congestCur.innerHTML = `<span style="color:#FF6B6B;">오류: ${data.RESULT.MESSAGE}</span>`;
        }
    } catch(e) { 
        console.error(e); 
        if(congestCur) congestCur.innerHTML = `<span style="color:#FF6B6B;">통신 지연 (새로고침 요망)</span>`;
    }
}

// 🔥 토글 애니메이션 함수
function toggleLiveDetail(targetId, btnEl) {
    const el = document.getElementById(targetId);
    if(!el) return;
    
    if(el.style.display === 'none' || el.style.display === '') {
        el.style.display = 'flex';
        btnEl.innerHTML = btnEl.innerHTML.replace('▼', '▲');
        btnEl.style.color = '#495057';
    } else {
        el.style.display = 'none';
        btnEl.innerHTML = btnEl.innerHTML.replace('▲', '▼');
        if(btnEl.innerText.includes('예측')) btnEl.style.color = '#adb5bd';
        else btnEl.style.color = '#37B24D';
    }
}

function getCongestColor(lvl) {
    if(lvl === '여유') return '#37B24D';
    if(lvl === '보통') return '#f59f00';
    if(lvl === '약간 혼잡') return '#FF6B6B';
    if(lvl === '혼잡') return '#e03131';
    return '#495057';
}

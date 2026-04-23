// 아빠맵 내 장소 혼잡도, 주차 현황은 10분마다 호출. 대시보드 내 행사정보는 720분마다 호출
const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";

export default async function handler(req, res) {
    const { area, maxAge } = req.query;
    if (!area) return res.status(400).json({ error: "area is required" });

    // 전달받은 시간이 없으면 기본 10분(사용자용)으로 설정
    const requestedMaxAgeMinutes = parseInt(maxAge) || 10;
    const cacheTTL = requestedMaxAgeMinutes * 60 * 1000; 

    try {
        // 1. 수퍼베이스 캐시 조회 (라이브러리 없이 순수 fetch로 직접 호출!)
        const supaSelectUrl = `${SUPABASE_URL}/rest/v1/seoul_api_cache?area_name=eq.${encodeURIComponent(area)}&select=*`;
        const supaRes = await fetch(supaSelectUrl, {
            headers: {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });
        const supaData = await supaRes.json();
        
        // 데이터가 배열로 오므로 첫 번째 항목 추출
        const cacheData = (supaData && supaData.length > 0) ? supaData[0] : null;

        // 2. 캐시가 있고 설정한 시간이 안 지났으면 바로 반환
        if (cacheData && (new Date() - new Date(cacheData.updated_at) < cacheTTL)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(cacheData.content);
        }

        // 3. 캐시가 없거나 만료되었다면 서울시 API 직접 호출
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(area)}`;
        const response = await fetch(targetUrl);
        const newData = await response.json();

        // 4. 수퍼베이스 업데이트 (UPSERT 기능 - 있으면 덮어쓰고 없으면 새로 생성)
        if (newData.CITYDATA) {
            const supaUpsertUrl = `${SUPABASE_URL}/rest/v1/seoul_api_cache`;
            await fetch(supaUpsertUrl, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates' // 중복 시 덮어쓰기 옵션
                },
                body: JSON.stringify({
                    area_name: area,
                    content: newData,
                    updated_at: new Date().toISOString()
                })
            });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(newData);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

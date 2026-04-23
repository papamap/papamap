import { createClient } from '@supabase/supabase-js'

// 수퍼베이스 접속 정보 (기존 app.js에 있던 정보와 동일해야 합니다)
const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    const { area } = req.query;
    if (!area) return res.status(400).json({ error: "area is required" });

    try {
        // 1. 수퍼베이스 캐시에서 먼저 찾기
        const { data: cacheData } = await supabase
            .from('seoul_api_cache')
            .select('*')
            .eq('area_name', area)
            .single();

        // 2. 캐시가 있고 10분이 안 지났으면 바로 반환 (600,000ms = 10분)
        if (cacheData && (new Date() - new Date(cacheData.updated_at) < 600000)) {
            console.log(`[Cache Hit] Serving from Supabase: ${area}`);
            return res.status(200).json(cacheData.content);
        }

        // 3. 캐시가 없거나 10분이 지났으면 서울시 API 호출
        console.log(`[Cache Miss] Calling Seoul API: ${area}`);
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(area)}`;
        const response = await fetch(targetUrl);
        const newData = await response.json();

        if (newData.CITYDATA) {
            // 4. 수퍼베이스에 최신 데이터 저장 (있으면 업데이트, 없으면 새로 작성)
            await supabase
                .from('seoul_api_cache')
                .upsert({ 
                    area_name: area, 
                    content: newData, 
                    updated_at: new Date().toISOString() 
                });
        }

        // 통신 허용 설정 (CORS)
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(newData);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

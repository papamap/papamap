// 아빠맵 내 장소 혼잡도, 주차 현황은 10분마다 호출. 대시보드 내 행사정보는 720분마다 호출

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    const { area, maxAge } = req.query; // maxAge: 분 단위 (예: 10 또는 720)
    if (!area) return res.status(400).json({ error: "area is required" });

    // 허용 시간 설정 (기본값 10분, 전달받으면 해당 시간 적용)
    const requestedMaxAgeMinutes = parseInt(maxAge) || 10;
    const cacheTTL = requestedMaxAgeMinutes * 60 * 1000; 

    try {
        // 1. 수퍼베이스 캐시 확인
        const { data: cacheData } = await supabase
            .from('seoul_api_cache')
            .select('*')
            .eq('area_name', area)
            .single();

        // 2. 캐시가 있고 요청한 시간 이내라면 즉시 반환
        if (cacheData && (new Date() - new Date(cacheData.updated_at) < cacheTTL)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(cacheData.content);
        }

        // 3. 캐시가 없거나 너무 오래됐다면 서울시 API 호출
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(area)}`;
        const response = await fetch(targetUrl);
        const newData = await response.json();

        if (newData.CITYDATA) {
            // 4. 수퍼베이스 캐시 테이블 업데이트
            await supabase
                .from('seoul_api_cache')
                .upsert({ 
                    area_name: area, 
                    content: newData, 
                    updated_at: new Date().toISOString() 
                });
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json(newData);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

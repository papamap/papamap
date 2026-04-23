// 아빠맵 내 장소 혼잡도, 주차 현황은 10분마다 호출. 대시보드 내 행사정보는 720분마다 호출
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    const { area, maxAge } = req.query;
    if (!area) return res.status(400).json({ error: "area is required" });

    // 전달받은 시간이 없으면 기본 10분(사용자용)으로 설정
    const requestedMaxAgeMinutes = parseInt(maxAge) || 10;
    const cacheTTL = requestedMaxAgeMinutes * 60 * 1000; 

    try {
        const { data: cacheData } = await supabase
            .from('seoul_api_cache')
            .select('*')
            .eq('area_name', area)
            .single();

        // 캐시가 있고 설정한 시간(10분 or 12시간)이 안 지났으면 바로 반환
        if (cacheData && (new Date() - new Date(cacheData.updated_at) < cacheTTL)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(cacheData.content);
        }

        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(area)}`;
        const response = await fetch(targetUrl);
        const newData = await response.json();

        if (newData.CITYDATA) {
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

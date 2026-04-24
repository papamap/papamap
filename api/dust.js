const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";

const DUST_API_KEY = "de88a8d868e33a64691c09c94cd37c2dafa3ea9c370a61bc780a54676221e4dd";

export default async function handler(req, res) {
    const sidoName = "서울"; // 서울시 전체 데이터를 한 번에 가져옴
    const cacheTTL = 30 * 60 * 1000; // 🔥 30분 캐싱 (하루 48회만 호출됨)

    try {
        // 1. 수퍼베이스 캐시 조회 (순수 fetch)
        const supaSelectUrl = `${SUPABASE_URL}/rest/v1/dust_api_cache?sido_name=eq.${encodeURIComponent(sidoName)}&select=*`;
        const supaRes = await fetch(supaSelectUrl, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        const supaData = await supaRes.json();
        const cacheData = (supaData && supaData.length > 0) ? supaData[0] : null;

        // 2. 캐시가 30분 이내면 바로 반환 (트래픽 아낌)
        if (cacheData && (new Date() - new Date(cacheData.updated_at) < cacheTTL)) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            return res.status(200).json(cacheData.content);
        }

        // 3. 캐시가 낡았다면 에어코리아(공공데이터포털) API 1회 호출
        // '시도별 실시간 측정정보 조회' API 사용
        const targetUrl = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${DUST_API_KEY}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.0`;
        const response = await fetch(targetUrl);
        const newData = await response.json();

        // 4. 수퍼베이스에 최신 데이터 덮어쓰기
        if (newData.response && newData.response.header.resultCode === "00") {
            const supaUpsertUrl = `${SUPABASE_URL}/rest/v1/dust_api_cache`;
            await fetch(supaUpsertUrl, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    sido_name: sidoName,
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

const SUPABASE_URL = "https://jmeqvmmabgcdsuvabpgp.supabase.co";
const SUPABASE_KEY = "sb_publishable_tpw_7GUMBP3iYiZ-EPLaNw_3u-gjX_B";

// 🔥 팀원님의 공공데이터포털 일반 인증키(Encoding)와 카카오 REST 키를 넣으세요!
const DUST_API_KEY = "발급받은_인코딩_인증키를_여기에_붙여넣으세요";
const KAKAO_REST_KEY = "f971a5a1cc6ae49cf691f170f5e03dfd"; 

// 카카오 1depth 지역명을 에어코리아 규격으로 변환하는 사전
const SIDO_MAP = {
    "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
    "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
    "경기도": "경기", "강원특별자치도": "강원", "강원도": "강원", "충청북도": "충북", "충청남도": "충남",
    "전라북도": "전북", "전북특별자치도": "전북", "전라남도": "전남", "경상북도": "경북", "경상남도": "경남",
    "제주특별자치도": "제주"
};

export default async function handler(req, res) {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "lat and lng are required" });

    try {
        // 1. 카카오 API로 유저 좌표를 행정구역명으로 변환
        const kakaoUrl = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
        const kakaoRes = await fetch(kakaoUrl, { headers: { "Authorization": `KakaoAK ${KAKAO_REST_KEY}` } });
        const kakaoData = await kakaoRes.json();
        
        let regionName = "서울특별시"; // 기본값
        if (kakaoData.documents && kakaoData.documents.length > 0) {
            regionName = kakaoData.documents[0].address.region_1depth_name;
        }
        const sidoName = SIDO_MAP[regionName] || "서울";

        // 2. 수퍼베이스 캐시 확인 (30분 TTL)
        const cacheTTL = 30 * 60 * 1000;
        const supaSelectUrl = `${SUPABASE_URL}/rest/v1/dust_api_cache?sido_name=eq.${encodeURIComponent(sidoName)}&select=*`;
        const supaRes = await fetch(supaSelectUrl, { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } });
        const supaData = await supaRes.json();
        let cityData = (supaData && supaData.length > 0) ? supaData[0].content : null;
        let isCacheValid = supaData && supaData.length > 0 && (new Date() - new Date(supaData[0].updated_at) < cacheTTL);

        // 3. 캐시가 없거나 낡았으면 에어코리아 API 호출 후 수퍼베이스 갱신
        if (!isCacheValid) {
            const targetUrl = `http://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${DUST_API_KEY}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(sidoName)}&ver=1.0`;
            const response = await fetch(targetUrl);
            cityData = await response.json();

            if (cityData.response && cityData.response.header.resultCode === "00") {
                await fetch(`${SUPABASE_URL}/rest/v1/dust_api_cache`, {
                    method: 'POST',
                    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
                    body: JSON.stringify({ sido_name: sidoName, content: cityData, updated_at: new Date().toISOString() })
                });
            }
        }

        // 4. Vercel 서버에서 미세먼지 평균값 계산 (프론트엔드 연산 부하 및 트래픽 99% 감소)
        let aqiText = '보통'; let isBadAir = false; 
        if (cityData && cityData.response && cityData.response.body && cityData.response.body.items) {
            const items = cityData.response.body.items;
            let totalPm10 = 0, validCount10 = 0, totalPm25 = 0, validCount25 = 0;
            
            items.forEach(item => {
                if (item.pm10Value && item.pm10Value !== '-') { totalPm10 += parseInt(item.pm10Value); validCount10++; }
                if (item.pm25Value && item.pm25Value !== '-') { totalPm25 += parseInt(item.pm25Value); validCount25++; }
            });

            let avgPm10 = validCount10 > 0 ? (totalPm10 / validCount10) : 0;
            let avgPm25 = validCount25 > 0 ? (totalPm25 / validCount25) : 0;

            if (avgPm10 > 150 || avgPm25 > 75) { aqiText = '매우나쁨'; isBadAir = true; } 
            else if (avgPm10 > 80 || avgPm25 > 35) { aqiText = '나쁨'; isBadAir = true; } 
            else if (avgPm10 > 30 || avgPm25 > 15) { aqiText = '보통'; }
            else { aqiText = '좋음'; }
        }

        // 5. 프론트엔드로는 초경량 결과값 단 한 줄만 전송!
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ sido: sidoName, aqiText: aqiText, isBadAir: isBadAir });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

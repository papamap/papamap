export default async function handler(req, res) {
    const { area } = req.query;

    if (!area) {
        return res.status(400).json({ error: "지역명이 필요합니다." });
    }

    try {
        // Vercel 서버가 직접 서울시 API를 호출합니다. (CORS, HTTPS 에러 없음)
        const targetUrl = `http://openapi.seoul.go.kr:8088/56626e5978657069383851734d4d66/json/citydata/1/5/${encodeURIComponent(area)}`;
        
        const response = await fetch(targetUrl);
        const data = await response.json();

        // 아빠맵 프론트엔드로 안전하게 데이터를 보내줍니다.
        res.setHeader('Access-Control-Allow-Credentials', true);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
        
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "서버 통신 오류", details: error.message });
    }
}

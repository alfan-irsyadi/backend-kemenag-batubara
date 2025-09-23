const cors = require("cors");

const allowedOrigins = [
    "http://localhost:5173",
    "https://kemenag-batubara.vercel.app",
    "https://backend-kemenag-batubara.vercel.app"
];

const corsMiddleware = cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            const isAllowed = allowedOrigins.some(allowedOrigin => 
                origin.endsWith(allowedOrigin.replace("https://", "").replace("http://", ""))
            );
            if (isAllowed) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
});

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method === 'GET') {
        res.status(200).json({
            success: true,
            message: "API Berhasil",
            endpoints: [
                "/api/data - GET data kepegawaian",
                "/api/tilok - GET data tilok", 
                "/api/search?keyword=your_keyword - GET pencarian berita"
            ],
            status: "active",
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(405).json({ 
            success: false,
            error: "Method not allowed" 
        });
    }
};
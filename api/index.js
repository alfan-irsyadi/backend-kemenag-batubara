import cors from "cors";

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

export default async function handler(req, res) {
    // Apply CORS middleware
    await new Promise((resolve, reject) => {
        corsMiddleware(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    });

    if (req.method === 'GET') {
        res.status(200).json({
            message: "API Berhasil",
            endpoints: [
                "/api/data - GET data kepegawaian",
                "/api/tilok - GET data tilok", 
                "/api/search?keyword=your_keyword - GET pencarian berita"
            ],
            status: "active 2"
        });
    } else {
        res.status(405).json({ error: "Method not allowed" });
    }
}
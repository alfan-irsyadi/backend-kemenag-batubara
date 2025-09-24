const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  "https://kemenag-batubara.vercel.app",
  "https://backend-kemenag-batubara.vercel.app" // Include if backend makes self-requests
];

const corsMiddleware = cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
});

module.exports = async function handler(req, res) {
  // Apply CORS middleware
  return corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method === "GET") {
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
  });
};
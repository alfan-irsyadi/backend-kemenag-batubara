const fs = require("fs");
const papa = require("papaparse");
const path = require("path");
const cors = require("cors");

const allowedOrigins = [
  "http://localhost:5173",
  "https://kemenag-batubara.vercel.app",
  "https://backend-kemenag-batubara.vercel.app"
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

let cachedData = null;
let lastModified = null;

module.exports = async function handler(req, res) {
  return corsMiddleware(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    try {
      const filePath = path.join(process.cwd(), "data", "data_kepeg.csv");

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Data file not found" });
      }

      const stats = fs.statSync(filePath);
      if (!cachedData || !lastModified || stats.mtime > lastModified) {
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed_data = papa.parse(fileContent, { header: true, skipEmptyLines: true });
        cachedData = parsed_data.data;
        lastModified = stats.mtime;
      }

      res.status(200).json({
        success: true,
        data: cachedData,
        meta: {
          totalRecords: cachedData.length,
          lastModified: lastModified.toISOString(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error reading CSV file:", error);
      res.status(500).json({
        success: false,
        error: "Failed to read data file",
        details: error.message,
      });
    }
  });
};
const fs = require("fs");
const papa = require("papaparse");
const path = require("path");
const cors = require("cors");

const allowedOrigins = [
    "https://kemenag-batubara.vercel.app",
    "http://localhost:5173"
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

// Cache the parsed data to avoid reading file on every request
let cachedData = null;
let lastModified = null;

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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        const filePath = path.join(process.cwd(), 'data', 'data_kepeg.csv');
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Data file not found" });
        }

        // Check if file has been modified
        const stats = fs.statSync(filePath);
        if (!cachedData || !lastModified || stats.mtime > lastModified) {
            const fileContent = fs.readFileSync(filePath, "utf-8");
            const parsed_data = papa.parse(fileContent, { header: true, skipEmptyLines: true });
            cachedData = parsed_data.data; // Store only the data array
            lastModified = stats.mtime;
        }

        res.status(200).json({
            success: true,
            data: cachedData,
            meta: {
                totalRecords: cachedData.length,
                lastModified: lastModified.toISOString(),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Error reading CSV file:", error);
        res.status(500).json({ 
            success: false,
            error: "Failed to read data file",
            details: error.message 
        });
    }
};
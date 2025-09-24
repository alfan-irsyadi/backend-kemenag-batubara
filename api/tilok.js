// File: api/tilok.js
const fs = require("fs");
const papa = require("papaparse");
const path = require("path");
const cors = require("cors");

const allowedOrigins = [
    "http://localhost:5173",
    "https://kemenag-batubara.vercel.app",
    "https://backend-kemenag-batubara.vercel.app"
];

// Gunakan CORS dengan konfigurasi yang lebih sederhana
const corsMiddleware = cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Check if origin is in allowed origins
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            // Also allow subdomains of your main domains
            const isSubdomainAllowed = allowedOrigins.some(allowedOrigin => {
                return origin.endsWith(new URL(allowedOrigin).hostname);
            });
            
            if (isSubdomainAllowed) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
});

// Cache the parsed data
let cachedTilokData = null;
let tilokLastModified = null;

module.exports = async function handler(req, res) {
    // Terapkan CORS middleware
    corsMiddleware(req, res, async () => {
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ error: "Method not allowed" });
        }

        try {
            const filePath = path.join(process.cwd(), 'data', 'tilok.csv');
            
            if (!fs.existsSync(filePath)) {
                return res.status(404).json({ 
                    success: false,
                    error: "Tilok file not found" 
                });
            }

            // Check if file has been modified
            const stats = fs.statSync(filePath);
            if (!cachedTilokData || !tilokLastModified || stats.mtime > tilokLastModified) {
                const fileContent = fs.readFileSync(filePath, "utf-8");
                const parsed_data = papa.parse(fileContent, { header: true, skipEmptyLines: true });
                cachedTilokData = parsed_data.data;
                tilokLastModified = stats.mtime;
            }

            res.status(200).json({
                success: true,
                data: cachedTilokData,
                meta: {
                    totalRecords: cachedTilokData.length,
                    lastModified: tilokLastModified.toISOString(),
                    timestamp: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error("Error reading tilok file:", error);
            res.status(500).json({ 
                success: false,
                error: "Failed to read tilok file",
                details: error.message 
            });
        }
    });
};
import fs from "fs";
import papa from "papaparse";
import path from "path";
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

    if (req.method !== 'GET') {
        return res.status(405).json({ error: "Method not allowed" });
    }

    try {
        // For Vercel, files are in the same directory
        const filePath = path.join(process.cwd(), 'api', 'data_kepeg.csv');
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "Data file not found" });
        }

        const fileContent = fs.readFileSync(filePath, "utf-8");
        const parsed_data = papa.parse(fileContent, { header: true });
        
        res.json(parsed_data);
    } catch (error) {
        console.error("Error reading CSV file:", error);
        res.status(500).json({ error: "Failed to read data file" });
    }
}
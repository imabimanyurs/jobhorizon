import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import fs from "fs";

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
    : path.resolve(process.cwd(), "..", "data");
const DB_PATH = path.join(DATA_DIR, "jobs.db");

function getWriteDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");

    // Create visitors table if it doesn't exist
    db.exec(`
        CREATE TABLE IF NOT EXISTS visitors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fingerprint TEXT UNIQUE NOT NULL,
            first_visit TEXT NOT NULL,
            last_visit TEXT NOT NULL
        )
    `);
    return db;
}

function hashFingerprint(ip: string, ua: string): string {
    return crypto.createHash("sha256").update(`${ip}||${ua}`).digest("hex").slice(0, 32);
}

export async function POST(request: NextRequest) {
    try {
        const ip = request.headers.get("x-forwarded-for")
            || request.headers.get("x-real-ip")
            || "unknown";
        const ua = request.headers.get("user-agent") || "unknown";
        const fingerprint = hashFingerprint(ip, ua);
        const now = new Date().toISOString();

        const db = getWriteDb();

        // Try to insert new visitor, ignore if already exists
        const insertResult = db.prepare(
            "INSERT OR IGNORE INTO visitors (fingerprint, first_visit, last_visit) VALUES (?, ?, ?)"
        ).run(fingerprint, now, now);

        // Update last_visit for existing visitors
        if (insertResult.changes === 0) {
            db.prepare(
                "UPDATE visitors SET last_visit = ? WHERE fingerprint = ?"
            ).run(now, fingerprint);
        }

        // Get total unique visitors
        const count = (db.prepare("SELECT COUNT(*) as cnt FROM visitors").get() as { cnt: number }).cnt;

        db.close();
        return NextResponse.json({
            count,
            is_new: insertResult.changes > 0,
        });
    } catch (error) {
        console.error("Visitor tracking error:", error);
        return NextResponse.json({ count: 0, is_new: false });
    }
}

export async function GET() {
    try {
        const db = getWriteDb();
        const count = (db.prepare("SELECT COUNT(*) as cnt FROM visitors").get() as { cnt: number }).cnt;
        db.close();
        return NextResponse.json({ count });
    } catch {
        return NextResponse.json({ count: 0 });
    }
}

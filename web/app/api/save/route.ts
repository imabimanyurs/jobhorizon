import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
    : path.resolve(process.cwd(), "..", "data");
const DB_PATH = path.join(DATA_DIR, "jobs.db");

function getWriteDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    return new Database(DB_PATH);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { job_id, action } = body;

        if (!job_id) {
            return NextResponse.json({ error: "job_id required" }, { status: 400 });
        }

        const db = getWriteDb();

        if (action === "save") {
            db.prepare("UPDATE jobs SET saved = 1 WHERE id = ?").run(job_id);
        } else if (action === "unsave") {
            db.prepare("UPDATE jobs SET saved = 0 WHERE id = ?").run(job_id);
        } else if (action === "toggle") {
            const row = db.prepare("SELECT saved FROM jobs WHERE id = ?").get(job_id) as { saved: number } | undefined;
            if (row) {
                const newVal = row.saved === 1 ? 0 : 1;
                db.prepare("UPDATE jobs SET saved = ? WHERE id = ?").run(newVal, job_id);
                db.close();
                return NextResponse.json({ saved: newVal === 1 });
            } else {
                db.close();
                return NextResponse.json({ error: "Job not found" }, { status: 404 });
            }
        }

        db.close();
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error("Save error:", error);
        return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
    // Authenticate the cron request
    const key = request.nextUrl.searchParams.get("key");
    if (!CRON_SECRET || key !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mode = request.nextUrl.searchParams.get("mode") || "--all";

    // Resolve scraper directory — works both locally and in Docker
    // In Docker: cwd is /app/web, so ../scraper = /app/scraper
    // Locally: cwd is web/, so ../scraper = scraper/
    let scraperDir = path.resolve(process.cwd(), "..", "scraper");

    // Fallback: check if /app/scraper exists (Docker absolute path)
    if (!fs.existsSync(scraperDir)) {
        scraperDir = "/app/scraper";
    }

    const scriptPath = path.join(scraperDir, "daily_run.py");

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
        console.error(`[CRON] Script not found at: ${scriptPath}`);
        console.error(`[CRON] cwd: ${process.cwd()}, scraperDir: ${scraperDir}`);
        return NextResponse.json(
            {
                status: "error",
                error: `Script not found at ${scriptPath}`,
                cwd: process.cwd(),
                scraperDir,
            },
            { status: 500 }
        );
    }

    try {
        console.log(`[CRON] Starting daily run (mode: ${mode}) at ${new Date().toISOString()}`);
        console.log(`[CRON] Script path: ${scriptPath}`);
        console.log(`[CRON] Scraper dir: ${scraperDir}`);

        // Spawn async — don't block the HTTP response
        const child = spawn("python", [scriptPath, mode], {
            cwd: scraperDir,
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
                PYTHONUNBUFFERED: "1",
            },
            detached: true,
            stdio: ["ignore", "pipe", "pipe"],
        });

        // Log output to Railway logs in real-time
        child.stdout?.on("data", (data: Buffer) => {
            console.log(`[SCRAPER] ${data.toString().trim()}`);
        });

        child.stderr?.on("data", (data: Buffer) => {
            console.error(`[SCRAPER ERROR] ${data.toString().trim()}`);
        });

        child.on("close", (code: number | null) => {
            console.log(`[CRON] Scraper process exited with code ${code}`);
        });

        child.on("error", (err: Error) => {
            console.error(`[CRON] Failed to start scraper:`, err.message);
        });

        // Unref so the parent process doesn't wait for the child
        child.unref();

        // Return immediately — scraper runs in background
        return NextResponse.json({
            status: "started",
            message: "Scraper started in background. Check Railway logs for progress.",
            timestamp: new Date().toISOString(),
            mode,
            scriptPath,
            pid: child.pid,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CRON] Failed to spawn:`, message);

        return NextResponse.json(
            {
                status: "error",
                error: message,
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

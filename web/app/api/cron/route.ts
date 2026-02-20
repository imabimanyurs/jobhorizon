import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

const CRON_SECRET = process.env.CRON_SECRET || "";

export async function GET(request: NextRequest) {
    // Authenticate the cron request
    const key = request.nextUrl.searchParams.get("key");
    if (key !== CRON_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mode = request.nextUrl.searchParams.get("mode") || "--all";
    const scraperDir = path.resolve(process.cwd(), "..", "scraper");
    const scriptPath = path.join(scraperDir, "daily_run.py");

    try {
        console.log(`[CRON] Starting daily run (mode: ${mode}) at ${new Date().toISOString()}`);

        const output = execSync(`python "${scriptPath}" ${mode}`, {
            cwd: scraperDir,
            timeout: 10 * 60 * 1000, // 10 minute timeout
            maxBuffer: 10 * 1024 * 1024, // 10MB output buffer
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
                PYTHONUNBUFFERED: "1",
            },
        }).toString();

        console.log(`[CRON] Completed successfully`);
        console.log(output);

        return NextResponse.json({
            status: "success",
            timestamp: new Date().toISOString(),
            mode,
            output: output.slice(-2000), // Last 2000 chars of output
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || "";
        const stdout = (error as { stdout?: Buffer })?.stdout?.toString() || "";

        console.error(`[CRON] Failed:`, message);
        console.error(`[CRON] stderr:`, stderr);
        console.error(`[CRON] stdout:`, stdout);

        return NextResponse.json(
            {
                status: "error",
                error: message,
                output: (stdout + "\n" + stderr).slice(-2000),
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}

import { NextRequest, NextResponse } from "next/server";
import { getJobs, getStats } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get("action");

        if (action === "stats") {
            const stats = getStats();
            return NextResponse.json(stats);
        }

        if (action === "last_run") {
            const dataDir = process.env.RAILWAY_VOLUME_MOUNT_PATH
                ? path.resolve(process.env.RAILWAY_VOLUME_MOUNT_PATH)
                : path.resolve(process.cwd(), "..", "data");
            const lastRunPath = path.join(dataDir, "last_run.json");
            try {
                const data = JSON.parse(fs.readFileSync(lastRunPath, "utf-8"));
                return NextResponse.json(data);
            } catch {
                return NextResponse.json({ last_run: null, new_jobs: 0, total: 0 });
            }
        }

        const page = parseInt(searchParams.get("page") || "1");
        const per_page = parseInt(searchParams.get("per_page") || "30");
        const remote_only = searchParams.get("remote") === "true";
        const keyword = searchParams.get("keyword") || undefined;
        const min_score = parseInt(searchParams.get("min_score") || "0");
        const source = searchParams.get("source") || undefined;
        const country = searchParams.get("country") || undefined;
        const india_only = searchParams.get("india") === "true";
        const faang_only = searchParams.get("faang") === "true";
        const today_only = searchParams.get("today") === "true";
        const max_days_ago = searchParams.get("max_days_ago")
            ? parseInt(searchParams.get("max_days_ago")!)
            : undefined;
        const sort_by = searchParams.get("sort_by") || undefined;
        const smart_view = searchParams.get("smart_view") === "true";
        const company = searchParams.get("company") || undefined;
        const min_salary = searchParams.get("min_salary")
            ? parseFloat(searchParams.get("min_salary")!)
            : undefined;
        const max_salary = searchParams.get("max_salary")
            ? parseFloat(searchParams.get("max_salary")!)
            : undefined;
        const visa_only = searchParams.get("visa") === "true";
        const equity_only = searchParams.get("equity") === "true";

        const result = getJobs({
            page,
            per_page,
            remote_only,
            keyword,
            min_score,
            source,
            country,
            india_only,
            faang_only,
            today_only,
            max_days_ago,
            sort_by,
            smart_view,
            company,
            min_salary,
            max_salary,
            visa_only,
            equity_only,
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to fetch jobs";
        console.error("API Error:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

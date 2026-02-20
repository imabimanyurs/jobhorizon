import { NextResponse } from "next/server";

const EXCHANGE_API_KEY = process.env.EXCHANGE_RATE_API_KEY || "";
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CachedRates {
    rates: Record<string, number>;
    fetchedAt: number;
}

let cachedRates: CachedRates | null = null;

async function fetchRates(): Promise<Record<string, number>> {
    // Check cache
    if (cachedRates && Date.now() - cachedRates.fetchedAt < CACHE_DURATION_MS) {
        return cachedRates.rates;
    }

    try {
        // Fetch INR-based rates so we can convert LPA (INR) to any currency
        const res = await fetch(
            `https://v6.exchangerate-api.com/v6/${EXCHANGE_API_KEY}/latest/INR`,
            { next: { revalidate: 3600 } }
        );
        const data = await res.json();

        if (data.result !== "success") {
            console.error("Exchange rate API error:", data);
            return getFallbackRates();
        }

        const rates = data.conversion_rates as Record<string, number>;
        cachedRates = { rates, fetchedAt: Date.now() };
        return rates;
    } catch (error) {
        console.error("Failed to fetch exchange rates:", error);
        return getFallbackRates();
    }
}

function getFallbackRates(): Record<string, number> {
    // Fallback hardcoded rates (1 INR = X currency)
    return {
        USD: 0.01198,  // ~83.5 INR per USD
        GBP: 0.00943,  // ~106 INR per GBP
        EUR: 0.01099,  // ~91 INR per EUR
        CAD: 0.01613,  // ~62 INR per CAD
        AUD: 0.01835,  // ~54.5 INR per AUD
        SGD: 0.01587,  // ~63 INR per SGD
        INR: 1,
    };
}

export async function GET() {
    try {
        const allRates = await fetchRates();

        // Return only the currencies we care about
        const currencies = ["USD", "GBP", "EUR", "CAD", "AUD", "SGD", "INR"];
        const filtered: Record<string, number> = {};
        for (const cur of currencies) {
            if (allRates[cur] !== undefined) {
                filtered[cur] = allRates[cur];
            }
        }

        return NextResponse.json({
            result: "success",
            base: "INR",
            rates: filtered,
        });
    } catch {
        return NextResponse.json({
            result: "success",
            base: "INR",
            rates: getFallbackRates(),
        });
    }
}

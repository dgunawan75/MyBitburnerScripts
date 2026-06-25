/** @param {NS} ns **/
// ============================================================
// corp-price-monitor.js v1
// Real-time market price monitor semua material di semua kota
//
// CARA PAKAI:
//   run corp/corp-price-monitor.js          → tampilkan semua
//   run corp/corp-price-monitor.js 10       → spread ≥ 10%
//   run corp/corp-price-monitor.js 0 Food   → filter nama material
// ============================================================

const CITIES = [
    "Sector-12", "Aevum", "Chongqing", "New Tokyo", "Ishima", "Volhaven"
];
const CITY_HDR = ["S-12 ", "Aevm ", "Chng ", "NTok ", "Ishi ", "Volh "];

// Semua material yang ada di Bitburner
const ALL_MATS = [
    "Food", "Plants", "Water", "Hardware", "Robots", "AI Cores",
    "Real Estate", "Metal", "Minerals", "Chemicals", "Drugs",
    "Energy", "Cloth", "Paper"
];

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.resizeTail(820, 600);

    const C          = ns.corporation;
    const minSpread  = parseFloat(ns.args[0] ?? "0");   // Min spread % untuk filter
    const matFilter  = String(ns.args[1] ?? "").toLowerCase(); // Filter nama material
    const INTERVAL   = 10_000; // Update tiap 1 market cycle (10 detik)

    // ── Ambil divisi referensi (yang punya banyak kota) ──────
    const corp    = C.getCorporation();
    const divList = corp.divisions.map(n => {
        const d = C.getDivision(n);
        return { name: n, cities: d.cities };
    });

    if (divList.length === 0) {
        ns.print("❌ Tidak ada divisi korporasi!");
        return;
    }

    // Kumpulkan material yang diproduksi tiap divisi (untuk marker ★)
    const ourMats = new Set();
    for (const { name } of divList) {
        const ind = C.getIndustryData(C.getDivision(name).industry);
        for (const m of (ind.producedMaterials ?? [])) ourMats.add(m);
    }

    ns.print(`🔍 Price Monitor aktif | Refresh: ${INTERVAL/1000}s`);
    ns.print(`   Args: [min_spread_%] [nama_material]`);

    while (true) {
        ns.clearLog();

        // ── Kumpulkan harga semua material di semua kota ──────
        // prices[mat][city] = marketPrice
        const prices = {};

        for (const mat of ALL_MATS) {
            prices[mat] = {};
            for (const city of CITIES) {
                // Coba semua divisi — ambil harga dari divisi pertama yang berhasil
                for (const { name: div, cities: dc } of divList) {
                    if (!dc.includes(city)) continue;
                    try {
                        const m = C.getMaterial(div, city, mat);
                        const mp = m.marketPrice ?? 0;
                        if (mp > 0) {
                            prices[mat][city] = mp;
                            break;
                        }
                    } catch {}
                }
            }
        }

        // ── Hitung statistik per material ─────────────────────
        const rows = [];
        for (const mat of ALL_MATS) {
            // Filter nama
            if (matFilter && !mat.toLowerCase().includes(matFilter)) continue;

            const cityPrices = prices[mat];
            const vals = CITIES.map(c => cityPrices[c] ?? 0).filter(v => v > 0);
            if (vals.length === 0) continue;

            const min    = Math.min(...vals);
            const max    = Math.max(...vals);
            const avg    = vals.reduce((a, b) => a + b, 0) / vals.length;
            const spread = min > 0 ? ((max - min) / min * 100) : 0;

            // Filter spread
            if (spread < minSpread) continue;

            // Kota termurah dan termahal
            const cheapCity    = CITIES.find(c => cityPrices[c] === min) ?? "?";
            const expensiveCity = CITIES.find(c => cityPrices[c] === max) ?? "?";

            rows.push({ mat, cityPrices, min, max, avg, spread, cheapCity, expensiveCity });
        }

        // Sort: spread tertinggi dulu
        rows.sort((a, b) => b.spread - a.spread);

        // ── Display ───────────────────────────────────────────
        const ts = new Date().toLocaleTimeString("id-ID");
        ns.print(`╔══════════════════════════════════════════════════════════════════════════════╗`);
        ns.print(`  💹 CORP PRICE MONITOR  [${ts}]   min-spread: ${minSpread}%   ${matFilter ? `filter: "${matFilter}"` : ""}`);
        ns.print(`╚══════════════════════════════════════════════════════════════════════════════╝`);

        if (rows.length === 0) {
            ns.print(`\n  Tidak ada material dengan spread ≥ ${minSpread}%`);
        } else {
            // ── Header tabel ──────────────────────────────────
            const hdr = `  ${"MATERIAL".padEnd(12)}` +
                        CITY_HDR.map(h => h.padStart(9)).join("") +
                        `  ${"MIN".padStart(8)} ${"MAX".padStart(8)} ${"AVG".padStart(8)} ${"SPREAD".padStart(7)} ${"PROFIT/unit".padStart(11)}`;
            ns.print(hdr);
            ns.print(`  ${"─".repeat(104)}`);

            for (const { mat, cityPrices, min, max, avg, spread, cheapCity, expensiveCity } of rows) {
                const marker    = ourMats.has(mat) ? "★" : " ";
                const profitPU  = max - min; // profit per unit jika beli di min, jual di max

                // Format setiap kolom kota
                const cols = CITIES.map(city => {
                    const mp = cityPrices[city];
                    if (!mp) return "     N/A";
                    const str = fmtMP(mp);
                    if (mp === min) return `[${str}]`.padStart(9); // ← termurah
                    if (mp === max) return `{${str}}`.padStart(9); // ← termahal
                    return str.padStart(9);
                }).join("");

                ns.print(
                    `${marker} ${mat.padEnd(12)}${cols}` +
                    `  ${fmtMP(min).padStart(8)} ${fmtMP(max).padStart(8)} ${fmtMP(avg).padStart(8)}` +
                    `  ${spread.toFixed(1).padStart(5)}%` +
                    `  ${fmtMP(profitPU).padStart(9)}/u`
                );
            }

            ns.print(`  ${"─".repeat(104)}`);
            ns.print(`  [x] = termurah (BELI)   {x} = termahal (JUAL)   ★ = divisi Anda produksi ini`);
        }

        // ── Ringkasan peluang arbitrase ───────────────────────
        ns.print(``);
        ns.print(`  ━━ TOP PELUANG (spread ≥ 20%) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const opportunities = rows.filter(r => r.spread >= 20);
        if (opportunities.length === 0) {
            ns.print(`  Tidak ada peluang spread ≥ 20% saat ini.`);
        } else {
            for (const { mat, min, max, spread, cheapCity, expensiveCity } of opportunities.slice(0, 5)) {
                const profitPU = max - min;
                ns.print(
                    `  💰 ${mat.padEnd(12)}: BELI @ ${cheapCity.padEnd(11)} ${fmtMP(min).padStart(8)}` +
                    `  →  JUAL @ ${expensiveCity.padEnd(11)} ${fmtMP(max).padStart(8)}` +
                    `  spread ${spread.toFixed(1)}%  profit ${fmtMP(profitPU)}/unit`
                );
            }
        }

        // ── Market cycle info ─────────────────────────────────
        ns.print(``);
        const nextTick = INTERVAL / 1000;
        ns.print(`  📊 ${rows.length} material ditampilkan | Refresh dalam ${nextTick}s`);
        ns.print(`  ⚠️  Arbitrase murni butuh divisi trader terpisah ($50B export unlock).`);
        ns.print(`      Lebih baik gunakan info ini untuk: optimasi kota jual terbaik.`);

        await ns.sleep(INTERVAL);
    }
}

// ── Format market price ────────────────────────────────────────
function fmtMP(n) {
    if (!n || n <= 0) return "N/A";
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3)  return `${(n / 1e3).toFixed(1)}k`;
    return n.toFixed(0);
}

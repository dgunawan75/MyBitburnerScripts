/** @param {NS} ns **/
// ============================================================
// corp-supply-chain.js v3 — SAME-CITY EXPORT MANAGER
// ============================================================
// Strategi: export antar kota yang SAMA saja
//   agro/Aevum     ←→  chems/Aevum
//   agro/Sector-12 ←→  chems/Sector-12
//   agro/Chongqing ←→  chems/Chongqing
//   ... dst.
//
// Untuk Aqua (1 kota) → distribusi merata ke semua kota consumer.
//
// SYARAT:
//   • "Export" unlock dibeli ($50B)
//   • Smart Supply aktif
//
// CARA PAKAI:
//   run corp/corp-supply-chain.js
// ============================================================

const SAFETY_MULT  = 1.1;    // Kirim 10% extra dari kebutuhan
const MIN_EXPORT   = 0.001;  // Minimum export agar route tidak mati
const INTERVAL_MS  = 60_000; // Update setiap 60 detik (6 market cycles)

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    const C = ns.corporation;

    // Auto-beli Export unlock jika belum
    try { C.purchaseUnlock("Export"); ns.print("✅ Export unlock purchased!"); } catch {}

    ns.print(`🔗 Supply Chain v3 (same-city routing)`);
    ns.print(`   Buffer: +${((SAFETY_MULT - 1) * 100).toFixed(0)}% | Update: ${INTERVAL_MS/1000}s`);

    while (true) {
        ns.clearLog();
        try {
            await runSupplyChain(ns, C);
        } catch (e) {
            ns.print(`❌ Error: ${e}`);
        }
        await ns.sleep(INTERVAL_MS);
    }
}

// ============================================================
async function runSupplyChain(ns, C) {
    const ts   = new Date().toLocaleTimeString("id-ID");
    const corp = C.getCorporation();

    ns.print(`╔══════════════════════════════════════════════╗`);
    ns.print(`  🔗 SUPPLY CHAIN  [${ts}]  buf:+${((SAFETY_MULT-1)*100).toFixed(0)}%`);
    ns.print(`╚══════════════════════════════════════════════╝`);

    // ── Kumpulkan info semua divisi ────────────────────────
    const divs = {};
    for (const name of corp.divisions) {
        const div = C.getDivision(name);
        const ind = C.getIndustryData(div.industry);
        divs[name] = { div, ind };
    }

    // ── Bangun material flow map ───────────────────────────
    // Cari: material → producer div & consumer div
    const matMap = {}; // mat → { producers:[], consumers:[] }
    for (const [name, { ind }] of Object.entries(divs)) {
        for (const mat of (ind.producedMaterials ?? [])) {
            if (!matMap[mat]) matMap[mat] = { producers: [], consumers: [] };
            if (!matMap[mat].producers.includes(name)) matMap[mat].producers.push(name);
        }
        for (const mat of Object.keys(ind.requiredMaterials ?? {})) {
            if (!matMap[mat]) matMap[mat] = { producers: [], consumers: [] };
            if (!matMap[mat].consumers.includes(name)) matMap[mat].consumers.push(name);
        }
    }

    const flows = Object.entries(matMap)
        .filter(([, v]) => v.producers.length > 0 && v.consumers.length > 0);

    if (flows.length === 0) {
        ns.print(`\nℹ️  Tidak ada supply route internal. Butuh 2+ divisi berkaitan.`);
        return;
    }

    ns.print(`\n📋 ${flows.length} material flows ditemukan`);

    // ── Setup per material ─────────────────────────────────
    for (const [mat, { producers, consumers }] of flows) {
        ns.print(`\n┌─ ${mat} ${"─".repeat(Math.max(0, 44 - mat.length))}`);
        ns.print(`│  📤 ${producers.join(", ")} → 📥 ${consumers.join(", ")}`);

        for (const prodName of producers) {
            for (const consName of consumers) {
                if (prodName === consName) continue; // skip self
                setupExportRoutes(ns, C, divs, mat, prodName, consName);
            }
        }
    }

    // ── Tampilkan ringkasan produksi ───────────────────────
    ns.print(`\n━━━ PRODUCTION RATES ━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (const [name, { div, ind }] of Object.entries(divs)) {
        const mats = ind.producedMaterials ?? [];
        if (mats.length === 0) continue;
        for (const mat of mats) {
            let total = 0;
            for (const city of div.cities) {
                try { total += Math.max(0, C.getMaterial(name, city, mat).productionAmount ?? 0); } catch {}
            }
            if (total > 0) ns.print(`  ${name} → ${mat}: ${fmtRate(total)} total (${div.cities.length} kota)`);
        }
    }
}

// ============================================================
// Setup export untuk satu pasang prodDiv → consDiv
// ============================================================
function setupExportRoutes(ns, C, divs, mat, prodName, consName) {
    const prodCities = divs[prodName].div.cities;
    const consCities = divs[consName].div.cities;

    // ── Tentukan strategi routing ──────────────────────────
    // Cari kota yang ADA di kedua divisi (same-city routing)
    const sharedCities   = prodCities.filter(c => consCities.includes(c));
    const exclusiveProd  = prodCities.filter(c => !consCities.includes(c)); // kota hanya di produser
    const exclusiveCons  = consCities.filter(c => !prodCities.includes(c)); // kota hanya di consumer

    ns.print(`│`);
    ns.print(`│  [${prodName} → ${consName}] ${mat}`);

    // ── 1. SAME-CITY ROUTING (prioritas utama) ─────────────
    // Tiap kota yang sama: prodCity → consCity langsung
    if (sharedCities.length > 0) {
        ns.print(`│  📍 Same-city routes (${sharedCities.length} kota):`);
        for (const city of sharedCities) {
            const need       = estimateNeed(C, divs, consName, city, mat);
            const exportRate = Math.max(need * SAFETY_MULT, MIN_EXPORT);

            let ok = false;
            try {
                try { C.cancelExportMaterial(prodName, city, consName, city, mat); } catch {}
                C.exportMaterial(prodName, city, consName, city, mat, exportRate.toFixed(6));
                ok = true;
            } catch (e) {
                ns.print(`│     ❌ ${city}: ${String(e).split("\n")[0].slice(0, 50)}`);
            }

            if (ok) {
                let prodRate = 0;
                try { prodRate = Math.max(0, C.getMaterial(prodName, city, mat).productionAmount ?? 0); } catch {}
                const icon = prodRate >= exportRate ? "✅" : "⚠️";
                ns.print(`│     ${icon} ${city}: need ${fmtRate(need)} → export ${fmtRate(exportRate)} (prod ${fmtRate(prodRate)})`);
            }

            // SmartSupply: beli kekurangan dari market
            try { C.setSmartSupplyOption(consName, city, mat, "leftovers"); } catch {}
        }
    }

    // ── 2. CROSS-CITY ROUTING untuk kota exclusive consumer ─
    // Consumer city yang tidak punya produser di kota yang sama
    // → Distribusi dari semua prodCity
    if (exclusiveCons.length > 0 && prodCities.length > 0) {
        ns.print(`│  🌐 Cross-city routes (${exclusiveCons.length} kota tanpa same-city producer):`);

        for (const consCity of exclusiveCons) {
            const need = estimateNeed(C, divs, consName, consCity, mat);

            // Distribusi merata dari semua prodCity ke consCity ini
            const exportPerProdCity = Math.max(
                (need * SAFETY_MULT) / prodCities.length,
                MIN_EXPORT
            );

            let totalSent = 0;
            let errors    = 0;

            for (const prodCity of prodCities) {
                try {
                    try { C.cancelExportMaterial(prodName, prodCity, consName, consCity, mat); } catch {}
                    C.exportMaterial(prodName, prodCity, consName, consCity, mat,
                        exportPerProdCity.toFixed(6));
                    totalSent += exportPerProdCity;
                } catch (e) {
                    errors++;
                }
            }

            const icon = errors === 0 ? "✅" : "⚠️";
            ns.print(`│     ${icon} ${consCity}: need ${fmtRate(need)} → total kirim ${fmtRate(totalSent)}` +
                     `${errors > 0 ? ` (${errors} err)` : ""}`);
            try { C.setSmartSupplyOption(consName, consCity, mat, "leftovers"); } catch {}
        }
    }

    // ── 3. Info kota produser exclusive (tidak ada consumer) ─
    if (exclusiveProd.length > 0 && exclusiveCons.length === 0) {
        ns.print(`│  ℹ️  ${exclusiveProd.length} kota produser tambahan (cross-city ke consumer sudah di-handle)`);
    }
}

// ============================================================
// Estimasi kebutuhan material di consumer div/city
//
// 3 metode (urutan prioritas):
//  1. productionAmount negatif = sedang dikonsumsi → langsung pakai
//  2. Output production × requiredMaterials ratio (proxy untuk material div)
//  3. Fallback ke 0 (script akan set MIN_EXPORT)
// ============================================================
function estimateNeed(C, divs, divName, city, mat) {
    const ind      = divs[divName].ind;
    const reqRatio = ind.requiredMaterials?.[mat] ?? 0;

    // ── Metode 1: Direct (negatif = dikonsumsi) ───────────
    try {
        const consumption = -(C.getMaterial(divName, city, mat).productionAmount ?? 0);
        if (consumption > 0.001) return consumption;
    } catch {}

    // ── Metode 2: Estimasi dari output production ──────────
    for (const outMat of (ind.producedMaterials ?? [])) {
        try {
            const outRate = C.getMaterial(divName, city, outMat).productionAmount ?? 0;
            if (outRate > 0.001) return outRate * reqRatio;
        } catch {}
    }

    // ── Metode 3: Fallback 0 (MIN_EXPORT akan dipakai) ────
    return 0;
}

// ============================================================
function fmtRate(n) {
    if (!isFinite(n) || n <= 0) return "0.000/s";
    if (n >= 1e6) return `${(n / 1e6).toFixed(3)}M/s`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(3)}k/s`;
    return `${n.toFixed(3)}/s`;
}

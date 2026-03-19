/** @param {NS} ns **/
/*
 * sell-all.js — Jual Saham dengan Target Profit
 *
 * Mode 1 (Sekali Jalan — default):
 *   run sell-all.js          → Jual semua yang profit >= 2% (default)
 *   run sell-all.js 0.05     → Jual semua yang profit >= 5% (angka desimal)
 *
 * Mode 2 (Pantau Terus — pakai --X):
 *   run sell-all.js --5      → Loop terus, jual otomatis jika profit >= 5%
 *   run sell-all.js --10     → Loop terus, jual jika profit >= 10%
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: Butuh TIX API Access!");
        return;
    }

    const COMMISSION = 100000;

    // === PARSE ARGUMEN ===
    // Cek mode pantau: --X (misalnya --5 berarti 5%)
    let watchMode = false;
    let targetProfit = 0.02; // Default 2%


    // --all : Jual SEMUA posisi tanpa peduli untung/rugi
    if (ns.args.includes("--all")) {
        ns.print(`🚨 MODE --all: Jual SEMUA posisi sekarang juga!`);
        let symbols = ns.stock.getSymbols();
        let total = 0; let count = 0;
        for (let sym of symbols) {
            let pos = ns.stock.getPosition(sym);
            if (pos[0] <= 0) continue;
            let cost = pos[0] * pos[1] + COMMISSION;
            let sold = ns.stock.sellStock(sym, pos[0]);
            if (sold > 0) {
                let rev = pos[0] * sold - COMMISSION;
                let profit = rev - cost;
                let pct = (profit / cost * 100).toFixed(2);
                let icon = profit >= 0 ? "✅" : "🔴";
                ns.print(`${icon} [JUAL] ${sym} | ${pct}% | $${ns.formatNumber(profit)}`);
                total += rev; count++;
            }
        }
        ns.print(`=========================================`);
        ns.print(`🎉 Selesai: ${count} saham dijual. Dapat: $${ns.formatNumber(total)}`);
        return;
    }

    for (let arg of ns.args) {
        if (typeof arg === "string" && /^--\d+(\.\d+)?$/.test(arg)) {
            targetProfit = parseFloat(arg.slice(2)) / 100;
            watchMode = true;
        } else if (typeof arg === "number") {
            targetProfit = arg;
        }
    }

    const targetLabel = (targetProfit * 100).toFixed(1) + "%";

    ns.print(`=========================================`);
    ns.print(` 📉 STOCK SELLER`);
    ns.print(` 🎯 Target Profit : ${targetLabel}`);
    ns.print(` 🔄 Mode          : ${watchMode ? "PANTAU TERUS (--" + (targetProfit * 100).toFixed(0) + ")" : "Sekali Jalan"}`);
    ns.print(`=========================================`);
    ns.print(`=========================================`);

    // === FUNGSI UTAMA ===
    const doSellCheck = () => {
        let symbols = ns.stock.getSymbols();
        let totalCashed = 0;
        let soldCount = 0;
        let watchList = [];

        for (let sym of symbols) {
            let pos = ns.stock.getPosition(sym);
            let sharesLong = pos[0];
            let avgLongPrice = pos[1];

            if (sharesLong <= 0) continue;

            let bidPrice = ns.stock.getBidPrice(sym);
            let revenue = sharesLong * bidPrice - COMMISSION;
            let cost = sharesLong * avgLongPrice + COMMISSION;
            let actProfit = revenue - cost;
            let pnlPct = actProfit / cost;

            if (pnlPct >= targetProfit) {
                let soldPrice = ns.stock.sellStock(sym, sharesLong);
                if (soldPrice > 0) {
                    let finalRevenue = sharesLong * soldPrice - COMMISSION;
                    let finalProfit = finalRevenue - cost;
                    ns.print(`✅ [JUAL] ${sym} | +${(pnlPct * 100).toFixed(2)}% | Profit: $${ns.formatNumber(finalProfit)}`);
                    totalCashed += finalRevenue;
                    soldCount++;
                }
            } else {
                watchList.push({ sym, pnlPct });
            }
        }

        return { totalCashed, soldCount, watchList };
    };

    // === MODE SEKALI JALAN ===
    if (!watchMode) {
        let { totalCashed, soldCount, watchList } = doSellCheck();
        ns.print(`=========================================`);
        if (soldCount > 0) {
            ns.print(`🎉 Terjual ${soldCount} saham! Dapat: $${ns.formatNumber(totalCashed)}`);
        } else {
            ns.print(`❌ Tidak ada yang mencapai target ${targetLabel}.`);
            if (watchList.length > 0) {
                ns.print(`📊 Posisi yang ditahan:`);
                for (let w of watchList.sort((a, b) => b.pnlPct - a.pnlPct)) {
                    ns.print(`   ${w.sym}: ${(w.pnlPct * 100).toFixed(2)}% (kurang ${((targetProfit - w.pnlPct) * 100).toFixed(2)}% lagi)`);
                }
            }
            ns.print(`💡 Tip: run sell-all.js --${(targetProfit * 100).toFixed(0)} untuk pantau terus`);
        }
        return;
    }

    // === MODE PANTAU TERUS ===
    while (true) {
        let { totalCashed, soldCount, watchList } = doSellCheck();

        // Refresh display
        ns.clearLog();
        ns.print(`=========================================`);
        ns.print(` 📉 STOCK SELLER — MODE PANTAU (--${(targetProfit * 100).toFixed(0)}%)`);
        ns.print(`=========================================`);

        if (watchList.length === 0) {
            ns.print(`🎉 Semua posisi sudah terjual atau tidak ada posisi.`);
            ns.print(`   Script selesai.`);
            break; // Tidak ada lagi yang perlu dipantau
        }

        ns.print(`⏳ Memantau ${watchList.length} posisi (Target: ${targetLabel}):\n`);
        for (let w of watchList.sort((a, b) => b.pnlPct - a.pnlPct)) {
            let bar = buildBar(w.pnlPct, targetProfit);
            let status = w.pnlPct >= 0 ? "📈" : "📉";
            ns.print(`${status} ${w.sym.padEnd(5)} ${bar} ${(w.pnlPct * 100).toFixed(2)}%`);
        }

        if (soldCount > 0) {
            ns.print(`\n✅ Baru terjual tadi: ${soldCount} saham | $${ns.formatNumber(totalCashed)}`);
        }

        // Tunggu 1 tick market (6 detik)
        await ns.sleep(6000);
    }
}

// Progress bar sederhana
function buildBar(current, target) {
    let pct = Math.min(1, Math.max(0, current / target));
    let filled = Math.floor(pct * 10);
    let empty = 10 - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

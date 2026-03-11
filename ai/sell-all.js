/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: Butuh TIX API Access!");
        return;
    }

    // Target profit persentase murni. 0.02 = 2%
    let targetProfit = 0.02;
    if (ns.args.length > 0 && typeof ns.args[0] === 'number') {
        targetProfit = ns.args[0];
    }

    let commission = 100000;

    ns.print(`=========================================`);
    ns.print(` 📉 END-GAME STOCK SELLER (${(targetProfit * 100).toFixed(1)}% PROFIT) `);
    ns.print(`=========================================`);
    ns.print(`Mencari saham dengan profit di atas ${(targetProfit * 100).toFixed(1)}%...`);

    let symbols = ns.stock.getSymbols();
    let totalCashedOut = 0;
    let soldCount = 0;

    for (let sym of symbols) {
        let pos = ns.stock.getPosition(sym);
        let sharesLong = pos[0];
        let avgLongPrice = pos[1];

        // Kita hanya asumsikan long position karena user belum unlock short
        if (sharesLong > 0) {
            let bidPrice = ns.stock.getBidPrice(sym);

            // Perkiraan Pendapatan kalau dijual sekarang
            let revenue = (sharesLong * bidPrice) - commission;

            // Modal Awal (sudah termasuk komisi waktu beli)
            let cost = (sharesLong * avgLongPrice) + commission;

            // Profit Aktual (Uang asli yang masuk kantong dikurangi uang asli awal)
            let actProfit = revenue - cost;

            // Profit Margin berdasarkan persentase
            let pnlPercent = actProfit / cost;

            if (pnlPercent >= targetProfit) {
                let soldPrice = ns.stock.sellStock(sym, sharesLong);

                if (soldPrice > 0) {
                    let finalRevenue = (sharesLong * soldPrice) - commission;
                    let finalProfit = finalRevenue - cost;

                    ns.print(`✅ [TERJUAL] ${sym}`);
                    ns.print(`   Shares : ${ns.formatNumber(sharesLong)}`);
                    ns.print(`   Profit : $${ns.formatNumber(finalProfit)} (+${(pnlPercent * 100).toFixed(2)}%)`);

                    totalCashedOut += finalRevenue;
                    soldCount++;
                }
            } else {
                ns.print(`⏳ [DITAHAN] ${sym} - Profit baru ${(pnlPercent * 100).toFixed(2)}% (Target: ${(targetProfit * 100).toFixed(1)}%)`);
            }
        }
    }

    ns.print(`=========================================`);
    if (soldCount > 0) {
        ns.print(`🎉 Berhasil menjual ${soldCount} saham!`);
        ns.print(`💵 Uang tunai didapat: $${ns.formatNumber(totalCashedOut)}`);
    } else {
        ns.print(`❌ Tidak ada saham yang mencapai target > ${(targetProfit * 100).toFixed(1)}% hari ini.`);
        ns.print(`💡 (Coba: run ${ns.getScriptName()} 0.01) untuk set target 1%`);
    }
}

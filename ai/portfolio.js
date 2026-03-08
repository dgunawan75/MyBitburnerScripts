/** @param {NS} ns **/
export async function main(ns) {
    // Mengecek akses API TIX sebelum menjalankan
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: Anda memerlukan 'TIX API Access' untuk membaca data portofolio.");
        return;
    }

    let symbols = ns.stock.getSymbols();

    let totalInvested = 0;
    let totalValue = 0;
    let found = false;

    ns.tprint("\n===== PORTOFOLIO SAHAM =====");

    for (let sym of symbols) {
        // [0: sharesLong, 1: avgPriceLong, 2: sharesShort, 3: avgPriceShort]
        let pos = ns.stock.getPosition(sym);
        let sharesLong = pos[0];
        let avgPriceLong = pos[1];

        if (sharesLong > 0) {
            found = true;
            // Harga bid adalah harga saat kita menjual saham ke pasar
            let currentPrice = ns.stock.getBidPrice(sym);

            let invested = sharesLong * avgPriceLong;
            let value = sharesLong * currentPrice;
            let profit = value - invested;
            let profitPercent = (profit / invested) * 100;

            totalInvested += invested;
            totalValue += value;

            let profitStr = profit >= 0 ?
                `Profit: +$${ns.formatNumber(profit)} (+${profitPercent.toFixed(2)}%) 💸` :
                `Rugi: -$${ns.formatNumber(Math.abs(profit))} (${profitPercent.toFixed(2)}%) 🔻`;

            ns.tprint(`[${sym}] ${ns.formatNumber(sharesLong)} lot | Modal: $${ns.formatNumber(invested)} | Nilai: $${ns.formatNumber(value)}`);
            ns.tprint(`  ↳ ${profitStr}`);
        }
    }

    if (!found) {
        ns.tprint("Anda saat ini tidak sedang menahan posisi saham apapun di portofolio.");
    } else {
        ns.tprint("============================");
        let totalProfit = totalValue - totalInvested;
        let totalProfitPercent = (totalProfit / totalInvested) * 100;

        ns.tprint(`Total Modal : $${ns.formatNumber(totalInvested)}`);
        ns.tprint(`Total Nilai : $${ns.formatNumber(totalValue)}`);

        if (totalProfit >= 0) {
            ns.tprint(`TOTAL PROFIT: +$${ns.formatNumber(totalProfit)} (+${totalProfitPercent.toFixed(2)}%) 💸`);
        } else {
            ns.tprint(`TOTAL RUGI  : -$${ns.formatNumber(Math.abs(totalProfit))} (${totalProfitPercent.toFixed(2)}%) 🔻`);
        }
    }
}

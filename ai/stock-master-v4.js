/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();

    if (!ns.stock.hasTIXAPIAccess() || !ns.stock.has4SDataTIXAPI()) {
        ns.tprint("ERROR: Butuh TIX API Access & 4S Market Data TIX API!");
        return;
    }

    ns.print("=========================================");
    ns.print(" 📈 STOCK MASTER (PRO-V4) ENGINE        ");
    ns.print("    (Advanced Long-Only Edition)         ");
    ns.print("=========================================");

    const CONFIG = {
        UPDATE_INTERVAL: 6000,          // 6 detik per tick market
        COMMISSION: 100000,
        FRAC_TO_INVEST: 0.60,           // Menginvestasikan maksimal 60% total kekayaan
        DIVERSIFICATION: 0.33,          // Max memegang 1 saham sebesar 33% portfolio (Anti-Bangkrut)
        MAX_SPREAD_TICKS: 50,           // Jika butuh lebih dari 50 tick (5 menit) hanya untuk menutup selisih Bid/Ask, JANGAN BELI
        BUY_ER_MIN: 0.0001,             // Expected Return minimal untuk membeli
        SELL_ER_MAX: 0,                 // Jual jika Expected Return <= 0 (Kondisi berbalik arah)
    };

    let totalProfit = 0;

    let formatBP = fraction => (fraction * 10000).toFixed(1) + " BP";

    let getStockList = () => {
        let symbols = ns.stock.getSymbols();
        let list = [];

        for (let sym of symbols) {
            let ask = ns.stock.getAskPrice(sym);
            let bid = ns.stock.getBidPrice(sym);
            let spread_pct = (ask - bid) / ask;
            let prob = ns.stock.getForecast(sym);
            let vol = ns.stock.getVolatility(sym);

            // Expected Return (ER) = Volatility * (Probability - 50%)
            // Hasilnya adalah ekspektasi pergerakan persentase murni per tick.
            let ER = vol * (prob - 0.5);

            let pos = ns.stock.getPosition(sym);
            let sharesLong = pos[0];
            let avgPrice = pos[1];
            let maxShares = ns.stock.getMaxShares(sym);

            // Waktu untuk menutup komisi & spread: Log(ask/bid) / Log(1 + ER)
            // Memprediksi berapa tick sampai hasil ER menutupi "kerugian awal" karena membeli di harga ask dan menjual di bid.
            let ticksToCoverSpread = ER > 0 ? (Math.log(ask / bid) / Math.log(1 + ER)) : Infinity;

            list.push({
                sym, ask, bid, spread_pct, prob, vol, ER,
                sharesLong, avgPrice, maxShares, ticksToCoverSpread,
                positionValue: sharesLong * bid
            });
        }
        return list;
    };

    while (true) {
        let cash = ns.getServerMoneyAvailable("home");
        let stocks = getStockList();

        let stockWealth = stocks.reduce((sum, s) => sum + s.positionValue, 0);
        let totalWealth = cash + stockWealth;

        let actionTaken = false;

        // ===============================================
        // FASE 1: EVALUASI JUAL (Mekanika No Fixed Stop-Loss)
        // ===============================================
        // Kita HANYA menjual kalau fundamentalnya hancur (ER <= 0 alias Forecast <= 50%)
        for (let stk of stocks) {
            if (stk.sharesLong > 0 && stk.ER <= CONFIG.SELL_ER_MAX) {
                let soldPrice = ns.stock.sellStock(stk.sym, stk.sharesLong);
                if (soldPrice > 0) {
                    let revenue = soldPrice * stk.sharesLong - CONFIG.COMMISSION;
                    let cost = stk.avgPrice * stk.sharesLong + CONFIG.COMMISSION;
                    let profit = revenue - cost;
                    totalProfit += profit;

                    ns.print(`🔻 [JUAL] ${stk.sym} - Prospek Buruk (ER: ${formatBP(stk.ER)})`);
                    ns.print(`   Terjual: ${ns.formatNumber(stk.sharesLong)} lot | Profit: $${ns.formatNumber(profit)}`);
                    actionTaken = true;
                }
            }
        }

        // ===============================================
        // FASE 2: REFRESH DANA DOMPET 
        // ===============================================
        // Refresh uang setelah proses jualan barusan
        cash = ns.getServerMoneyAvailable("home");
        stocks = getStockList(); // Refresh data saham setelah jualan
        stockWealth = stocks.reduce((sum, s) => sum + s.positionValue, 0);
        totalWealth = cash + stockWealth;

        let maxInvestTarget = totalWealth * CONFIG.FRAC_TO_INVEST;
        let freeCash = Math.max(0, maxInvestTarget - stockWealth);

        // Pastikan freeCash asli dari cash yang ada tidak melebihi yang dicita-citakan
        if (freeCash > cash) freeCash = cash;

        // ===============================================
        // FASE 3: BELI PROSPEK TERBAIK (Seleksi Dewa)
        // ===============================================
        if (freeCash > CONFIG.COMMISSION * 2) {

            // Urutkan berdasarkan waktu tutup spread terpendek, lalu ER terbesar
            stocks.sort((a, b) => {
                let timeDiff = a.ticksToCoverSpread - b.ticksToCoverSpread;
                if (timeDiff !== 0 && isFinite(a.ticksToCoverSpread) && isFinite(b.ticksToCoverSpread)) return timeDiff;
                return b.ER - a.ER;
            });

            for (let stk of stocks) {
                if (freeCash <= CONFIG.COMMISSION * 2) break; // Uang habis
                if (stk.sharesLong === stk.maxShares) continue; // Slot saham ini penuh
                if (stk.ER <= CONFIG.BUY_ER_MIN) continue; // Terlalu jelek untuk dilirik
                if (stk.ticksToCoverSpread > CONFIG.MAX_SPREAD_TICKS) continue; // Spreadnya gila atau tumbuhnya siput

                // Aturan DIVERSIFIKASI: Jangan taruh semua telur di satu keranjang
                let maxAllowedValueInThisStock = totalWealth * CONFIG.DIVERSIFICATION;
                let roomForMore = maxAllowedValueInThisStock - stk.positionValue;

                if (roomForMore <= CONFIG.COMMISSION * 2) continue; // Sudah mencapai batas diversifikasi 33%

                let budget = Math.min(freeCash, roomForMore);
                let affordableShares = Math.floor((budget - CONFIG.COMMISSION) / stk.ask);
                let sharesToBuy = Math.min(affordableShares, stk.maxShares - stk.sharesLong);

                if (sharesToBuy > 0) {
                    let cost = sharesToBuy * stk.ask + CONFIG.COMMISSION;

                    // Eksekusi Beli
                    let boughtPrice = ns.stock.buyStock(stk.sym, sharesToBuy);
                    if (boughtPrice > 0) {
                        ns.print(`🟢 [BELI] ${stk.sym} - Prospek Cerah (ER: ${formatBP(stk.ER)})`);
                        ns.print(`   Dibeli: ${ns.formatNumber(sharesToBuy)} lot | Budget: $${ns.formatNumber(cost)}`);
                        ns.print(`   Spread: ${(stk.spread_pct * 100).toFixed(2)}% | Ticks Penutup Spread: ${Math.ceil(stk.ticksToCoverSpread)}`);
                        freeCash -= cost;
                        actionTaken = true;
                    }
                }
            }
        }

        // ===============================================
        // FASE 4: UPDATE LOG (Jika ada aksi / setiap 1 menit)
        // ===============================================
        if (actionTaken || Math.random() < 0.1) { // Munculkan ringkasan sesekali
            ns.print(`\n💼 LAPORAN PORTOFOLIO ================`);
            ns.print(`   Uang Kas    : $${ns.formatNumber(cash)}`);
            ns.print(`   Nilai Saham : $${ns.formatNumber(stockWealth)}`);
            ns.print(`   Total Asset : $${ns.formatNumber(totalWealth)}`);
            ns.print(`   Total Profit: $${ns.formatNumber(totalProfit)}`);
            ns.print(`======================================\n`);
        }

        await ns.sleep(CONFIG.UPDATE_INTERVAL);
    }
}

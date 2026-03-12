/*
HISTORY_TICKS:  12,  // Simpan riwayat 12 tick terakhir
SIGNAL_MIN_UP:   6,  // Beli jika naik >= 6 tick beruntun
SIGNAL_MIN_DOWN: 4,  // Jual jika turun >= 4 tick beruntun

Tips: SIGNAL_MIN_UP = 6 itu konservatif (aman dari false signal).
Jika ingin lebih agresif beli lebih awal, turunkan ke 4.
Jika ingin super konservatif dan menghindari loss, naikkan ke 8.
*/

/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();

    // =========================================================
    // PRASYARAT: Minimal butuh TIX API dasar untuk bisa trading
    // =========================================================
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("❌ ERROR: Butuh minimal TIX API Access untuk bisa trading!");
        ns.tprint("   Beli di: City -> Alpha Ent. Terminal");
        return;
    }

    const HAS_4S = ns.stock.has4SDataTIXAPI();

    ns.print("=========================================");
    ns.print(" 📈 STOCK MASTER v5 - DUAL MODE          ");
    ns.print(`    Mode: ${HAS_4S ? "✅ 4S Presisi (Forecast + ER)" : "⚡ Sinyal Historis (Tanpa 4S)"}`);
    ns.print("=========================================");

    const CONFIG = {
        UPDATE_INTERVAL: 6000,   // 6 detik per tick market
        COMMISSION: 100000,
        FRAC_TO_INVEST: 0.60,   // Investasi maks 60% total kekayaan
        DIVERSIFICATION: 0.33,   // Max 33% portfolio di 1 saham
        MAX_SPREAD_TICKS: 50,     // Max tick untuk tutup spread (mode 4S)
        BUY_ER_MIN: 0.0001, // Min Expected Return untuk beli (mode 4S)
        HISTORY_TICKS: 12,     // Berapa tick harga disimpan (mode historis)
        SIGNAL_MIN_UP: 6,      // Min tick naik beruntun untuk beli (mode historis)
        SIGNAL_MIN_DOWN: 4,      // Min tick turun beruntun untuk jual (mode historis)
    };

    // Penyimpanan histori harga: { SYM: [price1, price2, ...] }
    let priceHistory = {};
    let totalProfit = 0;

    let formatBP = fraction => (fraction * 10000).toFixed(1) + " BP";

    // =========================================================
    // HELPER: Hitung sinyal dari histori harga (Tanpa 4S)
    // Kembalikan jumlah tick naik (+) atau turun (-) berturut-turut
    // =========================================================
    function calcSignal(history) {
        if (history.length < 2) return 0;
        let direction = history[history.length - 1] > history[history.length - 2] ? 1 : -1;
        let count = 1;
        for (let i = history.length - 2; i > 0; i--) {
            let d = history[i] > history[i - 1] ? 1 : -1;
            if (d === direction) count++;
            else break;
        }
        return direction * count; // Positif = naik N tick, Negatif = turun N tick
    }

    // =========================================================
    // HELPER: Ambil data saham lengkap (adaptif 4S vs historis)
    // =========================================================
    function getStockList() {
        let symbols = ns.stock.getSymbols();
        let list = [];

        for (let sym of symbols) {
            let ask = ns.stock.getAskPrice(sym);
            let bid = ns.stock.getBidPrice(sym);
            let spread_pct = (ask - bid) / ask;
            let pos = ns.stock.getPosition(sym);
            let sharesLong = pos[0];
            let avgPrice = pos[1];
            let maxShares = ns.stock.getMaxShares(sym);

            // Update histori harga
            if (!priceHistory[sym]) priceHistory[sym] = [];
            priceHistory[sym].push((ask + bid) / 2); // Simpan mid-price
            if (priceHistory[sym].length > CONFIG.HISTORY_TICKS) {
                priceHistory[sym].shift(); // Hapus data paling lama
            }

            let ER = 0;
            let signal = 0;
            let ticksToCoverSpread = Infinity;

            if (HAS_4S) {
                // Mode Presisi: Gunakan Forecast & Volatility dari 4S API
                let prob = ns.stock.getForecast(sym);
                let vol = ns.stock.getVolatility(sym);
                ER = vol * (prob - 0.5);
                ticksToCoverSpread = ER > 0
                    ? (Math.log(ask / bid) / Math.log(1 + ER))
                    : Infinity;
            } else {
                // Mode Historis: Sinyal dari arah pergerakan harga
                signal = calcSignal(priceHistory[sym]);
                // Estimasi ER sederhana dari trend: semakin panjang streak, semakin "kuat"
                ER = signal / 100;
            }

            list.push({
                sym, ask, bid, spread_pct, ER, signal,
                sharesLong, avgPrice, maxShares, ticksToCoverSpread,
                positionValue: sharesLong * bid
            });
        }
        return list;
    }

    // =========================================================
    // MAIN TRADING LOOP
    // =========================================================
    while (true) {
        let cash = ns.getServerMoneyAvailable("home");
        let stocks = getStockList();

        let stockWealth = stocks.reduce((sum, s) => sum + s.positionValue, 0);
        let totalWealth = cash + stockWealth;
        let actionTaken = false;

        // -------------------------------------------------------
        // FASE 1: EVALUASI JUAL
        // -------------------------------------------------------
        for (let stk of stocks) {
            if (stk.sharesLong <= 0) continue;

            let shouldSell = false;
            if (HAS_4S) {
                // Jual jika fundamental berbalik (ER <= 0)
                shouldSell = stk.ER <= 0;
            } else {
                // Jual jika harga turun beruntun >= batas minimum
                shouldSell = stk.signal <= -CONFIG.SIGNAL_MIN_DOWN;
            }

            if (shouldSell) {
                let soldPrice = ns.stock.sellStock(stk.sym, stk.sharesLong);
                if (soldPrice > 0) {
                    let revenue = soldPrice * stk.sharesLong - CONFIG.COMMISSION;
                    let cost = stk.avgPrice * stk.sharesLong + CONFIG.COMMISSION;
                    let profit = revenue - cost;
                    totalProfit += profit;

                    if (HAS_4S) {
                        ns.print(`🔻 [JUAL] ${stk.sym} - ER: ${formatBP(stk.ER)} | Profit: $${ns.formatNumber(profit)}`);
                    } else {
                        ns.print(`🔻 [JUAL] ${stk.sym} - Turun ${-stk.signal} tick beruntun | Profit: $${ns.formatNumber(profit)}`);
                    }
                    actionTaken = true;
                }
            }
        }

        // -------------------------------------------------------
        // FASE 2: REFRESH DANA
        // -------------------------------------------------------
        cash = ns.getServerMoneyAvailable("home");
        stocks = getStockList();
        stockWealth = stocks.reduce((sum, s) => sum + s.positionValue, 0);
        totalWealth = cash + stockWealth;

        let maxInvestTarget = totalWealth * CONFIG.FRAC_TO_INVEST;
        let freeCash = Math.min(cash, Math.max(0, maxInvestTarget - stockWealth));

        // -------------------------------------------------------
        // FASE 3: BELI PROSPEK TERBAIK
        // -------------------------------------------------------
        if (freeCash > CONFIG.COMMISSION * 2) {

            if (HAS_4S) {
                // Urutkan: waktu tutup spread tercepat → ER terbesar
                stocks.sort((a, b) => {
                    let td = a.ticksToCoverSpread - b.ticksToCoverSpread;
                    if (td !== 0 && isFinite(a.ticksToCoverSpread) && isFinite(b.ticksToCoverSpread)) return td;
                    return b.ER - a.ER;
                });
            } else {
                // Urutkan: streak naik terpanjang duluan
                stocks.sort((a, b) => b.signal - a.signal);
            }

            for (let stk of stocks) {
                if (freeCash <= CONFIG.COMMISSION * 2) break;
                if (stk.sharesLong >= stk.maxShares) continue;

                let shouldBuy = false;
                if (HAS_4S) {
                    shouldBuy = stk.ER > CONFIG.BUY_ER_MIN && stk.ticksToCoverSpread <= CONFIG.MAX_SPREAD_TICKS;
                } else {
                    // Beli jika naik beruntun sudah >= batas minimum (tren kuat)
                    shouldBuy = stk.signal >= CONFIG.SIGNAL_MIN_UP;
                }

                if (!shouldBuy) continue;

                let maxAllowed = totalWealth * CONFIG.DIVERSIFICATION;
                let roomForMore = maxAllowed - stk.positionValue;
                if (roomForMore <= CONFIG.COMMISSION * 2) continue;

                let budget = Math.min(freeCash, roomForMore);
                let affordableShares = Math.floor((budget - CONFIG.COMMISSION) / stk.ask);
                let sharesToBuy = Math.min(affordableShares, stk.maxShares - stk.sharesLong);

                if (sharesToBuy > 0) {
                    let cost = sharesToBuy * stk.ask + CONFIG.COMMISSION;
                    let boughtPrice = ns.stock.buyStock(stk.sym, sharesToBuy);
                    if (boughtPrice > 0) {
                        if (HAS_4S) {
                            ns.print(`🟢 [BELI] ${stk.sym} - ER: ${formatBP(stk.ER)} | Spread Ticks: ${Math.ceil(stk.ticksToCoverSpread)}`);
                        } else {
                            ns.print(`🟢 [BELI] ${stk.sym} - Naik ${stk.signal} tick beruntun | Budget: $${ns.formatNumber(cost)}`);
                        }
                        freeCash -= cost;
                        actionTaken = true;
                    }
                }
            }
        }

        // -------------------------------------------------------
        // FASE 4: LAPORAN PORTOFOLIO
        // -------------------------------------------------------
        if (actionTaken || Math.random() < 0.1) {
            ns.print(`\n💼 LAPORAN PORTOFOLIO ================`);
            ns.print(`   Mode        : ${HAS_4S ? "4S Presisi" : "Sinyal Historis"}`);
            ns.print(`   Uang Kas    : $${ns.formatNumber(cash)}`);
            ns.print(`   Nilai Saham : $${ns.formatNumber(stockWealth)}`);
            ns.print(`   Total Asset : $${ns.formatNumber(totalWealth)}`);
            ns.print(`   Total Profit: $${ns.formatNumber(totalProfit)}`);
            ns.print(`=====================================\n`);
        }

        await ns.sleep(CONFIG.UPDATE_INTERVAL);
    }
}

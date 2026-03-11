/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail(); // Membuka jendela log agar Anda bisa melihat aktivitas bot

    // Pengecekan Syarat Dasar Trading Otomatis
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: WSE Account (200m) saja tidak cukup.");
        ns.tprint("Anda harus membeli 'TIX API Access' (~5b) di bursa saham untuk bisa menggunakan script otomatis.");
        return;
    }

    ns.print("Menjalankan Stock Trader Bot...");

    const BUY_THRESHOLD = 0.60;    // Beli jika probabilitas saham naik > 60%
    const SELL_THRESHOLD = 0.50;   // Jual jika probabilitas saham naik turun ke < 50%
    const COMMISSION = 100000;     // Biaya komisi tiap kali beli/jual (100k)

    while (true) {
        let config = { stockBudget: 0.5 };
        if (ns.fileExists("/pro-v1/config.txt")) {
            try { config = JSON.parse(ns.read("/pro-v1/config.txt")); } catch (e) { }
        }
        let fraction = config.stockBudget !== undefined ? config.stockBudget : 0.5;

        let has4S = ns.stock.has4SDataTIXAPI();

        if (has4S) {
            trader4S(ns, fraction, BUY_THRESHOLD, SELL_THRESHOLD, COMMISSION);
        } else {
            ns.print("WARNING: Anda belum punya '4S Market Data TIX API Access' (~25b).");
            ns.print("Bot beroperasi di mode pasif/standby.");
            ns.print("Sulit memprediksi pasar Bitburner tanpa 4S Data. Kumpulkan uang dan beli 4S API Data!");
        }

        // Harga saham Bitburner di-update setiap ~6 detik
        await ns.sleep(6000);
    }
}

function trader4S(ns, fraction, buyThreshold, sellThreshold, commission) {
    // BUG FIX PORTFOLIO BALANCING (THE PRO WAY):
    // Kita tidak boleh hanya memotong dari "Uang Kas". Kita harus menghitung Total Kekayaan (Kas + Saham).
    // Jika Orchestrator bilang fraction = 0.8, artinya "80% kekayaan boleh di saham, 20% WAJIB berupa KAS CAIR".
    let symbols = ns.stock.getSymbols();

    let cash = ns.getServerMoneyAvailable("home");
    let stockValue = 0;
    for (let sym of symbols) {
        let pos = ns.stock.getPosition(sym);
        let sharesLong = pos[0];
        if (sharesLong > 0) {
            stockValue += sharesLong * ns.stock.getBidPrice(sym);
        }
    }

    let totalWealth = cash + stockValue;

    // Uang tunai yang HARUS dijaga di rekening bank (untuk dibelanjakan Hacknet & Server Manager)
    let requiredCash = totalWealth * (1 - fraction);

    // Budget trading hanyalah kelebihan kas di atas ambang batas tabungan wajib
    let money = cash - requiredCash;
    if (money < 0) money = 0;

    // 1. EVALUASI PORTOFOLIO SAAT INI (Jual yang performanya memburuk)
    for (let sym of symbols) {
        let pos = ns.stock.getPosition(sym);
        let sharesLong = pos[0];
        let avgPrice = pos[1]; // Dapatkan harga beli rata-rata untuk menghitung profit

        if (sharesLong > 0) {
            let forecast = ns.stock.getForecast(sym);
            if (forecast < sellThreshold) {
                let sellPrice = ns.stock.sellStock(sym, sharesLong);
                if (sellPrice > 0) {
                    let totalRevenue = (sellPrice * sharesLong) - commission;
                    let totalCost = (avgPrice * sharesLong) + commission; // Hitung juga komisi saat beli
                    let profit = totalRevenue - totalCost;

                    if (profit > 0) {
                        ns.print(`[-] TERJUAL ${sharesLong} lot ${sym} karena indikator turun. Profit: +$${ns.formatNumber(profit)} 💸`);
                    } else {
                        ns.print(`[-] TERJUAL ${sharesLong} lot ${sym} karena indikator turun. Rugi: -$${ns.formatNumber(Math.abs(profit))} 🔻`);
                    }

                    money += totalRevenue;
                }
            }
        }
    }

    // 2. CARI SAHAM PROSPEK UNTUK DIBELI
    let prospects = [];
    for (let sym of symbols) {
        let forecast = ns.stock.getForecast(sym);
        let volatility = ns.stock.getVolatility(sym);

        // Hanya lirik saham yang forecast-nya di atas batas aman (>60%)
        if (forecast >= buyThreshold) {
            prospects.push({
                sym: sym,
                // Rating = kombinasi peluang naik DAN besarnya fluktuasi harga (volatilitas)
                rating: (forecast - 0.5) * volatility,
                forecast: forecast
            });
        }
    }

    // Urutkan dari rating terbesar
    prospects.sort((a, b) => b.rating - a.rating);

    // 3. EKSEKUSI PEMBELIAN
    for (let p of prospects) {
        let sym = p.sym;
        let askPrice = ns.stock.getAskPrice(sym);
        let pos = ns.stock.getPosition(sym);
        let maxShares = ns.stock.getMaxShares(sym);
        let sharesAvailableToBuy = maxShares - pos[0];

        if (sharesAvailableToBuy > 0) {
            let moneyToSpend = money - commission;
            if (moneyToSpend > 0) {
                let affordableShares = Math.floor(moneyToSpend / askPrice);
                let sharesToBuy = Math.min(affordableShares, sharesAvailableToBuy);

                // Pastikan uang yang dihabiskan seimbang dengan biaya komisi agar tidak rugi bandar
                if (sharesToBuy > 0 && (sharesToBuy * askPrice) > (commission * 10)) {
                    let buyPrice = ns.stock.buyStock(sym, sharesToBuy);
                    if (buyPrice > 0) {
                        ns.print(`${new Date().toLocaleTimeString()} DIBELI  ${sharesToBuy} lot ${sym} (Mdl: ${ns.formatNumber(buyPrice * sharesToBuy)})`);
                        money -= (buyPrice * sharesToBuy + commission);
                    }
                }
            }
        }
    }
}


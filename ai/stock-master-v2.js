/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();

    // Cek akses
    if (!ns.stock.hasTIXAPIAccess()) {
        ns.tprint("ERROR: Butuh TIX API Access (5B)!");
        return;
    }
    if (!ns.stock.has4SDataTIXAPI()) {
        ns.tprint("ERROR: Butuh 4S Market Data TIX API (25B)!");
        return;
    }

    ns.print("🚀 Stock Master V2 – Super Trader Aktif");

    // Konfigurasi
    const CONFIG = {
        UPDATE_INTERVAL: 10000,          // 10 detik (lebih lambat dari 6 detik untuk kurangi biaya)
        COMMISSION: 100000,
        MIN_TRADE_VALUE: 1_000_000,      // Minimal nilai transaksi agar tidak rugi komisi
        FRACTION: 0.6,                    // Proporsi kekayaan untuk investasi (bisa dibaca dari file config)
        // Threshold dinamis: rumus = base + (volatility * factor)
        LONG_THRESHOLD_BASE: 0.55,
        SHORT_THRESHOLD_BASE: 0.45,
        VOLATILITY_FACTOR: 0.5,           // Semakin besar volatilitas, semakin besar selisih threshold
        STOP_LOSS: 0.10,                   // Jual jika harga turun 10% dari harga beli (long) atau naik 10% (short)
        TAKE_PROFIT: 0.20,                  // Ambil untung jika naik 20% (long) atau turun 20% (short)
        REBALANCE_INTERVAL: 60000,         // Lakukan rebalancing penuh setiap 60 detik
        MAX_LOSS_PER_TRADE: 0.05,           // Maksimal kerugian yang ditolerir dari total portofolio (5%)
    };

    // Inisialisasi data portofolio
    let portfolio = {
        cash: 0,
        stockValue: 0,
        totalWealth: 0,
        positions: new Map() // sym -> { longShares, shortShares, avgLongPrice, avgShortPrice }
    };

    // Loop utama
    let lastRebalance = 0;
    while (true) {
        const now = Date.now();
        // Update data portofolio
        updatePortfolio(ns, portfolio);

        // Jika sudah waktunya rebalance (atau pertama kali), lakukan evaluasi penuh
        if (now - lastRebalance > CONFIG.REBALANCE_INTERVAL) {
            rebalancePortfolio(ns, portfolio, CONFIG);
            lastRebalance = now;
        } else {
            // Di antara rebalance, hanya lakukan stop loss / take profit
            checkStopLossTakeProfit(ns, portfolio, CONFIG);
        }

        await ns.sleep(CONFIG.UPDATE_INTERVAL);
    }
}

/** Update nilai portofolio terkini */
function updatePortfolio(ns, portfolio) {
    const symbols = ns.stock.getSymbols();
    let stockValue = 0;
    let newPositions = new Map();

    for (let sym of symbols) {
        let pos = ns.stock.getPosition(sym);
        let longShares = pos[0];
        let avgLongPrice = pos[1];
        let shortShares = pos[2];
        let avgShortPrice = pos[3];

        if (longShares > 0 || shortShares > 0) {
            // Nilai saham long = jumlah * harga bid (jika dijual sekarang)
            // Nilai saham short = jumlah * harga ask (untuk menutup posisi)
            let bid = ns.stock.getBidPrice(sym);
            let ask = ns.stock.getAskPrice(sym);
            let value = longShares * bid + shortShares * ask; // short butuh ask untuk beli kembali
            stockValue += value;

            newPositions.set(sym, {
                longShares, avgLongPrice,
                shortShares, avgShortPrice,
                bid, ask,
                forecast: ns.stock.getForecast(sym),
                volatility: ns.stock.getVolatility(sym)
            });
        }
    }

    portfolio.positions = newPositions;
    portfolio.cash = ns.getServerMoneyAvailable("home");
    portfolio.stockValue = stockValue;
    portfolio.totalWealth = portfolio.cash + stockValue;
}

/** Fungsi rebalancing: jual posisi yang tidak prospektif, beli yang prospektif */
function rebalancePortfolio(ns, portfolio, config) {
    // Hitung uang yang boleh digunakan untuk investasi
    let targetInvest = portfolio.totalWealth * config.FRACTION;
    let currentInvest = portfolio.stockValue;
    let freeCash = portfolio.cash - (portfolio.totalWealth * (1 - config.FRACTION));
    if (freeCash < 0) freeCash = 0;

    ns.print(`\n📊 Rebalancing – Total Kekayaan: $${ns.formatNumber(portfolio.totalWealth)}`);
    ns.print(`   Investasi saat ini: $${ns.formatNumber(currentInvest)} (${(currentInvest / portfolio.totalWealth * 100).toFixed(1)}%)`);
    ns.print(`   Target investasi: $${ns.formatNumber(targetInvest)} (${config.FRACTION * 100}%)`);
    ns.print(`   Dana tersedia: $${ns.formatNumber(freeCash)}`);

    // 1. Evaluasi posisi yang sudah ada: jual jika tidak memenuhi kriteria atau terkena stop loss
    for (let [sym, pos] of portfolio.positions) {
        let forecast = pos.forecast;
        let vol = pos.volatility;

        // Tentukan threshold dinamis
        let longThreshold = config.LONG_THRESHOLD_BASE + vol * config.VOLATILITY_FACTOR;
        let shortThreshold = config.SHORT_THRESHOLD_BASE - vol * config.VOLATILITY_FACTOR;

        // Jual long jika forecast turun di bawah longThreshold atau di bawah 0.5 (darurat)
        if (pos.longShares > 0) {
            if (forecast < longThreshold || forecast < 0.5) {
                let sold = ns.stock.sellStock(sym, pos.longShares);
                if (sold > 0) {
                    let revenue = sold * pos.longShares - config.COMMISSION;
                    let cost = pos.avgLongPrice * pos.longShares + config.COMMISSION;
                    let profit = revenue - cost;
                    ns.print(`🔻 Jual LONG ${sym}: ${pos.longShares} lot, Profit: $${ns.formatNumber(profit)}`);
                    freeCash += revenue;
                }
            }
        }
    }

    // 2. Cari prospek baru (long dan short)
    let longProspects = [];
    let shortProspects = [];

    let symbols = ns.stock.getSymbols();
    for (let sym of symbols) {
        let forecast = ns.stock.getForecast(sym);
        let vol = ns.stock.getVolatility(sym);
        let longThreshold = config.LONG_THRESHOLD_BASE + vol * config.VOLATILITY_FACTOR;
        let shortThreshold = config.SHORT_THRESHOLD_BASE - vol * config.VOLATILITY_FACTOR;

        if (forecast > longThreshold) {
            // Rating untuk long: (forecast - 0.5) * vol (mirip asli)
            longProspects.push({
                sym,
                rating: (forecast - 0.5) * vol,
                forecast,
                vol
            });
        } else if (forecast < shortThreshold) {
            // Rating untuk short: (0.5 - forecast) * vol
            shortProspects.push({
                sym,
                rating: (0.5 - forecast) * vol,
                forecast,
                vol
            });
        }
    }

    // Urutkan berdasarkan rating tertinggi
    longProspects.sort((a, b) => b.rating - a.rating);
    shortProspects.sort((a, b) => b.rating - a.rating);

    // 3. Alokasikan dana secara proporsional
    let totalRatingLong = longProspects.reduce((sum, p) => sum + p.rating, 0);
    let totalRatingShort = shortProspects.reduce((sum, p) => sum + p.rating, 0);

    // Gabungkan kedua daftar dengan bobot
    let allProspects = [
        ...longProspects.map(p => ({ ...p, type: 'long' })),
        ...shortProspects.map(p => ({ ...p, type: 'short' }))
    ];

    // Urutkan lagi berdasarkan rating
    allProspects.sort((a, b) => b.rating - a.rating);

    // Hitung total rating
    let totalRating = allProspects.reduce((sum, p) => sum + p.rating, 0);

    // Beli dengan dana freeCash, bagi sesuai proporsi rating
    for (let p of allProspects) {
        // Refresh freeCash secara akurat dari bank agar tidak salah hitung akibat margin
        freeCash = ns.getServerMoneyAvailable("home") - (portfolio.totalWealth * (1 - config.FRACTION));
        if (freeCash <= config.COMMISSION * 2) break;

        let maxShares = ns.stock.getMaxShares(p.sym);
        let currentPos = portfolio.positions.get(p.sym) || { longShares: 0, shortShares: 0 };
        let availableLong = maxShares - currentPos.longShares;
        let availableShort = maxShares - currentPos.shortShares;

        // Tentukan alokasi dana untuk saham ini
        let shareOfCash = freeCash * (p.rating / totalRating);
        if (shareOfCash < config.MIN_TRADE_VALUE) continue;

        if (p.type === 'long' && availableLong > 0) {
            let askPrice = ns.stock.getAskPrice(p.sym);
            let maxSharesCanBuy = Math.floor((shareOfCash - config.COMMISSION) / askPrice);
            let sharesToBuy = Math.min(maxSharesCanBuy, availableLong);
            if (sharesToBuy > 0) {
                let cost = sharesToBuy * askPrice + config.COMMISSION;
                if (cost <= freeCash && cost > config.MIN_TRADE_VALUE) {
                    let bought = ns.stock.buyStock(p.sym, sharesToBuy);
                    if (bought > 0) {
                        ns.print(`🟢 Beli LONG ${p.sym}: ${sharesToBuy} lot, harga $${ns.formatNumber(askPrice)}, total $${ns.formatNumber(cost)}`);
                    }
                }
            }
        }
    }

    ns.print("✅ Rebalancing selesai.\n");
}

/** Cek stop loss dan take profit setiap siklus */
function checkStopLossTakeProfit(ns, portfolio, config) {
    for (let [sym, pos] of portfolio.positions) {
        let currentBid = ns.stock.getBidPrice(sym);
        let currentAsk = ns.stock.getAskPrice(sym);

        // Long position
        if (pos.longShares > 0) {
            let buyPrice = pos.avgLongPrice;
            let change = (currentBid - buyPrice) / buyPrice;
            // Take profit
            if (change >= config.TAKE_PROFIT) {
                let sold = ns.stock.sellStock(sym, pos.longShares);
                if (sold > 0) {
                    let profit = (currentBid - buyPrice) * pos.longShares - config.COMMISSION;
                    ns.print(`💰 Take Profit LONG ${sym}: untung $${ns.formatNumber(profit)}`);
                }
            }
            // Stop loss
            else if (change <= -config.STOP_LOSS) {
                let sold = ns.stock.sellStock(sym, pos.longShares);
                if (sold > 0) {
                    let loss = (buyPrice - currentBid) * pos.longShares + config.COMMISSION;
                    ns.print(`🛑 Stop Loss LONG ${sym}: rugi $${ns.formatNumber(loss)}`);
                }
            }
        }
    }
}
/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("====================================");
    ns.print(" THE ORCHESTRATOR - SYSTEM MANAGER  ");
    ns.print("====================================");

    const CONFIG_FILE = "/pro-v1/config.txt";

    // Konfigurasi default di awal game (Miskin)
    let config = {
        hacknetBudget: 0.50,       // 50% dari sisa uang dipakai untuk membangun tambang crypto Hacknet
        serverBudget: 0.50,        // 50% untuk infrastruktur Server Baru
        enableServerBuy: true,     // Boleh beli
        enableServerUpgrade: true, // Boleh upgrade
        stockBudget: 0.0,          // Jangan main saham dulu
        enableShare: false         // Fokus 100% cari duit, jangan alokasikan RAM ke faksi
    };

    // Pastikan script-script utama berjalan
    let scriptsToRun = [
        "/ai/brain.js",
        "/pro-v1/hacknet-manager.js",
        "/ai/stock-master.js"
    ];

    for (let script of scriptsToRun) {
        if (!ns.isRunning(script, "home")) {
            ns.print(`[START] Menyalakan ${script}...`);
            ns.run(script);
        }
    }

    while (true) {
        // 1. Dapatkan Kas Tunai
        let cash = ns.getServerMoneyAvailable("home");

        // 2. Dapatkan Nilai Aset Saham (Net Worth)
        let stockValue = 0;
        if (ns.stock.hasTIXAPIAccess()) {
            let symbols = ns.stock.getSymbols();
            for (let sym of symbols) {
                let pos = ns.stock.getPosition(sym);
                let sharesLong = pos[0];
                if (sharesLong > 0) {
                    let price = ns.stock.getBidPrice(sym);
                    stockValue += (sharesLong * price);
                }
            }
        }

        // Total Kekayaan Anda (Tunai + Aset Saham)
        let totalWealth = cash + stockValue;

        // Cek syarat mutlak bermain saham otomatis
        let hasTix = false;
        let has4s = false;
        if (ns.stock.hasTIXAPIAccess !== undefined) {
            hasTix = ns.stock.hasTIXAPIAccess();
            has4s = ns.stock.has4SDataTIXAPI();
        }

        let isStockGodMode = hasTix && has4s;

        // FASE 1 & FASE 1.5: JIKA ANDA BELUM PUNYA API SAHAM LENGKAP
        if (!isStockGodMode) {
            // FASE 1: Awal permainan, bangun fondasi (Di bawah $2 Miliar)
            if (totalWealth < 2e9) {
                config.hacknetBudget = 0.50;
                config.serverBudget = 0.50;
                config.enableServerBuy = true;
                config.enableServerUpgrade = true;
                config.stockBudget = 0.0;
                config.enableShare = false;
            }
            // FASE 1.5: MENABUNG UNTUK TIX & 4S API (Kekayaan $2 Miliar ++ TAPI belum lengkap API)
            else {
                // STOP SEMUA PEMBELANJAAN AGAR UANG CEPAT TERKUMPUL
                config.hacknetBudget = 0.0;
                config.serverBudget = 0.0;
                config.enableServerBuy = false;
                config.enableServerUpgrade = false;
                config.stockBudget = 0.0;
                config.enableShare = false;
            }
        }
        // FASE 2: SUDAH PUNYA TIX & 4S API ACCESS! (End Game - Prioritaskan Saham seutuhnya)
        else {
            config.hacknetBudget = 0.05;
            config.serverBudget = 0.15;
            config.enableServerBuy = true;
            config.enableServerUpgrade = true;
            config.stockBudget = 0.80;

            // Opsional: Jika kekayaan sudah lewat 1 Triliun, boleh menyalakan mode Faction Share
            if (totalWealth > 1e12) {
                config.enableShare = true;
            } else {
                config.enableShare = false;
            }
        }

        // Tulis configurasi ini ke file agar dibaca oleh script-script lain secara Real-Time
        ns.write(CONFIG_FILE, JSON.stringify(config), "w");

        ns.print(`[STATUS] Total: $${ns.formatNumber(totalWealth)} | Mode: ${totalWealth < 5e9 ? "BUILD" : "INVEST"} | Share: ${config.enableShare ? "ON" : "OFF"}`);

        await ns.sleep(5000); // Evaluasi kebijakan finansial setiap 5 detik
    }
}

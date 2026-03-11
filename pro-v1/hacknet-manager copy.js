/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    ns.print("====================================");
    ns.print(" MEMULAI PRO V1: HACKNET AUTO-MANAGER ");
    ns.print("====================================");

    // Batas maksimal upgrade untuk mencegah menghamburkan uang di *endgame*
    const MAX_NODES = ns.hacknet.maxNumNodes();
    const MAX_LEVEL = 200;
    const MAX_RAM = 64;
    const MAX_CORES = 16;

    // Minimal ROI (Uang per detik / Harga Beli). Jika terlalu kecil, script akan tidur.
    // Misalnya 0.0001 berarti butuh 10.000 detik (2.7 jam) untuk balik modal.
    const MIN_ROI = 0.00001;

    while (true) {
        let config = { hacknetBudget: 0.25 };
        if (ns.fileExists("/pro-v1/config.txt")) {
            try { config = JSON.parse(ns.read("/pro-v1/config.txt")); } catch (e) { }
        }
        let budgetPercent = config.hacknetBudget !== undefined ? config.hacknetBudget : 0.25;

        let budget = ns.getServerMoneyAvailable("home") * budgetPercent;
        let numNodes = ns.hacknet.numNodes();
        let options = [];

        // Kalkulator Multiplier Faksi/Pemain agar akurat untuk "Node Baru"
        let globalMult = 1;
        if (numNodes > 0) {
            let s = ns.hacknet.getNodeStats(0);
            let baseProd = (s.level * 1.5) * Math.pow(1.035, Math.log2(s.ram)) * ((s.cores + 5) / 6);
            globalMult = s.production / baseProd;
        }

        //=========================================
        // OPSI 1: Kumpulkan Data Beli Node Baru
        //=========================================
        if (numNodes < MAX_NODES) {
            let cost = ns.hacknet.getPurchaseNodeCost();
            // Estimasi produksi node baru = level 1, ram 1, core 1 dikali multiplier global
            let prodIncrease = (1 * 1.5) * Math.pow(1.035, 0) * (6 / 6) * globalMult;
            options.push({ type: "node", cost: cost, index: -1, roi: prodIncrease / cost });
        }

        //=========================================
        // OPSI 2: Kumpulkan Data Upgrade Tiap Node
        //=========================================
        for (let i = 0; i < numNodes; i++) {
            let stats = ns.hacknet.getNodeStats(i);

            // 2A: Upgrade Level (+1 Linear)
            if (stats.level < MAX_LEVEL) {
                let costLvl = ns.hacknet.getLevelUpgradeCost(i, 1);
                // Kenaikan produksi = Produksi saat ini dibagi level saat ini (karena linear)
                let incLvl = stats.production / stats.level;
                options.push({ type: "level", cost: costLvl, index: i, roi: incLvl / costLvl });
            }

            // 2B: Upgrade RAM (*2 Eksponensial 1.035x)
            if (stats.ram < MAX_RAM) {
                let costRam = ns.hacknet.getRamUpgradeCost(i, 1);
                // Kenaikan = (Produksi * 1.035) - Produksi = Produksi * 0.035
                let incRam = stats.production * 0.035;
                options.push({ type: "ram", cost: costRam, index: i, roi: incRam / costRam });
            }

            // 2C: Upgrade Core (Fraksional +1)
            if (stats.cores < MAX_CORES) {
                let costCore = ns.hacknet.getCoreUpgradeCost(i, 1);
                // Produksi baru = Prod Lama * (cores+6)/(cores+5). Kenaikan = Prod Lama / (cores+5)
                let incCore = stats.production / (stats.cores + 5);
                options.push({ type: "core", cost: costCore, index: i, roi: incCore / costCore });
            }
        }

        //=========================================
        // OPSI 3: Cari yang Paling Menguntungkan
        //=========================================
        if (options.length > 0) {
            // Urutkan dari ROI terbesar ke terkecil
            options.sort((a, b) => b.roi - a.roi);

            let best = options[0];

            // Beli jika ROI masih masuk akal dan uang mencukupi
            if (best.roi >= MIN_ROI && budget >= best.cost) {
                let success = false;

                if (best.type === "node") {
                    let newIdx = ns.hacknet.purchaseNode();
                    if (newIdx !== -1) {
                        ns.print(`[NODE]  Membeli Node ${newIdx} | Harga: $${ns.formatNumber(best.cost)}`);
                        success = true;
                    }
                } else if (best.type === "level") {
                    if (ns.hacknet.upgradeLevel(best.index, 1)) {
                        ns.print(`[LEVEL] Upgrade Node ${best.index} | Harga: $${ns.formatNumber(best.cost)}`);
                        success = true;
                    }
                } else if (best.type === "ram") {
                    if (ns.hacknet.upgradeRam(best.index, 1)) {
                        ns.print(`[RAM]   Upgrade Node ${best.index} | Harga: $${ns.formatNumber(best.cost)}`);
                        success = true;
                    }
                } else if (best.type === "core") {
                    if (ns.hacknet.upgradeCore(best.index, 1)) {
                        ns.print(`[CORE]  Upgrade Node ${best.index} | Harga: $${ns.formatNumber(best.cost)}`);
                        success = true;
                    }
                }

                // Jika berhasil beli, ulangi putaran tanpa delay (seketika) agar bisa borong
                if (success) {
                    await ns.sleep(10);
                    continue;
                }
            }
        }

        // Jika uang tidak cukup atau maxed out, istirahat 5 detik sebelum ngecek lagi
        await ns.sleep(5000);
    }
}

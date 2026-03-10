/** @param {NS} ns **/
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.tail();

    ns.print("====================================");
    ns.print(" 💰 PRO V1: HACKNET PAYOFF MANAGER ");
    ns.print("====================================");

    // Default Configuration
    let options = {
        c: false,             // Continuous mode
        continuous: false,    // Alias
        time: "10h",          // Max Payoff Time Limit (Beli barang yang balik modal kurang dari X jam)
        reserve: 0,           // Uang yang disisakan di bank
        interval: 1000        // Interval update dlm milidetik (jika continuous mode aktif)
    };

    // Parsing command line arguments
    for (let i = 0; i < ns.args.length; i++) {
        let arg = ns.args[i];
        if (arg === "-c" || arg === "--continuous") {
            options.c = true;
            options.continuous = true;
        } else if (arg === "--time" || arg === "-t") {
            options.time = ns.args[i + 1];
            i++;
        } else if (arg === "--reserve" || arg === "-r") {
            options.reserve = parseFloat(ns.args[i + 1]);
            i++;
        }
    }

    // Parsing Time Input ('1h', '60m', '3600s', etc)
    let maxPayoffTimeSeconds = 36000; // Default: 10 jam
    let timeInput = String(options.time).toLowerCase();
    if (timeInput.endsWith("m")) {
        maxPayoffTimeSeconds = parseFloat(timeInput.replace("m", "")) * 60;
    } else if (timeInput.endsWith("h")) {
        maxPayoffTimeSeconds = parseFloat(timeInput.replace("h", "")) * 3600;
    } else if (timeInput.endsWith("s")) {
        maxPayoffTimeSeconds = parseFloat(timeInput.replace("s", ""));
    } else {
        maxPayoffTimeSeconds = parseFloat(timeInput);
    }

    ns.print(`Mode Continuous : ${options.continuous}`);
    ns.print(`Max Payoff Time : ${ns.tFormat(maxPayoffTimeSeconds * 1000)}`);
    ns.print(`Uang Disimpan   : $${ns.formatNumber(options.reserve)}`);
    ns.print("------------------------------------");

    // Loop
    do {
        let moneySpent = upgradeHacknet(ns, maxPayoffTimeSeconds, options.reserve);

        // Return 0 artinya tidak ada barang bagus beli / uang habis
        if (options.continuous) {
            await ns.sleep(options.interval);
        }
    } while (options.continuous);

    if (!options.continuous) {
        ns.print("Selesai mengeksekusi pembelian terbaik. Gunakan argumen '-c' untuk mode 24 jam.");
    }
}

let lastLog = "";
function logStatus(ns, msg, useToast = false) {
    if (msg !== lastLog) {
        ns.print(msg);
        lastLog = msg;
    }
    if (useToast) ns.toast(msg, "success");
}

/** 
 * Fungsi Inti untuk Mengevaluasi & Membeli Hacknet 
 * yang balik modalnya paling Cepat (Payoff Time Terendah).
 * 
 * @param {NS} ns 
 */
function upgradeHacknet(ns, maxPayoffTimeSeconds, reserveCash) {
    let currentMult = ns.getPlayer().mults.hacknet_node_money;
    let numNodes = ns.hacknet.numNodes();

    // Jenis-jenis Upgrade beserta rumusnya (Akurasinya Dewa dari Source Code Game)
    let upgrades = [
        {
            name: "level", cost: i => ns.hacknet.getLevelUpgradeCost(i, 1),
            addedProd: s => s.production * ((s.level + 1) / s.level - 1),
            act: i => ns.hacknet.upgradeLevel(i, 1)
        },

        {
            name: "ram", cost: i => ns.hacknet.getRamUpgradeCost(i, 1),
            addedProd: s => s.production * 0.07, // 100% akurat: RAM Upgrade menambah produksi 7% 
            act: i => ns.hacknet.upgradeRam(i, 1)
        },

        {
            name: "cores", cost: i => ns.hacknet.getCoreUpgradeCost(i, 1),
            addedProd: s => s.production * ((s.cores + 5) / (s.cores + 4) - 1),
            act: i => ns.hacknet.upgradeCore(i, 1)
        }
    ];

    let bestNodeIndex = -1;
    let bestUpgrade = null;
    let bestPayoffRate = 0; // Produksi (Uang/dtk) per $1 dikeluarkan. Semakin BESAR semakin BAGUS.
    let bestCost = 0;

    let worstNodeProduction = Number.MAX_VALUE;

    // Evaluasi seluruh Node yg ada
    for (let i = 0; i < numNodes; i++) {
        let stats = ns.hacknet.getNodeStats(i);
        worstNodeProduction = Math.min(worstNodeProduction, stats.production);

        for (let upg of upgrades) {
            let cost = upg.cost(i);
            if (cost === Infinity) continue;

            let addedProd = upg.addedProd(stats);
            let payoffRate = addedProd / cost; // Uang Per Detik per $1

            if (payoffRate > bestPayoffRate) {
                bestPayoffRate = payoffRate;
                bestUpgrade = upg;
                bestNodeIndex = i;
                bestCost = cost;
            }
        }
    }

    // Bandingkan dengan beli Node BARI
    let newNodeCost = ns.hacknet.getPurchaseNodeCost();
    // Untuk Node baru, asumsikan minimal dia akan seproduktif node kita yg paling BURUK saat ini (jika mau nge-max out).
    let newNodePayoffRate = (numNodes === ns.hacknet.maxNumNodes()) ? 0 : (worstNodeProduction / newNodeCost);

    let buyNewNode = newNodePayoffRate > bestPayoffRate;

    if (buyNewNode) {
        bestCost = newNodeCost;
        bestPayoffRate = newNodePayoffRate;
    }

    if (bestPayoffRate === 0) {
        logStatus(ns, `Maksimal node & upgrade telah dicapai (Atau API error).`);
        return 0;
    }

    // Waktu Balik Modal (Detik) = 1 / Payoff Rate
    let payoffTimeSeconds = 1 / bestPayoffRate;
    let purchaseName = buyNewNode ? `Node Baru (hacknet-node-${numNodes})` : `Node ${bestNodeIndex} [Upgrade ${bestUpgrade.name.toUpperCase()}]`;

    if (payoffTimeSeconds > maxPayoffTimeSeconds) {
        logStatus(ns, `[LEWAT BATAS WAKTU] ${purchaseName} butuh ${ns.tFormat(payoffTimeSeconds * 1000)} untuk balik modal. (Batas kita: ${ns.tFormat(maxPayoffTimeSeconds * 1000)})`);
        return 0;
    }

    if (bestCost > (ns.getServerMoneyAvailable("home") - reserveCash)) {
        logStatus(ns, `[UANG KURANG] Beli ${purchaseName} ($${ns.formatNumber(bestCost)}) tunggu uang terkumpul... (Kas: $${ns.formatNumber(ns.getServerMoneyAvailable("home"))})`);
        return 0; // Uang kurang
    }

    // EKSEKUSI PEMBELIAN
    let success = buyNewNode ? (ns.hacknet.purchaseNode() !== -1) : bestUpgrade.act(bestNodeIndex);

    if (success) {
        let msg = `[DIBELI] Harga: $${ns.formatNumber(bestCost)} | Target: ${purchaseName} | Balik Modal dlm: ${ns.tFormat(payoffTimeSeconds * 1000)}`;
        logStatus(ns, msg, true);
        return bestCost;
    }

    return 0;
}

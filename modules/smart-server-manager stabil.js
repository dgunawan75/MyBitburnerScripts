/** @param {NS} ns **/

const LIMIT = 25;
const UPGRADE_RATIO = 2;     // upgrade minimal 2x RAM

// Hard limit maksimum RAM yang boleh dibeli untuk tiap server tambahan
// (Mencegah script menghamburkan triliunan dolar untuk upgrade yang tidak pernah dipakai semuanya)
// 1048576 GB = 1 Petabyte (PB). Ini batas wajar untuk Late Game sebelum masuk bursa.
const MAX_RAM_CAP = 1048576;

export async function manageServers(ns) {

    // Membaca pengaturan dari Orchestrator
    let config = { serverBudget: 0.25, enableServerBuy: true, enableServerUpgrade: true }; // Standar default gagal
    if (ns.fileExists("/pro-v1/config.txt")) {
        try {
            let parsed = JSON.parse(ns.read("/pro-v1/config.txt"));
            // Gunakan nilai dari file jika ada, jika tidak ada gunakan default
            config.serverBudget = parsed.serverBudget !== undefined ? parsed.serverBudget : 0.25;
            config.enableServerBuy = parsed.enableServerBuy !== undefined ? parsed.enableServerBuy : true;
            config.enableServerUpgrade = parsed.enableServerUpgrade !== undefined ? parsed.enableServerUpgrade : true;
        } catch (e) { }
    }

    let money = ns.getServerMoneyAvailable("home");
    let usableMoney = money * config.serverBudget;

    let servers = ns.getPurchasedServers();

    let maxRam = ns.getPurchasedServerMaxRam()

    // =========================
    // CARI RAM TERBAIK
    // =========================

    let bestRam = getBestRam(ns, usableMoney)

    if (bestRam < 8) return

    let cost = ns.getPurchasedServerCost(bestRam)

    /* for debug
        ns.tprint("Money:", money)  
        ns.tprint("Best RAM:", bestRam)
        ns.tprint("Cost:", cost)
    */
    // =========================
    // BELI SERVER BARU
    // =========================

    if (servers.length < LIMIT) {

        if (!config.enableServerBuy) return  // add line

        if (usableMoney < cost) return

        let name = "pserv-" + Date.now()

        ns.purchaseServer(name, bestRam)

        ns.tprint("🟢 Bought server:", name, "RAM:", bestRam)

        return
    }

    // =========================
    // UPGRADE SERVER TERKECIL
    // =========================

    let smallest = null
    let smallestRam = Infinity


    for (let s of servers) {

        let ram = ns.getServerMaxRam(s)

        if (ram < smallestRam) {
            smallestRam = ram
            smallest = s
        }
    }

    let nextRam = smallestRam * UPGRADE_RATIO

    // Batasi upgrade agar jangan beli server mahal yang tidak penting jika sudah 1 Petabyte ke atas.
    if (nextRam > MAX_RAM_CAP) return
    if (nextRam > maxRam) return

    let upgradeCost = ns.getPurchasedServerCost(nextRam)

    if (!config.enableServerUpgrade) return // add line

    if (usableMoney < upgradeCost) return

    ns.killall(smallest)

    ns.deleteServer(smallest)

    ns.purchaseServer(smallest, nextRam)

    ns.tprint("🟡 Upgraded", smallest, "to", nextRam)

}

function getBestRam(ns, money) {

    let ram = 8
    let max = ns.getPurchasedServerMaxRam()

    while (ram * 2 <= max) {

        let cost = ns.getPurchasedServerCost(ram * 2)

        if (cost > money) break

        ram *= 2
    }

    return ram
}
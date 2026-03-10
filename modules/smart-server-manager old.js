/** @param {NS} ns **/

const LIMIT = 25
const MONEY_BUFFER = 0.25   // sisakan 25% uang
const UPGRADE_RATIO = 2     // upgrade minimal 2x RAM

// switch : ON/OFF buy/upgrade server  
const ENABLE_SERVER_BUY = false
const ENABLE_SERVER_UPGRADE = false


export async function manageServers(ns) {

    let money = ns.getServerMoneyAvailable("home")

    // sisakan buffer uang
    let usableMoney = money * (1 - MONEY_BUFFER)

    let servers = ns.getPurchasedServers()

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

        if (!ENABLE_SERVER_BUY) return  // new

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

    if (nextRam > maxRam) return

    let upgradeCost = ns.getPurchasedServerCost(nextRam)

    if (!ENABLE_SERVER_UPGRADE) return // add line

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
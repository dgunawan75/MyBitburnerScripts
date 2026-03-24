import { scanNetwork } from "/modules/scanner.js"

export function getTargets(ns) {

    let servers = scanNetwork(ns)

    let xp = []
    let fast = []
    let big = []

    for (let s of servers) {

        if (!ns.hasRootAccess(s)) continue

        let maxMoney = ns.getServerMaxMoney(s)

        if (maxMoney <= 0) continue

        let hackTime = ns.getHackTime(s)

        let reqHack = ns.getServerRequiredHackingLevel(s)

        if (reqHack > ns.getHackingLevel()) continue

        // XP servers (very fast hack time AND low money)
        if (hackTime < 10000 && maxMoney < 5e7) {
            xp.push({ name: s, time: hackTime })
        }

        // Fast money servers
        else if (maxMoney < 1e9) {
            fast.push({ name: s, score: maxMoney / hackTime })
        }

        // Big money servers
        else {
            big.push({ name: s, score: maxMoney / hackTime })
        }

    }

    xp.sort((a, b) => a.time - b.time)
    fast.sort((a, b) => b.score - a.score)
    big.sort((a, b) => b.score - a.score)

    return {
        xp: xp.slice(0, 2).map(x => x.name),
        fast: fast.slice(0, 2).map(x => x.name),
        big: big.slice(0, 1).map(x => x.name)
    }

}
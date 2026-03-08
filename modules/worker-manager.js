import { scanNetwork } from "/modules/scanner.js"

export function getWorkers(ns) {

    let workers = []

    let servers = scanNetwork(ns)

    for (let s of servers) {

        if (!ns.hasRootAccess(s)) continue

        let ram = ns.getServerMaxRam(s)

        if (ram < 2) continue

        workers.push(s)

    }

    return workers
}
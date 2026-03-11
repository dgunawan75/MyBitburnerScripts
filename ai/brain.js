import { scanNetwork } from "/modules/scanner.js"
import { rootServer } from "/modules/rooter.js"
import { getTargets } from "/modules/target-engine-v2.js"
import { getWorkers } from "/modules/worker-manager.js"
import { deployHack } from "/modules/hack-engine.js"

/** @param {NS} ns **/
export async function main(ns) {

    while (true) {

        // scan semua server
        let servers = scanNetwork(ns)

        // root semua server
        for (let s of servers) {
            rootServer(ns, s)
        }

        // manage purchased servers
        // await manageServers(ns) // (Dihapus. Dipindahkan ke skrip mandiri agar tidak rebutan uang di awal game)

        // ======================
        // TARGET ENGINE v2
        // ======================

        let targetSet = getTargets(ns)

        // Hanya fokus pada target pembawa uang yang besar/cepat (XP dilewati)
        let targets = [
            ...targetSet.fast,
            ...targetSet.big
        ]

        // ======================

        let workers = getWorkers(ns)

        await deployHack(ns, workers, targets)

        await ns.sleep(5000)

    }

}
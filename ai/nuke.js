import { scanNetwork } from "/modules/scanner.js"
import { rootServer } from "/modules/rooter.js"

/** @param {NS} ns **/
export async function main(ns) {

    while (true) {

        // scan semua server
        let servers = scanNetwork(ns)

        // root semua server
        for (let s of servers) {
            rootServer(ns, s)
        }
        await ns.sleep(5000)
    }

}
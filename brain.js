import {scanNetwork} from "/modules/scanner.js"
import {getTargets} from "/modules/target-engine.js"
import {getWorkers} from "/modules/worker-manager.js"
import {deployHack} from "/modules/hack-engine.js"

/** @param {NS} ns **/
export async function main(ns){

    while(true){

        let servers = scanNetwork(ns)

        let targets = getTargets(ns,5)

        let workers = getWorkers(ns)

        await deployHack(ns,workers,targets)

        await ns.sleep(5000)

    }

}
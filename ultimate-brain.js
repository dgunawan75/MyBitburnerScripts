/** @param {NS} ns **/
export async function main(ns) {

    const hackScript = "hack-template.js"
    const growScript = "grow-template.js"
    const weakenScript = "weaken-template.js"

    while (true) {

        let servers = scanAll(ns)

        for (let s of servers) {

            await tryRoot(ns, s)

        }

        let target = findBestTarget(ns)

        ns.tprint("BEST TARGET: " + target)

        let workers = servers.filter(s => ns.hasRootAccess(s))

        for (let worker of workers) {

            await deploy(ns, worker, target, hackScript, growScript, weakenScript)

        }

        await ns.sleep(60000)

    }
}



function scanAll(ns) {

    let discovered = ["home"]

    for (let i = 0; i < discovered.length; i++) {

        let server = discovered[i]
        let neighbors = ns.scan(server)

        for (let n of neighbors) {

            if (!discovered.includes(n)) {

                discovered.push(n)

            }

        }
    }

    return discovered
}



async function tryRoot(ns, server) {

    if (ns.hasRootAccess(server)) return

    try { ns.brutessh(server) } catch {}
    try { ns.ftpcrack(server) } catch {}
    try { ns.relaysmtp(server) } catch {}
    try { ns.httpworm(server) } catch {}
    try { ns.sqlinject(server) } catch {}

    let ports = ns.getServerNumPortsRequired(server)

    if (ns.getServerNumPortsRequired(server) <= openedPorts(ns, server)) {

        try { ns.nuke(server) } catch {}

    }

}



function openedPorts(ns, server) {

    let count = 0

    if (ns.fileExists("BruteSSH.exe")) count++
    if (ns.fileExists("FTPCrack.exe")) count++
    if (ns.fileExists("relaySMTP.exe")) count++
    if (ns.fileExists("HTTPWorm.exe")) count++
    if (ns.fileExists("SQLInject.exe")) count++

    return count
}



function findBestTarget(ns) {

    let servers = scanAll(ns)

    let best = "n00dles"
    let bestScore = 0

    for (let s of servers) {

        if (!ns.hasRootAccess(s)) continue

        let maxMoney = ns.getServerMaxMoney(s)
        let hackLevel = ns.getServerRequiredHackingLevel(s)

        if (hackLevel > ns.getHackingLevel()) continue
        if (maxMoney <= 0) continue

        let hackTime = ns.getHackTime(s)

        let score = maxMoney / hackTime

        if (score > bestScore) {

            bestScore = score
            best = s

        }
    }

    return best
}



async function deploy(ns, server, target, hackScript, growScript, weakenScript) {

    let maxRam = ns.getServerMaxRam(server)
    let usedRam = ns.getServerUsedRam(server)

    let freeRam = maxRam - usedRam

    if (freeRam < 2) return

    await ns.scp([hackScript, growScript, weakenScript], server)

    let weakenThreads = Math.floor(freeRam / 1.75)

    if (weakenThreads > 0) {

        ns.exec(weakenScript, server, weakenThreads, target)

    }

}
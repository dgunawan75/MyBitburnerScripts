/** @param {NS} ns **/
export async function main(ns) {

    const HACK_SCRIPT = "hack-template.js"
    const GROW_SCRIPT = "grow-template.js"
    const WEAK_SCRIPT = "weaken-template.js"

    const scripts = [HACK_SCRIPT, GROW_SCRIPT, WEAK_SCRIPT]

    while (true) {

        let targets = getBestTargets(ns, 5)
        let workers = getWorkers(ns)

        for (let worker of workers) {

            for (let s of scripts) {
                await ns.scp(s, worker)
            }

            if (ns.getServerMaxRam(worker) === 0) continue

            let target = targets[Math.floor(Math.random()*targets.length)]

            await runHGW(ns, worker, target)

        }

        await ns.sleep(5000)

    }

}

async function runHGW(ns, worker, target){

    let money = ns.getServerMoneyAvailable(target)
    let maxMoney = ns.getServerMaxMoney(target)

    let sec = ns.getServerSecurityLevel(target)
    let minSec = ns.getServerMinSecurityLevel(target)

    let ram = ns.getServerMaxRam(worker) - ns.getServerUsedRam(worker)

    if (ram < 2) return

    if (sec > minSec + 5){

        let threads = Math.floor(ram / ns.getScriptRam("weaken-template.js"))

        if (threads > 0)
            ns.exec("weaken-template.js",worker,threads,target)

    }

    else if (money < maxMoney * 0.7){

        let threads = Math.floor(ram / ns.getScriptRam("grow-template.js"))

        if (threads > 0)
            ns.exec("grow-template.js",worker,threads,target)

    }

    else{

        let threads = Math.floor(ram / ns.getScriptRam("hack-template.js"))

        if (threads > 0)
            ns.exec("hack-template.js",worker,threads,target)

    }

}

function getWorkers(ns){

    let workers = ["home"]

    let purchased = ns.getPurchasedServers()

    for (let p of purchased)
        workers.push(p)

    let scanned = scanAll(ns)

    for (let s of scanned){

        if (ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 8){
            workers.push(s)
        }

    }

    return workers
}

function getBestTargets(ns,count){

    let servers = scanAll(ns)

    let list = []

    for (let s of servers){

        if (!ns.hasRootAccess(s)) continue
        if (ns.getServerMaxMoney(s) <= 0) continue

        let maxMoney = ns.getServerMaxMoney(s)
        let time = ns.getHackTime(s)

        let score = maxMoney / time

        list.push({
            name:s,
            score:score
        })

    }

    list.sort((a,b)=>b.score-a.score)

    return list.slice(0,count).map(x=>x.name)

}

function scanAll(ns){

    let discovered=["home"]

    for (let i=0;i<discovered.length;i++){

        let server = discovered[i]
        let neighbors = ns.scan(server)

        for (let n of neighbors){

            if (!discovered.includes(n))
                discovered.push(n)

        }

    }

    return discovered

}

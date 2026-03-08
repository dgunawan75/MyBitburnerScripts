/** @param {NS} ns **/
export async function main(ns) {

    const hackScript = "hack-template.js"
    const growScript = "grow-template.js"
    const weakenScript = "weaken-template.js"

    while(true){

        let servers = scanAll(ns)

        for (let s of servers){
            await tryRoot(ns,s)
        }

        let targets = findBestTargets(ns,5)

        ns.tprint("TARGETS: " + targets.join(", "))

        let workers = servers.filter(s =>
            ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 4
        )

        let index = 0

        for (let worker of workers){

            let target = targets[index % targets.length]

            await deploy(ns,worker,target,hackScript,growScript,weakenScript)

            index++

        }

        await ns.sleep(60000)

    }

}



function scanAll(ns){

    let discovered = ["home"]

    for(let i=0;i<discovered.length;i++){

        let neighbors = ns.scan(discovered[i])

        for(let n of neighbors){

            if(!discovered.includes(n)){
                discovered.push(n)
            }

        }

    }

    return discovered

}



function findBestTargets(ns,count){

    let servers = scanAll(ns)

    let list = []

    for(let s of servers){

        if(!ns.hasRootAccess(s)) continue

        let maxMoney = ns.getServerMaxMoney(s)
        if(maxMoney <= 0) continue

        let hackLevel = ns.getServerRequiredHackingLevel(s)

        if(hackLevel > ns.getHackingLevel()) continue

        let hackTime = ns.getHackTime(s)

        let xpWeight = 1 / hackTime
        let moneyWeight = maxMoney / hackTime

        let score = moneyWeight * 0.7 + xpWeight * 0.3

        list.push({
            name:s,
            score:score
        })

    }

    list.sort((a,b)=>b.score-a.score)

    return list.slice(0,count).map(x=>x.name)

}



async function deploy(ns,server,target,hackScript,growScript,weakenScript){

    let maxRam = ns.getServerMaxRam(server)
    let usedRam = ns.getServerUsedRam(server)

    let freeRam = maxRam-usedRam

    if(freeRam < 2) return

    await ns.scp([hackScript,growScript,weakenScript],server)

    ns.killall(server)

    let weakenThreads = Math.floor(freeRam/1.75)

    if(weakenThreads > 0){
        ns.exec(weakenScript,server,weakenThreads,target)
    }

}



async function tryRoot(ns,server){

    if(ns.hasRootAccess(server)) return

    try{ns.brutessh(server)}catch{}
    try{ns.ftpcrack(server)}catch{}
    try{ns.relaysmtp(server)}catch{}
    try{ns.httpworm(server)}catch{}
    try{ns.sqlinject(server)}catch{}

    try{ns.nuke(server)}catch{}

}
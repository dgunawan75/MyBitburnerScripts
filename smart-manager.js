/** @param {NS} ns **/
export async function main(ns) {

    const hackScript = "hack-template.js"

    while(true){

        const servers = scan(ns)

        rootAll(ns, servers)

        const targets = findBestTargets(ns, servers)

        await deployDistributed(ns, servers, hackScript, targets)

        ns.print("Targets: " + targets.join(", "))

        await ns.sleep(60000)
    }
}



function scan(ns){

    let visited=new Set()
    let stack=["home"]

    while(stack.length){

        let s=stack.pop()

        if(!visited.has(s)){

            visited.add(s)

            for(const n of ns.scan(s))
                stack.push(n)
        }
    }

    return [...visited]
}



function rootAll(ns,servers){

    for(const s of servers){

        if(s=="home") continue

        if(ns.hasRootAccess(s)) continue

        try{

            if(ns.fileExists("BruteSSH.exe")) ns.brutessh(s)
            if(ns.fileExists("FTPCrack.exe")) ns.ftpcrack(s)
            if(ns.fileExists("relaySMTP.exe")) ns.relaysmtp(s)
            if(ns.fileExists("HTTPWorm.exe")) ns.httpworm(s)
            if(ns.fileExists("SQLInject.exe")) ns.sqlinject(s)

            if(ns.getServerNumPortsRequired(s)<=5)
                ns.nuke(s)

        }catch{}
    }
}



function findBestTargets(ns,servers){

    const myHack = ns.getHackingLevel()

    let list=[]

    for(const s of servers){

        if(!ns.hasRootAccess(s)) continue

        const req = ns.getServerRequiredHackingLevel(s)

        if(req > myHack) continue

        const money = ns.getServerMaxMoney(s)

        if(money <=0) continue

        list.push({
            server:s,
            score: money / req
        })
    }

    list.sort((a,b)=>b.score-a.score)

    return list.slice(0,5).map(x=>x.server)
}



async function deployDistributed(ns,servers,script,targets){

    let index=0

    for(const s of servers){

        if(!ns.hasRootAccess(s)) continue
        if(s=="home") continue

        const ram = ns.getServerMaxRam(s)
        const scriptRam = ns.getScriptRam(script)

        const threads = Math.floor(ram/scriptRam)

        if(threads<=0) continue

        const target = targets[index % targets.length]

        await ns.scp(script,s)

        ns.exec(script,s,threads,target)

        index++
    }
}
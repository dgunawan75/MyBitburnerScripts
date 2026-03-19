/** @param {NS} ns **/

const CONFIG = {

    HACK:     "/pro-v3/payload/hack.js",
    GROW:     "/pro-v3/payload/grow.js",
    WEAK1:    "/pro-v3/payload/weaken1.js",
    WEAK2:    "/pro-v3/payload/weaken2.js",

    BASE_STEAL: 0.10,
    SPACING: 90,
    HOME_RESERVE: 32
}

export async function main(ns){

    ns.disableLog("ALL")

    const workers = discoverWorkers(ns)

    await deployPayload(ns,workers)

    verifyPayload(ns)

    while(true){

        let target = selectTarget(ns)

        await prepTarget(ns,target,workers)

        let steal = dynamicSteal(ns,target)

        let batch = calculateBatch(ns,target,steal)

        let freeRam = totalFreeRam(ns,workers)

        let maxByRam = Math.floor(freeRam / batch.ram)

        let maxByTime = Math.floor(batch.tWeak / (CONFIG.SPACING*4))

        let concur = Math.max(1,Math.min(maxByRam,maxByTime))

        ns.print("TARGET : "+target)
        ns.print("STEAL  : "+(steal*100).toFixed(1)+"%")
        ns.print("BATCH  : "+concur)

        for(let i=0;i<concur;i++){

            let offset = i * CONFIG.SPACING * 4

            dispatch(ns,workers,CONFIG.WEAK1,
                batch.wHack,target,offset)

            dispatch(ns,workers,CONFIG.HACK,
                batch.h,target,
                batch.tWeak - batch.tHack - CONFIG.SPACING + offset)

            dispatch(ns,workers,CONFIG.GROW,
                batch.g,target,
                batch.tWeak - batch.tGrow + CONFIG.SPACING + offset)

            dispatch(ns,workers,CONFIG.WEAK2,
                batch.wGrow,target,
                CONFIG.SPACING*2 + offset)
        }

        await ns.sleep(batch.tWeak + CONFIG.SPACING*4)
    }
}

function verifyPayload(ns){

    const files = [
        CONFIG.HACK,
        CONFIG.GROW,
        CONFIG.WEAK1,
        CONFIG.WEAK2
    ]

    for (let f of files){
        if(ns.getScriptRam(f) <= 0)
            throw "Payload tidak ditemukan: " + f
    }
}

function discoverWorkers(ns){

    let visited = new Set()
    let stack = ["home"]

    while(stack.length){
        let s = stack.pop()
        if(visited.has(s)) continue
        visited.add(s)
        for(let n of ns.scan(s)) stack.push(n)
    }

    let list = []

    for(let s of visited){

        if(!ns.hasRootAccess(s)) continue

        let ram = ns.getServerMaxRam(s)

        if(s=="home") ram -= CONFIG.HOME_RESERVE

        if(ram<=0) continue

        list.push(s)
    }

    return list
}

async function deployPayload(ns,workers){

    for(let w of workers){

        if(w=="home") continue

        await ns.scp([
            CONFIG.HACK,
            CONFIG.GROW,
            CONFIG.WEAK1,
            CONFIG.WEAK2
        ],w)
    }
}

function totalFreeRam(ns,workers){

    let sum=0

    for(let w of workers)
        sum += ns.getServerMaxRam(w) - ns.getServerUsedRam(w)

    return sum
}

function selectTarget(ns){

    let visited = new Set()
    let stack = ["home"]

    while(stack.length){
        let s = stack.pop()
        if(visited.has(s)) continue
        visited.add(s)
        for(let n of ns.scan(s)) stack.push(n)
    }

    let best=null
    let bestScore=0

    for(let s of visited){

        if(!ns.hasRootAccess(s)) continue

        let maxMoney = ns.getServerMaxMoney(s)
        if(maxMoney<=0) continue

        let weaken = ns.getWeakenTime(s)
        let chance = ns.hackAnalyzeChance(s)

        let score = (maxMoney * chance) / weaken

        if(score>bestScore){
            bestScore=score
            best=s
        }
    }

    return best
}

function dynamicSteal(ns,target){

    let chance = ns.hackAnalyzeChance(target)

    if(chance > 0.9) return 0.12
    if(chance > 0.75) return 0.10
    if(chance > 0.60) return 0.08

    return 0.05
}

async function prepTarget(ns,target,workers){

    while(true){

        let money = ns.getServerMoneyAvailable(target)
        let max = ns.getServerMaxMoney(target)

        let sec = ns.getServerSecurityLevel(target)
        let min = ns.getServerMinSecurityLevel(target)

        if(money>=max*0.95 && sec<=min+2) return

        for(let w of workers){

            let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w)

            let weakRam = ns.getScriptRam(CONFIG.WEAK1)

            if(weakRam<=0) continue

            let threads = Math.floor(free / weakRam)

            if(!Number.isFinite(threads) || threads<=0) continue

            if(sec>min+2)
                ns.exec(CONFIG.WEAK1,w,threads,target)
            else
                ns.exec(CONFIG.GROW,w,threads,target)
        }

        await ns.sleep(4000)
    }
}

function calculateBatch(ns,target,steal){

    let max = ns.getServerMaxMoney(target)

    let stealMoney = max * steal

    let h = Math.floor(ns.hackAnalyzeThreads(target,stealMoney))
    if(h<1) h=1

    let g = Math.ceil(ns.growthAnalyze(target,
        max/(max-stealMoney)))

    let wHack = Math.ceil((h*0.002)/0.05)
    let wGrow = Math.ceil((g*0.004)/0.05)

    let ram =
        h*ns.getScriptRam(CONFIG.HACK)+
        g*ns.getScriptRam(CONFIG.GROW)+
        wHack*ns.getScriptRam(CONFIG.WEAK1)+
        wGrow*ns.getScriptRam(CONFIG.WEAK2)

    return {
        h,
        g,
        wHack,
        wGrow,
        ram,
        tHack: ns.getHackTime(target),
        tGrow: ns.getGrowTime(target),
        tWeak: ns.getWeakenTime(target)
    }
}

function dispatch(ns,workers,script,threads,target,delay){

    let ram = ns.getScriptRam(script)
    if(ram<=0) return

    for(let w of workers){

        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w)
        let possible = Math.floor(free / ram)

        if(!Number.isFinite(possible) || possible<=0) continue

        let use = Math.min(possible,threads)

        ns.exec(script,w,use,target,delay)

        threads -= use

        if(threads<=0) return
    }
}
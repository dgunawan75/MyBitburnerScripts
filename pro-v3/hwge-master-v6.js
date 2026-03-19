/** @param {NS} ns **/

const CONFIG = {

    HACK: "/pro-v3/payload/hack.js",
    GROW: "/pro-v3/payload/grow.js",
    WEAK1:    "/pro-v3/payload/weaken1.js",
    WEAK2:    "/pro-v3/payload/weaken2.js",

    STEAL: 0.07,
    SPACING: 70,

    HOME_RESERVE: 32
}

export async function main(ns){

    ns.disableLog("ALL")

    const workers = discoverWorkers(ns)

    await deployPayload(ns,workers)

    while(true){

        let target = bestTarget(ns)

        await prepTarget(ns,target,workers)

        let batch = createBatch(ns,target)

        let freeRam = networkFreeRam(ns,workers)

        let maxByRam = Math.floor(freeRam / batch.ram)

        let maxByTime = Math.floor(batch.tWeak / (CONFIG.SPACING*4))

        let pipeline = Math.max(1,Math.min(maxByRam,maxByTime))

        ns.print("TARGET  : "+target)
        ns.print("PIPELINE: "+pipeline)

        for(let i=0;i<pipeline;i++){

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

function discoverWorkers(ns){

    let seen=new Set()
    let stack=["home"]

    while(stack.length){

        let s=stack.pop()

        if(seen.has(s)) continue

        seen.add(s)

        for(let n of ns.scan(s)) stack.push(n)
    }

    let workers=[]

    for(let s of seen){

        if(!ns.hasRootAccess(s)) continue

        let ram=ns.getServerMaxRam(s)

        if(s=="home") ram-=CONFIG.HOME_RESERVE

        if(ram<=0) continue

        workers.push(s)
    }

    return workers
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

function networkFreeRam(ns,workers){

    let sum=0

    for(let w of workers)

        sum+=ns.getServerMaxRam(w)-ns.getServerUsedRam(w)

    return sum
}

function bestTarget(ns){

    let servers = scanAll(ns)

    let best=null
    let bestScore=0

    for(let s of servers){

        if(!ns.hasRootAccess(s)) continue

        let max=ns.getServerMaxMoney(s)

        if(max<=0) continue

        let chance=ns.hackAnalyzeChance(s)

        let hackTime=ns.getHackTime(s)

        let percent=ns.hackAnalyze(s)

        let score=(max*chance*percent)/hackTime

        if(score>bestScore){

            bestScore=score
            best=s
        }
    }

    return best
}

function scanAll(ns){

    let seen=new Set()
    let stack=["home"]

    while(stack.length){

        let s=stack.pop()

        if(seen.has(s)) continue

        seen.add(s)

        for(let n of ns.scan(s)) stack.push(n)
    }

    return [...seen]
}

async function prepTarget(ns,target,workers){

    while(true){

        let money=ns.getServerMoneyAvailable(target)
        let max=ns.getServerMaxMoney(target)

        let sec=ns.getServerSecurityLevel(target)
        let min=ns.getServerMinSecurityLevel(target)

        if(money>=max*0.99 && sec<=min+1) return

        for(let w of workers){

            let free=ns.getServerMaxRam(w)-ns.getServerUsedRam(w)

            let t=Math.floor(free/ns.getScriptRam(CONFIG.WEAK1))

            if(t<=0) continue

            if(sec>min+1)
                ns.exec(CONFIG.WEAK2,target)
            else
                ns.exec(CONFIG.GROW,w,t,target)
        }

        await ns.sleep(2000)
    }
}

function createBatch(ns,target){

    let max=ns.getServerMaxMoney(target)

    let steal=max*CONFIG.STEAL

    let h=Math.floor(ns.hackAnalyzeThreads(target,steal))

    if(h<1) h=1

    let g=Math.ceil(ns.growthAnalyze(target,
        max/(max-steal)))

    let wHack=Math.ceil((h*0.002)/0.05)

    let wGrow=Math.ceil((g*0.004)/0.05)

    let ram=
        h*ns.getScriptRam(CONFIG.HACK)+
        g*ns.getScriptRam(CONFIG.GROW)+
        wHack*ns.getScriptRam(CONFIG.WEAK1)+
        wGrow*ns.getScriptRam(CONFIG.WEAK2)

    return{

        h,
        g,
        wHack,
        wGrow,

        ram,

        tHack:ns.getHackTime(target),
        tGrow:ns.getGrowTime(target),
        tWeak:ns.getWeakenTime(target)
    }
}

function dispatch(ns,workers,script,threads,target,delay){

    let ram=ns.getScriptRam(script)

    for(let w of workers){

        let free=ns.getServerMaxRam(w)-ns.getServerUsedRam(w)

        let possible=Math.floor(free/ram)

        if(possible<=0) continue

        let use=Math.min(possible,threads)

        ns.exec(script,w,use,target,delay)

        threads-=use

        if(threads<=0) return
    }
}
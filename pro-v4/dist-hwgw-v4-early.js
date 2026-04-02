/** @param {NS} ns **/
export async function main(ns) {

    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const T_DELAY = 80;

    const HAS_FORMULAS = ns.fileExists("Formulas.exe", "home");

    const MAX_STEAL_CAP = HAS_FORMULAS ? 0.30 : 0.08;

    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");

    let WORKER_MODE = "all";
    let rawArgs = [...ns.args];

    if (rawArgs.includes("--pserv")) {
        WORKER_MODE = "pserv";
        rawArgs = rawArgs.filter(a => a !== "--pserv");
    }

    if (rawArgs.includes("--home")) {
        WORKER_MODE = "home";
        rawArgs = rawArgs.filter(a => a !== "--home");
    }

    const WORKER_MODE_LABEL =
        WORKER_MODE === "pserv" ? "🖥️ home+pserv" :
            WORKER_MODE === "home" ? "🏠 home only" :
                "🌐 all rooted";

    ns.print("=====================================");
    ns.print(" EARLY GAME HWGW ENGINE");
    ns.print(` Formulas: ${HAS_FORMULAS ? "YES" : "NO"}`);
    ns.print(` Workers : ${WORKER_MODE_LABEL}`);
    ns.print("=====================================");

    let targetLocks = {};
    let initializedWorkers = new Set(["home"]);

    while (true) {

        let workers = filterWorkers(getWorkers(ns), WORKER_MODE);

        for (let s of workers) {
            if (!initializedWorkers.has(s)) {

                await ns.scp([
                    "/pro-v3/payload/hack.js",
                    "/pro-v3/payload/grow.js",
                    "/pro-v3/payload/weaken1.js",
                    "/pro-v3/payload/weaken2.js"
                ], s, "home");

                initializedWorkers.add(s);
            }
        }

        let totalFreeRam = calcTotalRam(ns, workers);

        let maxTargets = 1;

        if (totalFreeRam > 128) maxTargets = 2;
        if (totalFreeRam > 512) maxTargets = 3;
        if (totalFreeRam > 2000) maxTargets = 4;

        if (!HAS_FORMULAS) maxTargets = Math.min(maxTargets, 2);

        let targets = getTopTargets(ns, HAS_FORMULAS, maxTargets);

        for (let target of targets) {

            let now = Date.now();

            if (targetLocks[target] && now < targetLocks[target]) continue;

            let minSec = ns.getServerMinSecurityLevel(target);
            let sec = ns.getServerSecurityLevel(target);

            let maxMoney = ns.getServerMaxMoney(target);
            let money = ns.getServerMoneyAvailable(target);

            let needWeaken = sec > minSec + 1;
            let needGrow = money < maxMoney * 0.85;

            if (needWeaken || needGrow) {

                let prepTime = performPrep(
                    ns,
                    target,
                    workers,
                    needWeaken,
                    sec,
                    minSec,
                    money,
                    maxMoney
                );

                if (prepTime > 0) {

                    targetLocks[target] = now + prepTime + 500;
                }

                continue;
            }

            let networkRam = calcTotalRam(ns, workers);

            let steal = findBestStealPercent(
                ns,
                target,
                networkRam,
                HACK_RAM,
                GROW_RAM,
                WEAK_RAM,
                MAX_STEAL_CAP
            );

            let batch = calculateBatch(ns, target, steal);

            if (!batch) continue;

            let ramPerBatch =
                batch.tHack * HACK_RAM +
                batch.tGrow * GROW_RAM +
                batch.tWeak1 * WEAK_RAM +
                batch.tWeak2 * WEAK_RAM;

            let batches = Math.max(1, Math.floor(networkRam / ramPerBatch));

            let tHack = ns.getHackTime(target);
            let tGrow = ns.getGrowTime(target);
            let tWeak = ns.getWeakenTime(target);

            let dW2 = 0;
            let dG = tWeak - tGrow - T_DELAY;
            let dW1 = tWeak - tWeak - (T_DELAY * 2);
            let dH = tWeak - tHack - (T_DELAY * 3);

            let minDelay = Math.min(dW2, dG, dW1, dH);

            if (minDelay < 0) {
                dW2 -= minDelay;
                dG -= minDelay;
                dW1 -= minDelay;
                dH -= minDelay;
            }

            let sent = 0;

            for (let b = 0; b < batches; b++) {

                if (calcTotalRam(ns, workers) < ramPerBatch) break;

                let off = b * T_DELAY * 4;

                runDistributed(ns, "/pro-v3/payload/hack.js", target, batch.tHack, dH + off, b, workers);

                runDistributed(ns, "/pro-v3/payload/weaken1.js", target, batch.tWeak1, dW1 + off, b, workers);

                runDistributed(ns, "/pro-v3/payload/grow.js", target, batch.tGrow, dG + off, b, workers);

                runDistributed(ns, "/pro-v3/payload/weaken2.js", target, batch.tWeak2, dW2 + off, b, workers);

                sent++;
            }

            if (sent > 0) {

                let cycle = -minDelay + tWeak + sent * T_DELAY * 4;

                targetLocks[target] = now + cycle;

                ns.print(`🚀 ${target} | ${sent} batch | steal ${(batch.actualSteal * 100).toFixed(1)}%`);
            }
        }

        await ns.sleep(250);
    }
}

function performPrep(ns, target, workers, isWeaken, sec, minSec, money, maxMoney) {

    let script = isWeaken
        ? "/pro-v3/payload/weaken1.js"
        : "/pro-v3/payload/grow.js";

    let wait = isWeaken
        ? ns.getWeakenTime(target)
        : ns.getGrowTime(target);

    let threads;

    if (isWeaken) {

        threads = Math.ceil((sec - minSec) / 0.05);

    } else {

        let mult = maxMoney / Math.max(1, money);

        threads = Math.ceil(ns.growthAnalyze(target, mult));
    }

    threads = Math.min(threads, 200);

    let sent = 0;

    for (let s of workers) {

        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);

        if (s === "home") free -= 64;

        let can = Math.floor(free / ns.getScriptRam(script));

        let use = Math.min(can, threads - sent);

        if (use > 0) {

            if (ns.exec(script, s, use, target, 0, "prep", Math.random()) > 0) {

                sent += use;
            }
        }

        if (sent >= threads) break;
    }

    if (sent > 0) {

        ns.print(`prep ${target} ${isWeaken ? "weaken" : "grow"} ${sent}`);

        return wait;
    }

    return 0;
}

function getTopTargets(ns, hasFormulas, limit) {

    let visited = new Set();
    let stack = ["home"];

    while (stack.length) {

        let s = stack.pop();

        if (visited.has(s)) continue;

        visited.add(s);

        for (let n of ns.scan(s)) stack.push(n);
    }

    let list = [];

    for (let s of visited) {

        if (!ns.hasRootAccess(s)) continue;

        let max = ns.getServerMaxMoney(s);

        if (max <= 0) continue;

        let req = ns.getServerRequiredHackingLevel(s);

        if (req > ns.getHackingLevel() / 3) continue;

        let score = (max * ns.hackAnalyzeChance(s) * ns.hackAnalyze(s))
            / ns.getWeakenTime(s);

        list.push({ s, score });
    }

    list.sort((a, b) => b.score - a.score);

    return list.slice(0, limit).map(t => t.s);
}

function calculateBatch(ns, target, steal) {

    let hackPct = ns.hackAnalyze(target);

    if (hackPct <= 0) return null;

    let tHack = Math.max(1, Math.floor(steal / hackPct));

    let actual = tHack * hackPct;

    let tWeak1 = Math.ceil((tHack * 0.002) / 0.05);

    let growMult = 1 / (1 - actual);

    let tGrow = Math.ceil(ns.growthAnalyze(target, growMult) * 1.03);

    let tWeak2 = Math.ceil((tGrow * 0.004) / 0.05);

    return { tHack, tGrow, tWeak1, tWeak2, actualSteal: actual };
}

function findBestStealPercent(ns, target, ram, hRam, gRam, wRam, maxCap) {

    let lo = 0.001;
    let hi = maxCap;
    let best = lo;

    for (let i = 0; i < 15; i++) {

        let mid = (lo + hi) / 2;

        let b = calculateBatch(ns, target, mid);

        if (!b) { hi = mid; continue; }

        let need =
            b.tHack * hRam +
            b.tGrow * gRam +
            b.tWeak1 * wRam +
            b.tWeak2 * wRam;

        if (need <= ram) {

            best = mid;
            lo = mid;

        } else {

            hi = mid;
        }
    }

    return best;
}

function runDistributed(ns, script, target, threads, delay, batch, workers) {

    for (let s of workers) {

        if (threads <= 0) return;

        let free = ns.getServerMaxRam(s) - ns.getServerUsedRam(s);

        if (s === "home") free -= 64;

        let step = ns.getScriptRam(script);

        let can = Math.floor(free / step);

        let use = Math.min(can, threads);

        if (use > 0) {

            if (ns.exec(script, s, use, target, delay, batch, Math.random()) > 0) {

                threads -= use;
            }
        }
    }
}

function calcTotalRam(ns, workers) {

    let total = 0;

    for (let w of workers) {

        let free = ns.getServerMaxRam(w) - ns.getServerUsedRam(w);

        if (w === "home") free -= 64;

        if (free > 0) total += free;
    }

    return total;
}

function getWorkers(ns) {

    let visited = new Set();
    let stack = ["home"];

    while (stack.length) {

        let s = stack.pop();

        if (visited.has(s)) continue;

        visited.add(s);

        for (let n of ns.scan(s)) stack.push(n);
    }

    return [...visited].filter(s => ns.hasRootAccess(s) && ns.getServerMaxRam(s) > 0);
}

function filterWorkers(workers, mode) {

    if (mode === "home") return workers.filter(s => s === "home");

    if (mode === "pserv") return workers.filter(s => s === "home" || s.startsWith("pserv-"));

    return workers;
}
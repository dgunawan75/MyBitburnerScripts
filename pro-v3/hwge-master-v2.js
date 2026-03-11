/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    const target = ns.args[0];
    const useAllServers = ns.args[1] === "--all" || true; // Default true

    if (!target || !ns.serverExists(target)) {
        ns.tprint("ERROR: Target tidak valid! Contoh: run hwgw-master.js n00dles --all");
        return;
    }

    if (!ns.hasRootAccess(target)) {
        ns.tprint(`ERROR: Belum root access ke ${target}`);
        return;
    }

    // KONFIGURASI SUPER
    const CONFIG = {
        TARGET: target,
        STEAL_PERCENT: 0.45, // 45% lebih aman dari 50%
        MIN_SEC_MARGIN: 0.05,
        MAX_MONEY_MARGIN: 0.99,
        HOME_RAM_RESERVE: 128, // Reserve lebih besar untuk stability
        BATCH_SPACING: 45, // ms (lebih presisi dari 50)
        MAX_CONCURRENT_BATCHES: 0, // Akan dihitung otomatis
        USE_PURCHASED_SERVERS: true,
        USE_HOME: true,
        PROFILING: true,
        AUTO_ADJUST: true // Auto adjust thread jika RAM terbatas
    };

    // Inisialisasi stats tracking
    const stats = {
        batchesStarted: 0,
        batchesCompleted: 0,
        batchesFailed: 0,
        totalMoneyStolen: 0,
        startTime: Date.now(),
        lastBatchTime: 0,
        activeBatches: new Map()
    };

    // Dapatkan semua worker servers
    const workers = await getWorkers(ns, CONFIG);
    ns.print(`🚀 WORKERS READY: ${workers.length} servers available`);

    // PREP PHASE - Enhanced
    await superPrep(ns, target, workers, CONFIG);

    // CALCULATE BATCH - With safety margins
    const batchDesign = await calculateSuperBatch(ns, target, CONFIG.STEAL_PERCENT);
    if (!batchDesign) {
        ns.tprint("ERROR: Gagal menghitung batch design!");
        return;
    }

    // Calculate RAM requirements
    const ramPerBatch = calculateBatchRAM(ns, batchDesign);
    CONFIG.MAX_CONCURRENT_BATCHES = calculateMaxBatches(ns, workers, ramPerBatch, CONFIG);

    ns.print(`===========================================`);
    ns.print(`🔥 SUPER HWGW ENGINE ACTIVATED`);
    ns.print(`🎯 TARGET: ${target}`);
    ns.print(`📊 BATCH DESIGN:`);
    ns.print(`   ├─ Hack: ${batchDesign.tHack} threads (${batchDesign.hackPercent.toFixed(2)}%)`);
    ns.print(`   ├─ Weaken1: ${batchDesign.tWeak1} threads`);
    ns.print(`   ├─ Grow: ${batchDesign.tGrow} threads`);
    ns.print(`   └─ Weaken2: ${batchDesign.tWeak2} threads`);
    ns.print(`💾 RAM per Batch: ${ns.formatNumber(ramPerBatch)} GB`);
    ns.print(`🔄 Max Concurrent: ${CONFIG.MAX_CONCURRENT_BATCHES}`);
    ns.print(`⚡ Cycle Time: ${ns.tFormat(batchDesign.times.weaken)}`);
    ns.print(`💰 Est. Income: ${ns.formatNumber(batchDesign.expectedMoney * CONFIG.MAX_CONCURRENT_BATCHES * (3600000 / batchDesign.times.weaken))}/hour`);
    ns.print(`===========================================`);

    // MAIN DISPATCHER LOOP - Enhanced
    await superDispatcher(ns, target, workers, batchDesign, CONFIG, stats);
}

// ==========================================
// GET WORKERS - Dapatkan semua server yang bisa digunakan
// ==========================================
async function getWorkers(ns, config) {
    const workers = [];

    // Home server (dengan reserve)
    if (config.USE_HOME) {
        workers.push({
            host: "home",
            maxRam: ns.getServerMaxRam("home") - config.HOME_RAM_RESERVE,
            usedRam: 0,
            type: "home"
        });
    }

    // Purchased servers
    const pservs = ns.getPurchasedServers(); // <-- definisikan di sini
    if (config.USE_PURCHASED_SERVERS) {
        for (const server of pservs) {
            workers.push({
                host: server,
                maxRam: ns.getServerMaxRam(server),
                usedRam: 0,
                type: "pserv"
            });
        }
    }

    // Hacking servers (optional - servers yang sudah di-root)
    if (ns.args.includes("--hacknet")) { // bisa diganti --hacked
        const allServers = scanAllServers(ns);
        for (const server of allServers) {
            if (server !== "home" &&
                !pservs.includes(server) &&
                ns.hasRootAccess(server) &&
                ns.getServerMaxRam(server) >= 64) {
                workers.push({
                    host: server,
                    maxRam: ns.getServerMaxRam(server),
                    usedRam: 0,
                    type: "hacked"
                });
            }
        }
    }

    return workers;
}

// ==========================================
// SUPER PREP - Parallel preparation
// ==========================================
async function superPrep(ns, target, workers, config) {
    ns.print("🔧 SUPER PREP PHASE STARTED");

    const minSec = ns.getServerMinSecurityLevel(target);
    const maxMoney = ns.getServerMaxMoney(target);

    while (true) {
        const currentSec = ns.getServerSecurityLevel(target);
        const currentMoney = ns.getServerMoneyAvailable(target);

        // Clear log and display status
        ns.clearLog();
        displayPrepStatus(ns, target, currentSec, minSec, currentMoney, maxMoney);

        if (currentSec <= minSec + config.MIN_SEC_MARGIN &&
            currentMoney >= maxMoney * config.MAX_MONEY_MARGIN) {
            ns.print("✅ TARGET READY FOR BATCHING!");
            break;
        }

        // Parallel execution on all workers
        const scripts = [];

        if (currentSec > minSec + config.MIN_SEC_MARGIN) {
            // Weaken phase
            scripts.push({
                script: "/pro-v3/payload/weaken1.js",
                time: ns.getWeakenTime(target),
                priority: 1
            });
        } else {
            // Grow phase
            scripts.push({
                script: "/pro-v3/payload/grow.js",
                time: ns.getGrowTime(target),
                priority: 2
            });
        }

        // Execute on all workers in parallel
        await parallelExecute(ns, workers, scripts, target, 0, config);

        // Wait for longest operation
        const waitTime = Math.max(...scripts.map(s => s.time)) + 2000;
        ns.print(`⏳ Prep operations running... waiting ${ns.tFormat(waitTime)}`);
        await ns.sleep(waitTime);
    }
}

// ==========================================
// PARALLEL EXECUTION - Run scripts on multiple workers
// ==========================================
async function parallelExecute(ns, workers, scripts, target, baseDelay, config, batchId = 0) {
    const executions = [];

    // Reset worker used RAM
    workers.forEach(w => w.usedRam = 0);

    for (const scriptConfig of scripts) {
        const script = scriptConfig.script;
        const scriptRam = ns.getScriptRam(script);
        // Jika threads tidak ditentukan, jalankan sebanyak mungkin (Infinity)
        let remainingThreads = scriptConfig.threads !== undefined ? scriptConfig.threads : Infinity;

        // Sort workers by available RAM (descending)
        const sortedWorkers = [...workers].sort((a, b) => {
            const aAvail = a.maxRam - a.usedRam;
            const bAvail = b.maxRam - b.usedRam;
            return bAvail - aAvail;
        });

        for (const worker of sortedWorkers) {
            if (remainingThreads <= 0) break;

            const availableRam = worker.maxRam - worker.usedRam;
            const maxThreads = Math.floor(availableRam / scriptRam);

            if (maxThreads > 0) {
                const threads = Math.min(maxThreads, remainingThreads);

                // Copy script if needed
                if (worker.host !== "home") {
                    await ns.scp(script, worker.host, "home");
                }

                // Execute
                const pid = ns.exec(script, worker.host, threads, target, baseDelay, batchId);
                if (pid > 0) {
                    worker.usedRam += threads * scriptRam;
                    remainingThreads -= threads;

                    executions.push({
                        pid,
                        host: worker.host,
                        script,
                        threads,
                        batchId
                    });
                }
            }
        }

        // Update scriptConfig with actual threads executed
        scriptConfig.executedThreads = (scriptConfig.threads !== undefined ? scriptConfig.threads : Infinity) - remainingThreads;
    }

    return executions;
}

// ==========================================
// SUPER BATCH CALCULATION - With dynamic adjustments
// ==========================================
function calculateSuperBatch(ns, target, stealPercent) {
    const server = ns.getServer(target);
    const player = ns.getPlayer();

    // Set ideal conditions
    server.hackDifficulty = server.minDifficulty;
    server.moneyAvailable = server.moneyMax;

    // Calculate hack threads with safety margin
    const hackPerThread = ns.formulas.hacking.hackPercent(server, player);
    if (hackPerThread <= 0) {
        ns.print(`❌ Cannot hack ${target} - level too low`);
        return null;
    }

    // Adjust steal percent if needed
    let tHack = Math.floor(stealPercent / hackPerThread);
    let actualStealPercent = tHack * hackPerThread;

    if (tHack === 0) {
        tHack = 1;
        actualStealPercent = hackPerThread;
    }

    // Cap at 95% max to avoid issues
    if (actualStealPercent > 0.95) {
        tHack = Math.floor(0.95 / hackPerThread);
        actualStealPercent = tHack * hackPerThread;
    }

    // Security increases
    const hackSecIncrease = tHack * 0.002;
    const tWeak1 = Math.max(1, Math.ceil(hackSecIncrease / 0.05));

    // Grow calculations
    server.moneyAvailable = server.moneyMax * (1 - actualStealPercent);
    let tGrow = Math.ceil(ns.formulas.hacking.growThreads(server, player, server.moneyMax));

    // Grow security increase
    const growSecIncrease = tGrow * 0.004;
    const tWeak2 = Math.max(1, Math.ceil(growSecIncrease / 0.05));

    // Get operation times
    const timeHack = ns.getHackTime(target);
    const timeGrow = ns.getGrowTime(target);
    const timeWeaken = ns.getWeakenTime(target);

    return {
        tHack,
        tWeak1,
        tGrow,
        tWeak2,
        hackPercent: actualStealPercent,
        expectedMoney: server.moneyMax * actualStealPercent,
        times: {
            hack: timeHack,
            grow: timeGrow,
            weaken: timeWeaken
        }
    };
}

// ==========================================
// SUPER DISPATCHER - Advanced batch management
// ==========================================
async function superDispatcher(ns, target, workers, batchDesign, config, stats) {
    let batchNumber = 1;
    const activeBatches = new Map();

    // Pre-calculate delays
    const baseDelays = calculateDelays(batchDesign.times, config.BATCH_SPACING);

    while (true) {
        // Clean up completed batches
        cleanupCompletedBatches(ns, activeBatches);

        // Check if we can launch new batch
        const availableRAM = getTotalAvailableRAM(ns, workers, config);
        const ramPerBatch = calculateBatchRAM(ns, batchDesign);

        if (availableRAM >= ramPerBatch && activeBatches.size < config.MAX_CONCURRENT_BATCHES) {
            // Launch batch
            const batchId = batchNumber++;
            const delays = calculateBatchDelays(baseDelays, activeBatches.size);

            // Prepare batch scripts
            const scripts = [
                { script: "/pro-v3/payload/hack.js", threads: batchDesign.tHack, delay: delays.hack },
                { script: "/pro-v3/payload/weaken1.js", threads: batchDesign.tWeak1, delay: delays.weaken1 },
                { script: "/pro-v3/payload/grow.js", threads: batchDesign.tGrow, delay: delays.grow },
                { script: "/pro-v3/payload/weaken2.js", threads: batchDesign.tWeak2, delay: delays.weaken2 }
            ].filter(s => s.threads > 0);

            // Execute batch
            const executions = await parallelExecute(ns, workers, scripts, target, 0, config, batchId);

            // Track batch
            activeBatches.set(batchId, {
                id: batchId,
                startTime: Date.now(),
                endTime: Date.now() + batchDesign.times.weaken + 5000,
                executions,
                expectedMoney: batchDesign.expectedMoney
            });

            stats.batchesStarted++;
            stats.lastBatchTime = Date.now();

            // Display status
            displayBatchStatus(ns, stats, activeBatches, config);
        } else {
            // Wait a bit before checking again
            await ns.sleep(100);
        }

        // Adjust config if needed (auto-scaling)
        if (config.AUTO_ADJUST && stats.batchesStarted % 10 === 0) {
            await autoAdjustConfig(ns, workers, batchDesign, config, stats);
        }
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateDelays(times, spacing) {
    // Optimized delay calculation for perfect landing
    const baseTime = times.weaken;

    return {
        weaken2: baseTime - times.weaken, // 0 delay for last weaken
        grow: baseTime - times.grow - spacing,
        weaken1: baseTime - times.weaken - (spacing * 2),
        hack: baseTime - times.hack - (spacing * 3)
    };
}

function calculateBatchDelays(baseDelays, offset) {
    const offsetMs = offset * 4 * 45; // Offset based on current queue

    return {
        hack: baseDelays.hack + offsetMs,
        weaken1: baseDelays.weaken1 + offsetMs,
        grow: baseDelays.grow + offsetMs,
        weaken2: baseDelays.weaken2 + offsetMs
    };
}

function calculateBatchRAM(ns, batchDesign) {
    const HACK_RAM = ns.getScriptRam("/pro-v3/payload/hack.js");
    const WEAK_RAM = ns.getScriptRam("/pro-v3/payload/weaken1.js");
    const GROW_RAM = ns.getScriptRam("/pro-v3/payload/grow.js");

    return (batchDesign.tHack * HACK_RAM) +
        (batchDesign.tWeak1 * WEAK_RAM) +
        (batchDesign.tGrow * GROW_RAM) +
        (batchDesign.tWeak2 * WEAK_RAM);
}

function getTotalAvailableRAM(ns, workers, config) {
    let total = 0;
    for (const worker of workers) {
        const used = ns.getServerUsedRam(worker.host);
        const max = worker.host === "home" ?
            ns.getServerMaxRam(worker.host) - config.HOME_RAM_RESERVE :
            ns.getServerMaxRam(worker.host);
        total += Math.max(0, max - used);
    }
    return total;
}

function calculateMaxBatches(ns, workers, ramPerBatch, config) {
    const totalRAM = workers.reduce((sum, w) => {
        const maxRam = w.host === "home" ?
            w.maxRam - config.HOME_RAM_RESERVE :
            w.maxRam;
        return sum + maxRam;
    }, 0);

    const batchByRAM = Math.floor(totalRAM / ramPerBatch);
    const batchByTime = Math.floor(ns.getWeakenTime(config.TARGET) / (config.BATCH_SPACING * 4));

    return Math.min(batchByRAM, batchByTime, 50); // Cap at 50 for stability
}

function cleanupCompletedBatches(ns, activeBatches) {
    const now = Date.now();
    for (const [id, batch] of activeBatches) {
        if (now > batch.endTime) {
            activeBatches.delete(id);
        }
    }
}

function displayPrepStatus(ns, target, sec, minSec, money, maxMoney) {
    const secPercent = ((sec - minSec) / minSec * 100).toFixed(1);
    const moneyPercent = (money / maxMoney * 100).toFixed(1);

    ns.print(`📊 PREP STATUS: ${target}`);
    ns.print(`   Security: ${sec.toFixed(2)} / ${minSec.toFixed(2)} (${secPercent}% above min)`);
    ns.print(`   Money: $${ns.formatNumber(money)} / $${ns.formatNumber(maxMoney)} (${moneyPercent}%)`);
}

function displayBatchStatus(ns, stats, activeBatches, config) {
    const runtime = (Date.now() - stats.startTime) / 1000;
    const bps = runtime > 0 ? stats.batchesStarted / runtime : 0;
    const estimatedMoney = stats.batchesStarted * config.STEAL_PERCENT * 1000000000; // Rough estimate

    ns.clearLog();
    ns.print(`🚀 SUPER HWGW ENGINE RUNNING`);
    ns.print(`📈 Batches: ${stats.batchesStarted} started, ${activeBatches.size} active`);
    ns.print(`💰 Est. Stolen: $${ns.formatNumber(estimatedMoney)}`);
    ns.print(`⚡ Rate: ${bps.toFixed(2)} batches/sec`);
    ns.print(`🔄 Active Batch IDs: ${Array.from(activeBatches.keys()).join(', ')}`);
}

async function autoAdjustConfig(ns, workers, batchDesign, config, stats) {
    // Auto-adjust based on performance
    const runtime = (Date.now() - stats.startTime) / 1000;
    if (runtime < 10 || stats.batchesStarted === 0) return;

    const avgBatchTime = runtime / stats.batchesStarted * 1000; // in ms
    const theoreticalTime = batchDesign.times.weaken;

    if (avgBatchTime > theoreticalTime * 1.2) {
        // Too slow, reduce concurrent batches
        config.MAX_CONCURRENT_BATCHES = Math.max(1, config.MAX_CONCURRENT_BATCHES - 1);
        ns.print(`⚠️ Adjusting concurrency down to ${config.MAX_CONCURRENT_BATCHES}`);
    } else if (avgBatchTime < theoreticalTime * 0.8 && config.MAX_CONCURRENT_BATCHES < 50) {
        // Too fast, can handle more
        config.MAX_CONCURRENT_BATCHES = Math.min(50, config.MAX_CONCURRENT_BATCHES + 1);
        ns.print(`⚡ Adjusting concurrency up to ${config.MAX_CONCURRENT_BATCHES}`);
    }
}

function scanAllServers(ns) {
    const visited = new Set();
    const queue = ["home"];
    const servers = [];

    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;

        visited.add(current);
        servers.push(current);

        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }

    return servers;
}
/** @param {NS} ns
 *  ═══════════════════════════════════════════════════════════
 *  FACTION GRINDER — Automated Reputation Farmer
 *  ═══════════════════════════════════════════════════════════
 *  Menggunakan Singularity API untuk otomatis:
 *  - Pilih faction terbaik berdasarkan augment yang dibutuhkan
 *  - Bekerja dengan tipe terbaik (hacking > field > security)
 *  - Auto-donasi ketika favor ≥ 150
 *  - Tracking progress + ETA
 *  - Koordinasi dengan share-master.js untuk rep boost
 *
 *  REQUIRES: Source-File 4 (Singularity API)
 *  RAM: ~50-60GB (SF4.1) / ~25GB (SF4.2) / ~12GB (SF4.3)
 *
 *  Usage:
 *    run pro-v4/faction-grinder.js
 *    run pro-v4/faction-grinder.js --faction "NiteSec"
 *    run pro-v4/faction-grinder.js --auto-join --no-focus
 *    run pro-v4/faction-grinder.js --auto-donate
 */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    ns.ui.openTail();

    // ── Cek Singularity API ────────────────────────────────────────────
    try {
        ns.singularity.getCurrentWork();
    } catch (e) {
        ns.tprint("❌ ERROR: Singularity API tidak tersedia!");
        ns.tprint("   Butuh Source-File 4 (dari BN-4: The Singularity).");
        ns.tprint("   Tanpa SF4, gunakan share-master.js + kerja manual di UI.");
        return;
    }

    // ── Parse Arguments ────────────────────────────────────────────────
    const args = ns.flags([
        ["faction", ""],         // Paksa faction tertentu
        ["auto-join", false],    // Otomatis join undangan faction
        ["auto-donate", false],  // Otomatis donasi jika favor ≥ 150
        ["no-focus", false],     // Jangan fokus kerja (bisa multitask di UI)
        ["money-reserve", 0],    // Simpan minimal $ ini setelah donasi (0 = auto 10%)
    ]);

    const FOCUS       = !args["no-focus"];
    const AUTO_JOIN   = args["auto-join"];
    const AUTO_DONATE = args["auto-donate"];
    const FORCED_FACTION = args["faction"];

    const FAVOR_THRESHOLD = 150;  // Favor minimum untuk bisa donasi
    const CYCLE_MS = 15000;       // Refresh tiap 15 detik
    const NFG = "NeuroFlux Governor";  // Augment infinite, diexclude dari tracking

    // ── Rep tracking untuk ETA ─────────────────────────────────────────
    let repHistory = {};  // { factionName: [{ts, rep}] }
    let lastWorkFaction = "";
    let lastWorkType = "";
    let cycleCount = 0;

    ns.print("═══════════════════════════════════════════");
    ns.print(" 🏛️  FACTION GRINDER — v1.0                ");
    ns.print(`    Focus  : ${FOCUS ? "✅ ON (max speed)" : "⚡ OFF (multitask)"}`);
    ns.print(`    Donate : ${AUTO_DONATE ? "✅ AUTO" : "❌ Manual"}`);
    ns.print(`    Join   : ${AUTO_JOIN ? "✅ AUTO" : "❌ Manual"}`);
    if (FORCED_FACTION) ns.print(`    Force  : 🎯 ${FORCED_FACTION}`);
    ns.print("═══════════════════════════════════════════");

    while (true) {
        cycleCount++;

        // ── Auto-join faction invitations ──────────────────────────────
        if (AUTO_JOIN) {
            try {
                let invites = ns.singularity.checkFactionInvitations();
                for (let inv of invites) {
                    ns.singularity.joinFaction(inv);
                    ns.print(`✅ Auto-joined: ${inv}`);
                }
            } catch {}
        }

        // ── Analisis semua faction ─────────────────────────────────────
        const player = ns.getPlayer();
        const ownedAugs = ns.singularity.getOwnedAugmentations(true); // termasuk purchased

        let factionData = analyzeFactions(ns, player, ownedAugs, NFG, FAVOR_THRESHOLD);

        // ── Update rep history untuk ETA ───────────────────────────────
        for (let fd of factionData) {
            if (!repHistory[fd.name]) repHistory[fd.name] = [];
            repHistory[fd.name].push({ ts: Date.now(), rep: fd.currentRep });
            // Keep last 2 menit (8 × 15s)
            if (repHistory[fd.name].length > 8) repHistory[fd.name].shift();
        }

        // ── Pilih target faction ──────────────────────────────────────
        let target = null;
        if (FORCED_FACTION) {
            target = factionData.find(f => f.name === FORCED_FACTION);
            if (!target) {
                // Faction dipaksa tapi tidak ditemukan / tidak punya augment
                ns.print(`⚠️ Faction "${FORCED_FACTION}" tidak ditemukan atau semua augment sudah dimiliki.`);
            }
        }

        if (!target && factionData.length > 0) {
            // Strategi prioritas:
            // 1. Faction yang SUDAH cukup rep → beli augment! (bukan grind lagi)
            // 2. Faction dengan paling banyak augment remaining & closest to completion
            factionData.sort((a, b) => {
                // Jika bisa donasi, skor lebih tinggi (lebih cepat selesai)
                if (a.canDonate && !b.canDonate) return -1;
                if (!a.canDonate && b.canDonate) return 1;

                // Score: augments × completion ratio
                let compA = a.maxRepNeeded > 0 ? a.currentRep / a.maxRepNeeded : 1;
                let compB = b.maxRepNeeded > 0 ? b.currentRep / b.maxRepNeeded : 1;
                let scoreA = a.augsNeeded * (0.3 + 0.7 * compA);
                let scoreB = b.augsNeeded * (0.3 + 0.7 * compB);
                return scoreB - scoreA;
            });
            target = factionData[0];
        }

        // ── Handle: Tidak ada target ──────────────────────────────────
        if (!target) {
            ns.clearLog();
            printHeader(ns, FOCUS, AUTO_DONATE, AUTO_JOIN, FORCED_FACTION);
            ns.print(`\n🏆 SEMUA AUGMENT SUDAH DIMILIKI!`);
            ns.print(`   Tidak ada faction yang perlu di-grind.`);
            ns.print(`   Pertimbangkan: Install augmentations untuk reset.`);
            await ns.sleep(60000);
            continue;
        }

        // ── Mulai/lanjutkan kerja untuk faction target ────────────────
        let currentWork = ns.singularity.getCurrentWork();
        let isWorkingCorrectly = currentWork
            && currentWork.type === "FACTION"
            && currentWork.factionName === target.name;

        if (!isWorkingCorrectly) {
            let result = startBestWork(ns, target.name, FOCUS);
            if (result) {
                lastWorkFaction = target.name;
                lastWorkType = result;
            }
        } else {
            lastWorkFaction = target.name;
            lastWorkType = currentWork.factionWorkType || "unknown";
        }

        // ── Auto-donate jika eligible ─────────────────────────────────
        let donateResult = null;
        if (AUTO_DONATE && target.canDonate && target.repRemaining > 0) {
            donateResult = handleDonation(ns, target, player, args["money-reserve"]);
        }

        // ── Cek augment yang siap dibeli ──────────────────────────────
        let readyToBuy = [];
        for (let fd of factionData) {
            for (let aug of fd.augDetails) {
                if (fd.currentRep >= aug.repReq) {
                    readyToBuy.push({
                        faction: fd.name,
                        augName: aug.name,
                        price: aug.price,
                        canAfford: player.money >= aug.price
                    });
                }
            }
        }

        // ── Hitung ETA ────────────────────────────────────────────────
        let repRate = calcRepRate(repHistory[target.name] || []);
        let etaSeconds = repRate > 0 && target.repRemaining > 0
            ? target.repRemaining / repRate
            : -1;

        // ── Refresh rep setelah kemungkinan donasi ────────────────────
        if (donateResult) {
            target.currentRep = ns.singularity.getFactionRep(target.name);
            target.repRemaining = Math.max(0, target.maxRepNeeded - target.currentRep);
        }

        // ── Display Dashboard ─────────────────────────────────────────
        ns.clearLog();
        printHeader(ns, FOCUS, AUTO_DONATE, AUTO_JOIN, FORCED_FACTION);

        // Share power
        let sharePower = 1;
        try { sharePower = ns.getSharePower(); } catch {}
        let shareBonus = ((sharePower - 1) * 100).toFixed(1);

        ns.print(`🌟 Share Power : ×${sharePower.toFixed(2)} (+${shareBonus}% rep boost)`);

        // Current target
        ns.print(`\n📊 TARGET AKTIF: ${target.name}`);
        let pct = target.maxRepNeeded > 0 ? target.currentRep / target.maxRepNeeded * 100 : 100;
        let bar = makeBar(Math.min(pct, 100), 20);
        ns.print(`   Rep: ${fmtN(ns, target.currentRep)} / ${fmtN(ns, target.maxRepNeeded)} ${bar} ${pct.toFixed(1)}%`);
        ns.print(`   Favor: ${target.favor.toFixed(0)} ${target.canDonate ? "✅ (bisa donasi)" : `(perlu ${FAVOR_THRESHOLD})`}`);
        ns.print(`   Kerja: ${lastWorkType} | Augs remaining: ${target.augsNeeded}`);
        if (repRate > 0) ns.print(`   Rate: ${fmtN(ns, repRate)}/s | ETA: ${fmtTime(etaSeconds)}`);
        else if (target.repRemaining > 0) ns.print(`   Rate: menghitung... (tunggu 2-3 siklus)`);
        else ns.print(`   ✅ REP CUKUP! Siap beli augment.`);

        // Faction queue
        ns.print(`\n📋 ANTRIAN FACTION (${factionData.length}):`);
        let shown = 0;
        for (let fd of factionData) {
            if (shown >= 8) { ns.print(`   ... dan ${factionData.length - shown} lainnya`); break; }
            let fp = fd.maxRepNeeded > 0 ? (fd.currentRep / fd.maxRepNeeded * 100).toFixed(0) : 100;
            let status = fd.repRemaining <= 0 ? "✅" : fd.canDonate ? "💰" : "⏳";
            let fdRate = calcRepRate(repHistory[fd.name] || []);
            let fdEta = fdRate > 0 && fd.repRemaining > 0 ? fmtTime(fd.repRemaining / fdRate) : "—";
            let marker = fd.name === target.name ? " ◄" : "";
            ns.print(`   ${status} ${fd.name.padEnd(20)} ${fd.augsNeeded} augs | ${fp.padStart(3)}% | ETA: ${fdEta}${marker}`);
            shown++;
        }

        // Donation status
        if (AUTO_DONATE) {
            ns.print(`\n💰 DONASI:`);
            let donatable = factionData.filter(f => f.canDonate && f.repRemaining > 0);
            if (donatable.length > 0) {
                for (let fd of donatable.slice(0, 3)) {
                    let repMult = player.mults?.faction_rep || 1;
                    let costToDonate = Math.ceil(fd.repRemaining * 1e6 / repMult);
                    ns.print(`   ${fd.name}: perlu $${fmtN(ns, costToDonate)} untuk ${fmtN(ns, fd.repRemaining)} rep`);
                }
            } else {
                ns.print(`   Tidak ada faction dengan favor ≥ ${FAVOR_THRESHOLD}`);
            }
            if (donateResult) ns.print(`   📤 Terakhir donasi: $${fmtN(ns, donateResult)} ke ${target.name}`);
        }

        // Ready to buy
        if (readyToBuy.length > 0) {
            ns.print(`\n🛒 SIAP DIBELI (${readyToBuy.length}):`);
            for (let r of readyToBuy.slice(0, 5)) {
                let afford = r.canAfford ? "✅" : "💸";
                ns.print(`   ${afford} ${r.augName} — $${fmtN(ns, r.price)} (${r.faction})`);
            }
            if (readyToBuy.length > 5) ns.print(`   ... dan ${readyToBuy.length - 5} lainnya`);
        }

        ns.print(`\n⏳ Refresh: ${CYCLE_MS / 1000}s | Cycle: #${cycleCount}`);

        await ns.sleep(CYCLE_MS);
    }
}

// ═══════════════════════════════════════════════════════════
// ANALISIS FACTION
// ═══════════════════════════════════════════════════════════
function analyzeFactions(ns, player, ownedAugs, NFG, FAVOR_THRESHOLD) {
    const joinedFactions = player.factions || [];
    let results = [];

    for (let faction of joinedFactions) {
        let availAugs;
        try {
            availAugs = ns.singularity.getAugmentationsFromFaction(faction);
        } catch { continue; }

        // Filter: hanya augment yang belum dimiliki (exclude NeuroFlux Governor)
        let neededAugs = availAugs.filter(a => a !== NFG && !ownedAugs.includes(a));
        if (neededAugs.length === 0) continue;

        let currentRep, favor;
        try {
            currentRep = ns.singularity.getFactionRep(faction);
            favor = ns.singularity.getFactionFavor(faction);
        } catch { continue; }

        let canDonate = favor >= FAVOR_THRESHOLD;

        // Detail setiap augment yang dibutuhkan
        let maxRepNeeded = 0;
        let augDetails = [];
        for (let aug of neededAugs) {
            try {
                let repReq = ns.singularity.getAugmentationRepReq(aug);
                let price = ns.singularity.getAugmentationPrice(aug);
                augDetails.push({ name: aug, repReq, price });
                if (repReq > maxRepNeeded) maxRepNeeded = repReq;
            } catch { }
        }
        augDetails.sort((a, b) => b.repReq - a.repReq);

        let repRemaining = Math.max(0, maxRepNeeded - currentRep);

        results.push({
            name: faction,
            augsNeeded: neededAugs.length,
            augDetails,
            currentRep,
            maxRepNeeded,
            repRemaining,
            favor,
            canDonate,
        });
    }

    return results;
}

// ═══════════════════════════════════════════════════════════
// MULAI KERJA — Coba tipe terbaik
// ═══════════════════════════════════════════════════════════
function startBestWork(ns, factionName, focus) {
    // Urutkan: hacking paling optimal untuk player hacking-focused
    const workTypes = ["hacking", "field", "security"];

    for (let wt of workTypes) {
        try {
            if (ns.singularity.workForFaction(factionName, wt, focus)) {
                ns.print(`🔄 Mulai kerja: ${wt} untuk ${factionName}`);
                return wt;
            }
        } catch {}
    }
    ns.print(`⚠️ Gagal memulai kerja untuk ${factionName}`);
    return null;
}

// ═══════════════════════════════════════════════════════════
// AUTO-DONASI
// ═══════════════════════════════════════════════════════════
function handleDonation(ns, target, player, moneyReserve) {
    if (!target.canDonate || target.repRemaining <= 0) return null;

    let repMult = player.mults?.faction_rep || 1;
    // Formula donasi: repGain = amount × repMult / 1e6
    // Jadi: amount = repNeeded × 1e6 / repMult
    let donationNeeded = Math.ceil(target.repRemaining * 1e6 / repMult);

    // Hitung berapa yang bisa didonasikan
    let reserve = moneyReserve > 0 ? moneyReserve : player.money * 0.10;  // keep 10%
    let canSpend = player.money - reserve;

    if (canSpend < 1e6) return null;  // minimal $1M untuk donasi

    let donateAmount = Math.min(canSpend, donationNeeded);

    try {
        if (ns.singularity.donateToFaction(target.name, donateAmount)) {
            ns.print(`💰 Donasi $${ns.format.number(donateAmount)} ke ${target.name}`);
            return donateAmount;
        }
    } catch (e) {
        ns.print(`⚠️ Donasi gagal: ${e}`);
    }
    return null;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

// Hitung rep rate (rep/detik) dari history
function calcRepRate(history) {
    if (history.length < 2) return 0;
    let first = history[0];
    let last = history[history.length - 1];
    let dt = (last.ts - first.ts) / 1000;
    if (dt <= 0) return 0;
    let dRep = last.rep - first.rep;
    return dRep > 0 ? dRep / dt : 0;
}

// Format angka
function fmtN(ns, val) {
    try { return ns.format.number(val); }
    catch { return val.toFixed(0); }
}

// Format waktu (detik → string)
function fmtTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "∞";
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    return `${h}j ${m}m`;
}

// Progress bar
function makeBar(pct, width = 20) {
    let filled = Math.round(pct / 100 * width);
    return "[" + "█".repeat(filled) + "░".repeat(width - filled) + "]";
}

// Header dashboard
function printHeader(ns, focus, autoDonate, autoJoin, forcedFaction) {
    ns.print("═══════════════════════════════════════════");
    ns.print(" 🏛️  FACTION GRINDER — v1.0                ");
    ns.print("═══════════════════════════════════════════");
    let flags = [];
    if (focus) flags.push("Focus");
    if (autoDonate) flags.push("Donate");
    if (autoJoin) flags.push("AutoJoin");
    if (forcedFaction) flags.push(`Target:${forcedFaction}`);
    if (flags.length > 0) ns.print(`   Flags: ${flags.join(" | ")}`);
}

export function autocomplete(data, args) {
    const flags = [
        "--faction", "--auto-join", "--auto-donate",
        "--no-focus", "--money-reserve"
    ];
    if (args.length > 0 && args[args.length - 1] === "--faction") {
        return [...data.servers];
    }
    return flags;
}

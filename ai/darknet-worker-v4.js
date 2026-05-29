/** @param {NS} ns
 *  DARKNET WORKER v4 — Self-Replicating Worm (Enhanced)
 *  Jalankan: run ai/darknet-worker-v4.js [--tail] [--debug]
 *
 *  Peningkatan dari v3:
 *  - DeepGreen: Strategi minimax (pilih tebakan yang paling menyempitkan kandidat)
 *  - NIL Mastermind: Penanganan feedback lebih robust + fallback per-posisi
 *  - Pr0verFl0: Multi-payload adaptif dengan feedback dari response
 *  - OpenWebAccessPoint: Regex lebih luas + coba data sebagai password langsung
 *  - Heartbleed: Dijalankan AWAL sebagai enrichment (bukan hanya fallback)
 *  - buildCandidates: Urutan lebih cerdas (spesifik dulu, fallback akhir)
 *  - Statistik: Tracking success/fail per model
 *  - Adaptive cooldown: Server mudah → cooldown pendek, sulit → lebih lama
 *  - liberateRam: Exponential backoff agar tidak busy-loop
 *  - Spread: Cek version script, update jika ada yang lebih baru
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME    = "home";
    const PASS_DB = "/darknet-passwords.txt";
    const LITE    = "ai/darknet-worker-lite.js";
    const ME      = ns.getScriptName();
    const myHost  = ns.getHostname();
    const DEBUG   = ns.args.includes("--debug");

    if (ns.args.includes("--tail")) ns.ui.openTail();
    ns.print(`🌑 DARKNET WORKER v4 aktif di: ${myHost}`);

    // ── Load password DB ──────────────────────────────────────────────────────
    let saved = {};
    try {
        if (ns.fileExists(PASS_DB, HOME)) saved = JSON.parse(ns.read(PASS_DB));
    } catch { }

    // ── Statistik per model ───────────────────────────────────────────────────
    const stats = {}; // { modelId: { success: 0, fail: 0 } }
    const recordStat = (model, success) => {
        if (!model) return;
        if (!stats[model]) stats[model] = { success: 0, fail: 0 };
        success ? stats[model].success++ : stats[model].fail++;
    };

    // ── Adaptive cooldown: { hostname: { lastFail, attempts } } ───────────────
    const failTracker = {};
    const getCooldownMs = (host) => {
        let t = failTracker[host];
        if (!t) return 0;
        // Semakin banyak attempt gagal → cooldown makin panjang (max 10 menit)
        let ms = Math.min(60000 * t.attempts, 600000);
        return (Date.now() - t.lastFail < ms) ? (ms - (Date.now() - t.lastFail)) : 0;
    };
    const recordFail = (host) => {
        if (!failTracker[host]) failTracker[host] = { lastFail: 0, attempts: 0 };
        failTracker[host].lastFail = Date.now();
        failTracker[host].attempts++;
    };
    const resetFail = (host) => { delete failTracker[host]; };

    // ── Bebaskan RAM & buka cache ─────────────────────────────────────────────
    await liberateRam(ns, myHost);
    await openAllCaches(ns, myHost);

    let iter = 0;
    while (true) {
        iter++;
        // Hitung ringkasan per iterasi (ditampilkan di akhir scan)
        let iterSeen = 0, iterHacked = 0, iterNewCrack = 0, iterCooldown = 0;

        let neighbors = [];
        try { neighbors = ns.dnet.probe(); } catch { }

        for (const host of neighbors) {
            if (host === myHost) continue;

            let det;
            try { det = ns.dnet.getServerAuthDetails(host); } catch { continue; }
            if (!det.isOnline || !det.isConnectedToCurrentServer) continue;

            iterSeen++;

            // Sudah punya session → langsung spread
            if (det.hasSession) {
                if (!(host in saved)) {
                    saved[host] = "__manual__";
                    ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                    ns.print(`   🖱️ [${host}] Manual crack → disimpan`);
                }
                resetFail(host);
                iterHacked++;
                await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                continue;
            }

            // Password di DB → reconnect
            if (host in saved) {
                if (saved[host] === "__manual__") {
                    if (DEBUG) ns.print(`   🔄 [${host}] Manual session expired, re-crack...`);
                    delete saved[host];
                } else {
                    try {
                        ns.dnet.connectToSession(host, saved[host]);
                        if (DEBUG) ns.print(`   🔑 [${host}] Reconnect OK`);
                        resetFail(host);
                        iterHacked++;
                        await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                    } catch {
                        ns.print(`   ⚠️ [${host}] Session expired, re-crack...`);
                        delete saved[host];
                    }
                    continue;
                }
            }

            // Cooldown adaptif
            let remaining = getCooldownMs(host);
            if (remaining > 0) {
                if (DEBUG) ns.print(`   ⏳ [${host}] Cooldown (${Math.round(remaining / 1000)}s)`);
                iterCooldown++;
                continue;
            }

            // Crack baru
            let model = det.modelId ?? "";
            ns.print(`   🎯 [${host}] Crack... (${model})`);
            let result = await crack(ns, host, det, DEBUG);

            if (result.cracked) {
                recordStat(model, true);
                saved[host] = result.password;
                ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                try { await ns.scp(PASS_DB, HOME, myHost); } catch { }
                resetFail(host);
                await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
            } else {
                // Cek manual crack saat kita mencoba
                let detAfter;
                try { detAfter = ns.dnet.getServerAuthDetails(host); } catch { }
                if (detAfter?.hasSession) {
                    ns.print(`   🖱️ [${host}] Manual crack terdeteksi!`);
                    saved[host] = "__manual__";
                    ns.write(PASS_DB, JSON.stringify(saved, null, 2), "w");
                    resetFail(host);
                    await doSpread(ns, host, ME, LITE, HOME, PASS_DB, saved);
                } else {
                    recordStat(model, false);
                    recordFail(host);
                    let attempts = failTracker[host]?.attempts ?? 1;
                    ns.print(`   ❌ [${host}] Gagal (attempt #${attempts}).`);
                }
            }
        }

        // Phishing pasif
        try {
            let r = await ns.dnet.phishingAttack();
            if (r?.money) ns.print(`   💰 Phishing: +$${ns.format.number(r.money)}`);
        } catch { }

        // Cache baru
        await openAllCaches(ns, myHost);

        // ── Ringkasan iterasi (selalu tampil) ─────────────────────────────────
        const hackedCount = Object.keys(saved).length;
        const statusLine  = iterNewCrack > 0
            ? `🎉 +${iterNewCrack} server baru dicrack!`
            : iterSeen === 0
                ? `😶 Tidak ada tetangga terlihat`
                : iterHacked === iterSeen
                    ? `✅ Semua ${iterSeen} server sudah terhack`
                    : `🔒 ${iterSeen - iterHacked} belum di-hack, ${iterCooldown} cooldown`;

        ns.print(`\n── #${iter} @ ${myHost} │ DB:${hackedCount} server │ ${statusLine}`);

        // Statistik setiap 10 iterasi
        if (iter % 10 === 0 && Object.keys(stats).length > 0) {
            ns.print(`\n📊 Statistik Model:`);
            for (let [m, s] of Object.entries(stats)) {
                ns.print(`   ${m}: ✅${s.success} ❌${s.fail}`);
            }
        }

        await ns.sleep(5000);
    }
}

// ═══ CRACK ═════════════════════════════════════════════════════════════════
async function crack(ns, hostname, det, debug = false) {
    let hintStr = det.passwordHint ?? det.hint ?? "";
    let model   = det.modelId ?? "";
    if (!model) {
        let mM = hintStr.match(/model:\s*([a-z0-9_\-\.]+)/i);
        if (mM) model = mM[1];
    }

    let pwLen = det.passwordLength ?? det.length;
    if (pwLen === undefined) {
        let mLen = hintStr.match(/length:\s*(\d+)/i);
        if (mLen) pwLen = parseInt(mLen[1]);
    }

    let fmt = (det.passwordFormat ?? det.format ?? "").toLowerCase();
    if (!fmt) {
        let mFmt = hintStr.match(/format:\s*([a-z]+)/i);
        if (mFmt) fmt = mFmt[1].toLowerCase();
    }

    if (debug) ns.print(`   🔍 [${hostname}] model=${model} len=${pwLen} fmt=${fmt} hint="${hintStr}"`);

    // ── [ENRICHMENT] Heartbleed lebih awal untuk extract password dari log ────
    // Dijalankan SEBELUM brute force agar data bisa di-inject ke candidates
    let heartbleedCandidates = [];
    try {
        let bleed = await ns.dnet.heartbleed(hostname, { peek: true });
        let logText = (bleed.logs || []).join("\n");
        if (logText) {
            heartbleedCandidates = buildCandidatesFromText(logText, pwLen, fmt);
            if (debug && heartbleedCandidates.length > 0)
                ns.print(`   💉 Heartbleed enrichment: ${heartbleedCandidates.length} kandidat`);
        }
    } catch { }

    // ── Length: 0 Shortcut ──────────────────────────────────────────────────
    // pwLen bisa datang sebagai number 0 atau string "0" dari game API
    if (pwLen === 0 || pwLen === "0" || Number(pwLen) === 0) {
        let r = await ns.dnet.authenticate(hostname, "");
        if (r.success) {
            ns.print(`   ✅ Blank Password [${hostname}]`);
            return { cracked: true, password: "" };
        }
        // Length=0 tapi "" gagal → tidak ada lagi yang bisa dicoba
        ns.print(`   ⚠️ [${hostname}] Length=0 tapi auth "" gagal`);
        return { cracked: false, password: null };
    }

    // ── ZeroLogon ───────────────────────────────────────────────────────────
    if (model.toUpperCase().includes("ZEROLOGON")) {
        // ZeroLogon selalu password kosong — coba "" dulu, lalu beberapa variant
        let bypasses = ["", "0", "null", "empty", "nothing", "undefined", "none"];
        for (let bypass of bypasses) {
            let r = await ns.dnet.authenticate(hostname, bypass);
            if (r.success) {
                ns.print(`   ✅ ZeroLogon [${hostname}] → "${bypass}"`);
                return { cracked: true, password: bypass };
            }
            await ns.sleep(20);
        }
        // ZeroLogon tidak perlu brute force — jika semua bypass gagal, return false
        ns.print(`   ❌ ZeroLogon [${hostname}] semua bypass gagal`);
        return { cracked: false, password: null };
    }


    // ── Factori-Os ──────────────────────────────────────────────────────────
    if (model.startsWith("Factori")) {
        return await crackFactoriOs(ns, hostname, det, pwLen);
    }

    // ── NIL Mastermind ──────────────────────────────────────────────────────
    if (model.toUpperCase().includes("NIL")) {
        return await crackNILMastermind(ns, hostname, pwLen, debug);
    }

    // ── DeepGreen Mastermind (Bulls & Cows) ─────────────────────────────────
    if (model.toUpperCase().includes("DEEPGREEN")) {
        return await crackDeepGreen(ns, hostname, pwLen, debug);
    }

    // ── Pr0verFl0: Buffer Overflow Adaptif ──────────────────────────────────
    if (model === "Pr0verFl0") {
        return await crackPr0verFl0(ns, hostname, pwLen, debug);
    }

    // ── CloudBlare(tm): Extract digit dari CAPTCHA data ──────────────────────
    // Hint: "Type the numbers to prove you are human"
    // Data: "8)(4;/]3" → ambil hanya digit → "843"
    if (model.toLowerCase().includes("cloudblare")) {
        let data = String(det.data ?? det.passwordData ?? "");
        let digits = (data.match(/\d/g) || []).join("");

        // Kandidat yang dicoba: urutan penuh, dan slice ke pwLen
        let cbCandidates = new Set();
        if (digits.length > 0) {
            cbCandidates.add(digits);                               // semua digit: "843"
            if (pwLen > 0 && digits.length !== pwLen) {
                cbCandidates.add(digits.slice(0, pwLen));          // potong ke pwLen
                cbCandidates.add(digits.slice(-pwLen));            // ambil pwLen digit terakhir
            }
        }
        // Fallback: jika data kosong, coba extract dari hint
        for (let n of (hintStr.match(/\d+/g) || [])) cbCandidates.add(n);

        ns.print(`   🤖 CloudBlare [${hostname}]: data="${data}" → digits="${digits}"`);

        for (let pw of cbCandidates) {
            if (pwLen > 0 && String(pw).length !== pwLen) continue; // skip jika length tidak cocok
            let r = await ns.dnet.authenticate(hostname, pw);
            if (r.success) {
                ns.print(`   ✅ CloudBlare [${hostname}] → "${pw}"`);
                return { cracked: true, password: pw };
            }
            // Jika server mengembalikan data CAPTCHA baru, re-extract
            if (r.data && typeof r.data === "string" && r.data !== data) {
                data   = r.data;
                digits = (data.match(/\d/g) || []).join("");
                let newPw = pwLen > 0 ? digits.slice(0, pwLen) : digits;
                if (newPw && newPw !== pw) cbCandidates.add(newPw);
                ns.print(`   🔄 CloudBlare data baru: "${data}" → "${newPw}"`);
            }
            await ns.sleep(30);
        }
        // Jika semua kandidat gagal, return false (jangan lanjut ke universal)
        return { cracked: false, password: null };
    }

    // ── OpenWebAccessPoint: Parser Diperluas ─────────────────────────────────
    if (model === "OpenWebAccessPoint") {
        return await crackOpenWebAP(ns, hostname, pwLen, hintStr, debug);
    }

    // ── Universal: kandidat dari hint + heartbleed + fallback ────────────────
    let candidates = buildCandidates(det, hintStr, model, pwLen);

    // Inject heartbleed candidates ke depan (lebih prioritas)
    if (heartbleedCandidates.length > 0) {
        candidates = [...new Set([...heartbleedCandidates, ...candidates])];
    }

    // Filtering ketat
    if (pwLen !== undefined && pwLen > 0) {
        candidates = candidates.filter(p => String(p).length === pwLen);
    }
    if (fmt === "numeric") {
        candidates = candidates.filter(p => /^\d*$/.test(String(p)));
    }

    for (let pw of candidates) {
        let r = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Cracked [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
        if (debug && r.message) ns.print(`   📋 ${JSON.stringify({ msg: r.message, data: r.data })}`);

        // Auto-Exploit: server membocorkan password expected
        if (r.data && typeof r.data.passwordExpected === "string") {
            let exp = r.data.passwordExpected;
            if (!candidates.includes(exp) && !exp.includes("■") && exp.trim() !== "") {
                ns.print(`   💡 Auto-Exploit: leaked → "${exp}"`);
                candidates.push(exp);
            }
        }

        await ns.sleep(50);
    }

    // ── Targeted Brute Force: numeric pendek ─────────────────────────────────
    if (fmt === "numeric" && pwLen !== undefined && pwLen > 0 && pwLen <= 6) {
        ns.print(`   🔢 Brute forcing numeric len=${pwLen}...`);
        let max = Math.pow(10, pwLen);
        let testedSet = new Set(candidates);
        for (let i = 0; i < max; i++) {
            let pw = String(i).padStart(pwLen, "0");
            if (testedSet.has(pw)) continue;
            let r = await ns.dnet.authenticate(hostname, pw);
            if (r.success) {
                ns.print(`   ✅ BruteForce [${hostname}] → "${pw}"`);
                return { cracked: true, password: pw };
            }
            if (i % 100 === 0) await ns.sleep(1);
        }
    }

    // ── Heartbleed fallback (jika enrichment awal tidak menghasilkan) ─────────
    if (heartbleedCandidates.length > 0) {
        let hbFiltered = heartbleedCandidates;
        if (pwLen !== undefined) hbFiltered = hbFiltered.filter(p => String(p).length === pwLen);
        if (fmt === "numeric")   hbFiltered = hbFiltered.filter(p => /^\d*$/.test(String(p)));

        for (let pw of hbFiltered) {
            if (candidates.includes(pw)) continue; // sudah dicoba
            let r = await ns.dnet.authenticate(hostname, pw);
            if (r.success) {
                ns.print(`   ✅ (heartbleed) Cracked [${hostname}] → "${pw}"`);
                return { cracked: true, password: pw };
            }
            await ns.sleep(50);
        }
    }

    return { cracked: false, password: null };
}

// ═══ Pr0verFl0: Multi-payload Adaptif ══════════════════════════════════════
async function crackPr0verFl0(ns, hostname, pwLen, debug) {
    // Strategy: kirim berbagai pola overflow dan analisis feedback
    let len = pwLen > 0 ? pwLen : 8;

    // Payload strategies dengan berbagai pola
    let payloads = [];

    // 1. Classic double (paling umum)
    const base = "overflow1234567890abcdef".substring(0, len);
    payloads.push(base + base);              // 2x buffer
    payloads.push(base + base + base);       // 3x buffer (jika 2x tidak cukup)
    payloads.push("A".repeat(len * 2));      // Null-like overflow
    payloads.push("0".repeat(len * 2));      // Zero overflow
    payloads.push("X".repeat(len * 3));      // Triple-size

    // 2. Format string style
    payloads.push("%s%s%s%n%n");
    payloads.push("%x%x%x%x");
    payloads.push("\x00".repeat(len));

    // 3. Padding variations
    for (let multiplier of [2, 3, 4]) {
        payloads.push("A".repeat(len * multiplier));
    }

    for (let payload of payloads) {
        let r = await ns.dnet.authenticate(hostname, payload);
        if (r.success) {
            ns.print(`   ✅ Pr0verFl0 [${hostname}] → "${payload.substring(0, 30)}..."`);
            return { cracked: true, password: payload };
        }
        // Ekstrak password yang ter-leak dari feedback
        if (r.data && typeof r.data.passwordExpected === "string") {
            let leaked = r.data.passwordExpected;
            if (!leaked.includes("■") && leaked.trim() !== "") {
                let r2 = await ns.dnet.authenticate(hostname, leaked);
                if (r2.success) {
                    ns.print(`   ✅ Pr0verFl0 (leaked) [${hostname}] → "${leaked}"`);
                    return { cracked: true, password: leaked };
                }
            }
        }
        if (debug && r.message) ns.print(`   📋 Pr0verFl0 "${payload.substring(0, 20)}": ${r.message}`);
        await ns.sleep(30);
    }
    return { cracked: false, password: null };
}

// ═══ OpenWebAccessPoint: Parser Diperluas ══════════════════════════════════
async function crackOpenWebAP(ns, hostname, pwLen, hintStr, debug) {
    // Probe awal dengan berbagai panjang
    let probes = pwLen > 0 ? ["0".repeat(pwLen)] : ["000", "0000", "00000"];

    for (let probePw of probes) {
        let probe = await ns.dnet.authenticate(hostname, probePw);
        if (probe.success) return { cracked: true, password: probePw };

        let raw = typeof probe.data === "string" ? probe.data
                : typeof probe.data === "object" ? JSON.stringify(probe.data) : "";

        let candidates = new Set();

        // Pattern 1: "NamaServer:Password"
        let reg1 = /[a-zA-Z0-9_]+:(\d+)/g;
        let m1;
        while ((m1 = reg1.exec(raw)) !== null) candidates.add(m1[1]);

        // Pattern 2: "password": "xxx" (JSON)
        let reg2 = /"(?:password|pw|pass|secret|key|pin)"\s*:\s*"([^"]+)"/gi;
        let m2;
        while ((m2 = reg2.exec(raw)) !== null) candidates.add(m2[1]);

        // Pattern 3: Semua angka di response
        for (let n of (raw.match(/\d+/g) || [])) candidates.add(n);

        // Pattern 4: Coba data langsung sebagai password
        if (raw.trim()) candidates.add(raw.trim());

        // Pattern 5: Split by common delimiters
        for (let part of raw.split(/[\s,;|:]+/)) {
            if (part.length > 0) candidates.add(part);
        }

        for (let pw of candidates) {
            let pwStr = String(pw);
            if (pwLen > 0 && pwStr.length !== pwLen) continue;
            let r = await ns.dnet.authenticate(hostname, pwStr);
            if (r.success) {
                ns.print(`   ✅ OpenWebAP [${hostname}] → "${pwStr}"`);
                return { cracked: true, password: pwStr };
            }
            await ns.sleep(30);
        }
    }
    return { cracked: false, password: null };
}

// ═══ Factori-Os ════════════════════════════════════════════════════════════
async function crackFactoriOs(ns, hostname, det, pwLen) {
    let hint = det.passwordHint ?? det.hint ?? "";
    let divisor = 0;

    let hintMatch = hint.match(/\b(\d+)\b/);
    if (hintMatch) divisor = parseInt(hintMatch[1]);

    if (!divisor) {
        let probe = await ns.dnet.authenticate(hostname, "1");
        if (probe.success) return { cracked: true, password: "1" };
        let errMatch = (probe.message || "").match(/divisible by ['"']?(\d+)['"']?/i);
        if (errMatch) divisor = parseInt(errMatch[1]);
    }

    if (!divisor || divisor <= 0) return { cracked: false, password: null };
    ns.print(`   ➗ Factori-Os: divisor=${divisor}, len=${pwLen}`);

    if (divisor === 1) {
        let pw = pwLen > 0 ? String(Math.pow(10, pwLen - 1)) : "10";
        let r  = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Factori-Os (div=1) [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
    }

    let start = pwLen > 0 ? Math.pow(10, pwLen - 1) : 1;
    let end   = pwLen > 0 ? Math.pow(10, pwLen) - 1 : 9999;
    let first = Math.ceil(start / divisor) * divisor;

    for (let n = first; n <= end; n += divisor) {
        let pw = String(n);
        let r  = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ Factori-Os [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }
        let errMatch = (r.message || "").match(/divisible by ['"']?(\d+)['"']?/i);
        if (errMatch) {
            let newDiv = parseInt(errMatch[1]);
            if (newDiv !== divisor) {
                divisor = newDiv;
                first = Math.ceil(n / divisor) * divisor;
                n = first - divisor;
                ns.print(`   ➗ Divisor berubah → ${divisor}`);
            }
        }
        await ns.sleep(80);
    }
    return { cracked: false, password: null };
}

// ═══ NIL Mastermind: Adaptive Probe Solver ═════════════════════════════════
// "yes"    = digit ini TEPAT di posisi ini
// "yesn't" = digit ini BUKAN di posisi ini
//
// Strategi ADAPTIF (bukan "repeat same digit"):
//   Setiap probe: KUNCI posisi yang sudah diketahui, uji digit baru di SEMUA
//   posisi yang belum diketahui sekaligus.
//
//   Contoh (pwLen=5):
//     d=4: probe "44444" → pos[1]='4', pos[3]='4' terkonfirmasi
//     d=5: probe "45544" → (pos[1]='4' & pos[3]='4' dikunci, uji '5' di 0,2,4)
//          → pos[2]='5' terkonfirmasi
//     d=6: probe "65564" → ... dan seterusnya
//   Worst case: 10 probe saja, tanpa brute force!
async function crackNILMastermind(ns, hostname, pwLen, debug) {
    if (!pwLen || pwLen <= 0) pwLen = 6;

    // posDigit[i]    = digit terkonfirmasi di posisi i (null = belum tahu)
    // posExcluded[i] = set digit yang PASTI bukan di posisi i
    let posDigit    = new Array(pwLen).fill(null);
    let posExcluded = Array.from({ length: pwLen }, () => new Set());
    let digitsFound = 0;

    ns.print(`   🔎 NIL: Adaptive probe (len=${pwLen})`);

    // ── Phase 1: Probe adaptif digit 0–9 ─────────────────────────────────────
    for (let d = 0; d <= 9; d++) {
        // Kunci posisi yang sudah diketahui, uji digit d di semua yang belum
        let pw = posDigit.map(known => known !== null ? known : String(d)).join("");

        let r = await ns.dnet.authenticate(hostname, pw);
        if (r.success) {
            ns.print(`   ✅ NIL [${hostname}] → "${pw}"`);
            return { cracked: true, password: pw };
        }

        let feedback = parseFeedback(r.data, pwLen);

        for (let i = 0; i < pwLen; i++) {
            if (posDigit[i] !== null) continue; // sudah terkonfirmasi, skip

            let fb = String(feedback[i] ?? "").trim().toLowerCase();
            let isYes = ["yes", "true", "1", "correct", "match", "hit"].includes(fb);

            if (isYes) {
                posDigit[i] = String(d);
                digitsFound++;
                if (debug) ns.print(`   🎯 NIL: Pos[${i}] = '${d}'`);
            } else {
                posExcluded[i].add(String(d)); // catat: digit d bukan di posisi ini
            }
        }

        if (debug) ns.print(`   📋 NIL d=${d} pw="${pw}": ${digitsFound}/${pwLen} terkonfirmasi`);
        if (digitsFound >= pwLen) break; // semua posisi diketahui
        await ns.sleep(40);
    }

    ns.print(`   📊 NIL: ${digitsFound}/${pwLen} posisi terkonfirmasi`);

    // ── Phase 2: Semua posisi terkonfirmasi → coba langsung ──────────────────
    let unknownPos = posDigit.map((d, i) => d === null ? i : -1).filter(i => i >= 0);

    if (unknownPos.length === 0) {
        let finalStr = posDigit.join("");
        let r = await ns.dnet.authenticate(hostname, finalStr);
        if (r.success) {
            ns.print(`   ✅ NIL [${hostname}] → "${finalStr}"`);
            return { cracked: true, password: finalStr };
        }
        // Semua posisi terkonfirmasi tapi masih gagal — kemungkinan session edge case
        // atau feedback parsing salah di beberapa posisi. Lanjut ke Phase 3 full-safe.
        ns.print(`   ⚠️ NIL: password "${finalStr}" gagal padahal semua posisi terkonfirmasi! Fallback Phase 3...`);
        // Reset unknownPos ke semua posisi agar Phase 3 bisa re-verifikasi semua digit
        // menggunakan exclusion set yang sudah dikumpulkan
        unknownPos = Array.from({ length: pwLen }, (_, i) => i);
    }

    // ── Phase 3: Safety net ───────────────────────────────────────────────────
    // Jalankan jika ada posisi unknown ATAU Phase 2 gagal.
    // Gunakan posExcluded untuk mempersempit kandidat tiap posisi.
    {
        let posCandidates = unknownPos.map(i => {
            // Posisi yang sudah terkonfirmasi (posDigit[i] !== null) hanya perlu
            // satu kandidat saja (digit yang sudah diketahui).
            if (posDigit[i] !== null) return [posDigit[i]];
            let cands = [];
            for (let d = 0; d <= 9; d++) {
                if (!posExcluded[i].has(String(d))) cands.push(String(d));
            }
            return cands.length > 0 ? cands : ["0","1","2","3","4","5","6","7","8","9"];
        });

        let totalCombos = posCandidates.reduce((acc, c) => acc * c.length, 1);
        ns.print(`   🔁 NIL Safety net: ${unknownPos.length} pos diuji, ~${totalCombos} kombinasi`);

        const indices = new Array(unknownPos.length).fill(0);
        let attempts = 0;
        while (true) {
            let attempt = [...posDigit];
            for (let j = 0; j < unknownPos.length; j++) {
                attempt[unknownPos[j]] = posCandidates[j][indices[j]];
            }
            let attemptStr = attempt.join("");

            let r = await ns.dnet.authenticate(hostname, attemptStr);
            if (r.success) {
                ns.print(`   ✅ NIL [${hostname}] → "${attemptStr}" (Phase 3, att=${attempts + 1})`);
                return { cracked: true, password: attemptStr };
            }
            attempts++;
            if (attempts % 20 === 0) await ns.sleep(30);

            let carry = 1;
            for (let j = unknownPos.length - 1; j >= 0 && carry; j--) {
                indices[j]++;
                if (indices[j] >= posCandidates[j].length) { indices[j] = 0; carry = 1; }
                else carry = 0;
            }
            if (carry) break;
        }
    }

    ns.print(`   ❌ NIL gagal di ${hostname}`);
    return { cracked: false, password: null };
}

// Helper: parse berbagai format feedback menjadi array string
function parseFeedback(data, length) {
    let feedback = new Array(length).fill("");
    if (Array.isArray(data)) {
        return data.map(f => String(f ?? "").trim());
    }
    if (typeof data === "string") {
        // Coba parse sebagai JSON array
        try {
            let parsed = JSON.parse(data);
            if (Array.isArray(parsed)) return parsed.map(f => String(f ?? "").trim());
        } catch { }
        // CSV
        return data.split(",").map(f => f.trim());
    }
    return feedback;
}

// ═══ DeepGreen: Minimax Bulls & Cows ═══════════════════════════════════════
// Strategi: pilih tebakan yang meminimalkan worst-case sisa kandidat
async function crackDeepGreen(ns, hostname, pwLen, debug) {
    if (pwLen <= 0) pwLen = 3;

    let max = Math.pow(10, pwLen);
    let candidates = [];
    for (let i = 0; i < max; i++) {
        candidates.push(String(i).padStart(pwLen, "0"));
    }

    ns.print(`   🧠 DeepGreen solver: ${candidates.length} kandidat awal`);

    const getBullsAndCows = (secret, guess) => {
        let b = 0, c = 0;
        let sArr = secret.split("");
        let gArr = guess.split("");
        for (let i = 0; i < secret.length; i++) {
            if (sArr[i] === gArr[i]) { b++; sArr[i] = null; gArr[i] = null; }
        }
        for (let i = 0; i < secret.length; i++) {
            if (gArr[i] !== null) {
                let idx = sArr.indexOf(gArr[i]);
                if (idx !== -1) { c++; sArr[idx] = null; }
            }
        }
        return [b, c];
    };

    // Pilih tebakan terbaik: minimalkan worst-case partition size
    // Gunakan minimax hanya jika kandidat tidak terlalu besar (hemat RAM)
    const pickBestGuess = (cands) => {
        if (cands.length <= 2) return cands[0];
        // Jika kandidat <= 1000, jalankan minimax
        if (cands.length > 1000) return cands[0]; // fallback: first candidate

        let bestGuess = cands[0];
        let bestWorstCase = Infinity;

        // Batasi evaluasi ke max 200 kandidat untuk efisiensi
        let evalPool = cands.length <= 200 ? cands : cands.slice(0, 200);

        for (let guess of evalPool) {
            let partitions = {};
            for (let secret of cands) {
                let [b, c] = getBullsAndCows(secret, guess);
                let key = `${b},${c}`;
                partitions[key] = (partitions[key] || 0) + 1;
            }
            let worstCase = Math.max(...Object.values(partitions));
            if (worstCase < bestWorstCase) {
                bestWorstCase = worstCase;
                bestGuess = guess;
            }
        }
        return bestGuess;
    };

    let attemptCount = 0;
    while (candidates.length > 0) {
        attemptCount++;
        let guess = pickBestGuess(candidates);

        if (debug) ns.print(`   🧠 DeepGreen tebak "${guess}" (${candidates.length} sisa)`);

        let r = await ns.dnet.authenticate(hostname, guess);
        if (r.success) {
            ns.print(`   ✅ DeepGreen [${hostname}] → "${guess}" (${attemptCount} percobaan)`);
            return { cracked: true, password: guess };
        }

        let bulls = 0, cows = 0;
        if (Array.isArray(r.data) && r.data.length >= 2) {
            bulls = parseInt(r.data[0]); cows = parseInt(r.data[1]);
        } else if (typeof r.data === "string") {
            let parts = r.data.split(",");
            if (parts.length >= 2) { bulls = parseInt(parts[0]); cows = parseInt(parts[1]); }
        } else if (r.data && typeof r.data === "object") {
            // Coba format { exact, wrong } atau { bulls, cows }
            bulls = parseInt(r.data.bulls ?? r.data.exact ?? r.data.b ?? 0);
            cows  = parseInt(r.data.cows  ?? r.data.wrong ?? r.data.c ?? 0);
        }

        ns.print(`   🎯 DeepGreen "${guess}" → Bulls:${bulls} Cows:${cows} | Sisa: ${candidates.length}`);

        candidates = candidates.filter(cand => {
            let [simB, simC] = getBullsAndCows(cand, guess);
            return simB === bulls && simC === cows;
        });

        await ns.sleep(40);
    }

    ns.print(`   ❌ DeepGreen gagal di ${hostname}`);
    return { cracked: false, password: null };
}

// ═══ SPREAD ════════════════════════════════════════════════════════════════
async function doSpread(ns, hostname, fullScript, liteScript, home, passDb, saved) {
    try {
        await liberateRam(ns, hostname);
        await openAllCaches(ns, hostname);

        if (ns.isRunning(fullScript, hostname) || ns.isRunning(liteScript, hostname)) return;

        let fullRam = ns.getScriptRam(fullScript);
        let liteRam = ns.getScriptRam(liteScript);
        let freeRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);

        if (ns.fileExists(passDb, home)) await ns.scp(passDb, hostname, home);

        if (freeRam >= fullRam) {
            await ns.scp(fullScript, hostname, home);
            await ns.scp(liteScript, hostname, home);
            let pid = ns.exec(fullScript, hostname, { preventDuplicates: true });
            if (pid > 0) ns.print(`   🚀 [${hostname}] FULL PID:${pid} (${freeRam.toFixed(0)}GB free)`);
        } else if (freeRam >= liteRam) {
            await ns.scp(liteScript, hostname, home);
            let pid = ns.exec(liteScript, hostname, { preventDuplicates: true });
            if (pid > 0) ns.print(`   🚀 [${hostname}] LITE PID:${pid} (${freeRam.toFixed(0)}GB free)`);
        }
    } catch (e) {
        ns.print(`   ⚠️ Spread gagal ke ${hostname}: ${e}`);
    }
}

// ═══ LIBERATE RAM (Exponential Backoff) ════════════════════════════════════
async function liberateRam(ns, hostname) {
    try {
        let delay = 100;
        for (let i = 0; i < 12; i++) {
            let r = ns.dnet.influence?.memoryReallocation
                ? ns.dnet.influence.memoryReallocation(hostname) : null;
            if (!r || r.done) break;
            await ns.sleep(delay);
            delay = Math.min(delay * 1.5, 2000); // exponential backoff, max 2s
        }
    } catch { }
}

// ═══ OPEN CACHES ═══════════════════════════════════════════════════════════
async function openAllCaches(ns, hostname) {
    try {
        for (let f of ns.ls(hostname, ".cache")) {
            try {
                let r = ns.dnet.openCache(f);
                ns.print(`   💾 Cache: ${f} → ${JSON.stringify(r)}`);
            } catch { }
        }
    } catch { }
}

// ═══ CANDIDATE BUILDERS ════════════════════════════════════════════════════
function buildCandidates(det, hintStr, model, pwLen) {
    let set = new Set();
    const add        = (v) => { if (v !== undefined && v !== null) set.add(String(v)); };
    const addNonEmpty = (v) => { if (v !== undefined && v !== null && String(v).length > 0) set.add(String(v)); };

    let data = det.data ?? det.passwordData ?? "";

    // ── 1. Spesifik: dari data/hint langsung ─────────────────────────────────
    if (data) addNonEmpty(data);

    // Pola "is X", "pin X", "key X", dll
    let mIs = hintStr.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/i);
    if (mIs) add(mIs[1]);

    // Pola "between X and Y"
    let btw = hintStr.match(/between\s+(\d+)\s+and\s+(\d+)/i);
    if (btw) {
        let s = parseInt(btw[1]), e = parseInt(btw[2]);
        for (let i = s; i <= e; i++) add(i);
    }

    // ── 2. Transformasi data ──────────────────────────────────────────────────
    // Angka dari hint
    for (let n of (hintStr.match(/\d+/g) || [])) add(n);

    // Digit dari data (CloudBlare)
    if (data) {
        let digits = data.match(/\d/g) || [];
        if (digits.length > 0) {
            add(digits.join(""));
            if (pwLen > 0) add(digits.slice(0, pwLen).join(""));
        }
    }

    // Base Conversion (OctantVoxel dll)
    if (data && typeof data === "string") {
        let mData = data.trim().match(/^(\d+),([0-9a-zA-Z]+)$/);
        if (mData) {
            let val = parseInt(mData[2], parseInt(mData[1]));
            if (!isNaN(val)) add(val);
        }
    }

    // Roman Numerals (BellaCuore dll)
    if (data && typeof data === "string" && /^[IVXLCDM]+$/i.test(data.trim())) {
        add(romanToInt(data.trim()));
    }

    // Permutasi untuk PHP models
    if (model.startsWith("PHP")) {
        let nm = hintStr.match(/\d+/);
        if (nm) {
            for (let p of [...new Set(permute(nm[0].split("")).map(x => x.join("")))]) addNonEmpty(p);
        }
    }

    // Token kata dari hint
    for (let w of (hintStr.match(/\b[a-zA-Z0-9_\-]{1,20}\b/g) || [])) addNonEmpty(w);

    // ── 3. Model-spesifik ─────────────────────────────────────────────────────
    if (model === "Laika4")    ["fido", "spot", "rover", "max", "dog", "dogs", "laika"].forEach(addNonEmpty);
    if (model === "NIL")       ["nil", "null", "none", "nothing", "undefined"].forEach(addNonEmpty);
    if (model.toLowerCase().includes("cloudblare")) {
        // CloudBlare seharusnya ditangani dedicated solver, ini hanya fallback
        // Extract digits dari data sebagai kandidat utama
        let cbDigits = (String(data).match(/\d/g) || []).join("");
        if (cbDigits) addNonEmpty(cbDigits);
    }

    // ── 4. Universal fallback (di akhir, setelah yang spesifik) ──────────────
    ["password", "admin", "root", "default", "1234", "12345", "0000"].forEach(addNonEmpty);
    ["", "0", "null", "empty"].forEach(add);

    return [...set];
}

function buildCandidatesFromText(text, pwLen, fmt) {
    let set = new Set();
    let m = text.match(/(?:is|pin|secret|password|code|key)\s+([^\s,\.]{1,20})/gi);
    if (m) for (let x of m) set.add(x.split(/\s+/).pop());
    for (let n of (text.match(/\d+/g) || [])) set.add(n);
    let digits = text.match(/\d/g) || [];
    if (digits.length > 0) {
        set.add(digits.join(""));
        if (pwLen > 0) set.add(digits.slice(0, pwLen).join(""));
    }
    return [...set];
}

function romanToInt(s) {
    const roman = { 'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000 };
    let res = 0;
    for (let i = 0; i < s.length; i++) {
        let curr = roman[s[i].toUpperCase()];
        let next = roman[s[i + 1]?.toUpperCase()];
        if (next && curr < next) res -= curr;
        else res += curr;
    }
    return res;
}

function permute(arr) {
    if (arr.length <= 1) return [arr];
    let r = [];
    for (let i = 0; i < arr.length; i++) {
        let rest = arr.slice(0, i).concat(arr.slice(i + 1));
        for (let p of permute(rest)) r.push([arr[i], ...p]);
    }
    return r;
}

export function autocomplete(data) { return ["--tail", "--debug"]; }

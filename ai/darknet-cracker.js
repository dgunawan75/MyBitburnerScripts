/** @param {NS} ns
 *  DARKNET CRACKER v1.0
 *  Jalankan dari home: run ai/darknet-cracker.js
 *  Akan deploy dirinya ke darkweb, lalu crack semua server tetangga.
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const HOME = "home";
    const PASS_DB = "/darknet-passwords.txt";

    // ============================================================
    // MODE 1: Jika di HOME → deploy ke darkweb dan tunggu laporan
    // ============================================================
    if (ns.getHostname() === HOME) {
        ns.ui.openTail();
        ns.print("🌑 DARKNET CRACKER — Mengirim ke darkweb...");

        let scriptName = "ai/darknet-craker.js";
        let files = ["ai/darknet-craker.js", "ai/darknet-probe.js"];
        for (let f of files) {
            await ns.scp(f, "darkweb", HOME);
        }

        // Cek RAM sebelum exec
        let scriptRam = ns.getScriptRam(scriptName);
        let freeRam = ns.getServerMaxRam("darkweb") - ns.getServerUsedRam("darkweb");
        ns.print(`   📊 RAM Cracker: ${scriptRam.toFixed(1)}GB | RAM Bebas darkweb: ${freeRam.toFixed(1)}GB`);

        if (freeRam < scriptRam) {
            ns.print(`   ❌ RAM darkweb tidak cukup (butuh ${scriptRam.toFixed(1)}GB, ada ${freeRam.toFixed(1)}GB)`);
            ns.print(`   💡 Jalankan manual dari terminal:`);
            ns.print(`      > connect darkweb`);
            ns.print(`      > run ai/darknet-cracker.js`);
            return;
        }

        let pid = ns.exec(scriptName, "darkweb");
        if (pid === 0) {
            ns.print("❌ Gagal exec ke darkweb. Jalankan manual:");
            ns.print("   > connect darkweb");
            ns.print("   > run ai/darknet-cracker.js");
        } else {
            ns.print("✅ Cracker berhasil diluncurkan di darkweb!");
        }
        return;
    }

    // ============================================================
    // MODE 2: Berjalan DI DALAM server darknet → crack tetangga
    // ============================================================
    let myHost = ns.getHostname();
    ns.print(`🏴‍☠️ CRACKER aktif di: ${myHost}`);
    ns.print("🔍 Mencari target...\n");

    let neighbors = ns.dnet.probe();
    let savedPasswords = {};

    // Load password DB yang sudah ada jika ada
    if (ns.fileExists(PASS_DB, HOME)) {
        try { savedPasswords = JSON.parse(ns.read(PASS_DB)); } catch { }
    }

    for (let target of neighbors) {
        ns.print(`\n🎯 TARGET: ${target}`);

        let details = ns.dnet.getServerAuthDetails(target);
        if (!details.isOnline) {
            ns.print("   ⚫ Server offline, lewati.");
            continue;
        }
        if (!details.isConnectedToCurrentServer) {
            ns.print("   ⚡ Tidak terhubung langsung, lewati.");
            continue;
        }

        // Jika password sudah diketahui sebelumnya
        // Note: gunakan 'in' bukan truthy check, karena password kosong "" adalah valid!
        if (target in savedPasswords) {
            ns.print(`   🔑 Password sudah ada: "${savedPasswords[target]}"`);
            ns.dnet.connectToSession(target, savedPasswords[target]);
            await spreadCracker(ns, target, HOME);
            continue;
        }

        ns.print(`   Model: ${details.modelId} | Hint: "${details.passwordHint}"`);

        let cracked = false;

        // ==============================
        // STRATEGI: ZeroLogon
        // Exploit: kerentanan null-auth → password kosong!
        // ==============================
        if (details.modelId === "ZeroLogon") {
            const ATTEMPTS = ["", "password", "0", "0000", "12345", "null", "admin", "1234", "default"];
            for (let pw of ATTEMPTS) {
                ns.print(`   🔨 Mencoba password: "${pw}"`);
                let result = await ns.dnet.authenticate(target, pw);
                if (result.success) {
                    ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                    savedPasswords[target] = pw;
                    cracked = true;
                    break;
                }

                // Gunakan heartbleed untuk petunjuk tambahan
                try {
                    let bleed = await ns.dnet.heartbleed(target, { peek: true });
                    if (bleed.logs && bleed.logs.length > 0) {
                        ns.print(`   📋 Log: ${bleed.logs.slice(-2).join(" | ")}`);
                    }
                } catch { }

                await ns.sleep(200);
            }
        }

        // ==============================
        // STRATEGI: DeskMemo
        // Hint langsung menyebutkan angka/kata rahasianya!
        // Contoh: "The secret is 38" → coba "38"
        // ==============================
        else if (details.modelId.startsWith("DeskMemo")) {
            ns.print("   📝 DeskMemo — Membaca hint untuk password...");
            let hint = details.passwordHint || "";

            // Kumpulkan semua kandidat: angka dalam hint, kata-kata kunci, lalu hint penuh
            let numMatches = hint.match(/\d+/g) || [];
            let wordMatches = hint.match(/\b[a-zA-Z0-9_-]{2,}\b/g) || [];
            let attempts = [...new Set([...numMatches, ...wordMatches, hint.trim()])];
            attempts.push("", "password", "admin");

            for (let pw of attempts) {
                ns.print(`   🔨 Mencoba: "${pw}"`);
                let result = await ns.dnet.authenticate(target, pw);
                if (result.success) {
                    ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                    savedPasswords[target] = pw;
                    cracked = true;
                    break;
                }
                await ns.sleep(200);
            }

            if (!cracked) {
                // Coba heartbleed untuk petunjuk tambahan
                try {
                    let bleed = await ns.dnet.heartbleed(target, { peek: true });
                    ns.print(`   📋 Log DeskMemo: ${JSON.stringify(bleed.logs)}`);
                } catch { }
            }
        }

        // ==============================
        // STRATEGI: CloudBlare (CAPTCHA angka)
        // ==============================
        // STRATEGI: CloudBlare (CAPTCHA angka)
        // CARA: Ekstrak digit dari field 'data' di authDetails
        //       → ambil sejumlah 'length' digit → itu passwordnya!
        // Contoh: Data="6:╸\5>/1~╬*9", Length=4 → digits=[6,5,1,9] → "6519"
        // ==============================
        else if (details.modelId.startsWith("CloudBlare")) {
            ns.print("   🤖 CloudBlare — Menganalisa Data field...");
            ns.print(`   📋 Detail: ${JSON.stringify(details)}`);

            let password = null;

            // METODE 1: Cek field 'data' dan 'passwordLength' / 'length' di details
            let dataStr = details.data || details.passwordData || "";
            let pwLen   = details.passwordLength || details.length || 0;

            if (dataStr) {
                let digits = dataStr.match(/\d/g) || [];
                ns.print(`   🔢 Digit dari Data: ${digits.join("")} (ambil ${pwLen || "semua"})`);
                if (pwLen > 0) {
                    password = digits.slice(0, pwLen).join("");
                } else {
                    password = digits.join("");
                }
            }

            // METODE 2: Gunakan heartbleed untuk cari "Data:" dan "Length:" di log
            if (!password) {
                try {
                    await ns.dnet.authenticate(target, "0"); // trigger log
                    let bleed = await ns.dnet.heartbleed(target, { peek: true });
                    let logText = (bleed.logs || []).join("\n");
                    ns.print(`   📋 Log: ${logText.slice(0, 200)}`);

                    // Cari pola "Data: <string>" dan "Length: <n>"
                    let dataMatch  = logText.match(/Data:\s*(.+)/i);
                    let lenMatch   = logText.match(/Length:\s*(\d+)/i);
                    if (dataMatch) {
                        let rawData = dataMatch[1].trim();
                        let digits  = rawData.match(/\d/g) || [];
                        let len     = lenMatch ? parseInt(lenMatch[1]) : digits.length;
                        password    = digits.slice(0, len).join("");
                        ns.print(`   🔢 Dari log — Data: "${rawData}" → password: "${password}"`);
                    }
                } catch (e) {
                    ns.print(`   ⚠️ Heartbleed error: ${e}`);
                }
            }

            // Coba password yang ditemukan
            if (password && password.length > 0) {
                let result = await ns.dnet.authenticate(target, password);
                if (result.success) {
                    ns.print(`   ✅ CAPTCHA BERHASIL! Password = "${password}"`);
                    savedPasswords[target] = password;
                    cracked = true;
                } else {
                    ns.print(`   ❌ Password "${password}" gagal. Coba variasi...`);
                    // Coba semua sub-kombinasi digit yang ditemukan
                    let allDigits = (dataStr || "").match(/\d/g) || [];
                    for (let len = 1; len <= Math.min(allDigits.length, 8); len++) {
                        let pw = allDigits.slice(0, len).join("");
                        let r  = await ns.dnet.authenticate(target, pw);
                        if (r.success) {
                            ns.print(`   ✅ Variasi berhasil! Password = "${pw}"`);
                            savedPasswords[target] = pw;
                            cracked = true;
                            break;
                        }
                        await ns.sleep(200);
                    }
                }
            } else {
                ns.print("   ⚠️ Tidak bisa ekstrak digit dari Data field. Perlu investigasi manual.");
            }
        }

        // ==============================
        // STRATEGI: PHP 5.4
        // Hint: "The password is shuffled X" → coba semua permutasi digit dari X
        // ==============================
        else if (details.modelId.startsWith("PHP")) {
            ns.print("   🐘 PHP model — Mencoba permutasi angka dari hint...");
            let hint = details.passwordHint || "";
            let numMatch = hint.match(/\d+/);
            let candidates = [];

            if (numMatch) {
                let digits = numMatch[0].split("");
                // Generate semua permutasi unik dari digit-digit tersebut
                candidates = [...new Set(permute(digits).map(p => p.join("")))];
                ns.print(`   🔢 Kandidat permutasi: ${candidates.slice(0, 10).join(", ")}`);
            }
            candidates.push("", "password", "admin");

            for (let pw of candidates) {
                let result = await ns.dnet.authenticate(target, pw);
                if (result.success) {
                    ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                    savedPasswords[target] = pw;
                    cracked = true;
                    break;
                }
                await ns.sleep(100);
            }
        }

        // ==============================
        // STRATEGI: NIL
        // Model "NIL" = null/kosong/nothing
        // ==============================
        else if (details.modelId === "NIL") {
            ns.print("   🈳 NIL model — Mencoba nil/null/empty...");
        const ATTEMPTS = ["", "nil", "null", "none", "nothing", "undefined", "password", "admin", "0000", "12345"];
            for (let pw of ATTEMPTS) {
                ns.print(`   🔨 Mencoba: "${pw}"`);
                let result = await ns.dnet.authenticate(target, pw);
                if (result.success) {
                    ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                    savedPasswords[target] = pw;
                    cracked = true;
                    break;
                }
                await ns.sleep(200);
            }
        }

        // ==============================
        // Tidak dikenal — coba umum
        // ==============================
        else {
            ns.print(`   ❓ Model tidak dikenal: ${details.modelId}, coba password umum...`);
            const COMMON = ["", "password", "admin", "1234", "0000", "12345", "root", "letmein", "default"];
            for (let pw of COMMON) {
                let result = await ns.dnet.authenticate(target, pw);
                if (result.success) {
                    ns.print(`   ✅ BERHASIL! Password = "${pw}"`);
                    savedPasswords[target] = pw;
                    cracked = true;
                    break;
                }
                await ns.sleep(200);
            }
        }

        // Jika berhasil crack → sebar probe ke lebih dalam
        if (cracked) {
            // Simpan password ke database
            ns.write(PASS_DB, JSON.stringify(savedPasswords, null, 2), "w");
            await ns.scp(PASS_DB, HOME, myHost);

            // Loot RAM yang terblokir
            try {
                ns.print(`   🧹 Membebaskan RAM yang terkunci...`);
                let iter = 0;
                while (iter++ < 10) {
                    let result = ns.dnet.influence?.memoryReallocation
                        ? ns.dnet.influence.memoryReallocation(target)
                        : null;
                    if (!result || result.done) break;
                    await ns.sleep(500);
                }
            } catch { }

            // Cek cache files
            try {
                let files = ns.ls(target, ".cache");
                if (files.length > 0) {
                    ns.print(`   💾 Cache ditemukan: ${files.join(", ")}`);
                    for (let f of files) {
                        ns.dnet.openCache(f);
                        ns.print(`   📦 Membuka cache: ${f}`);
                    }
                }
            } catch { }

            // Spread probe ke server yang baru di-crack
            await spreadCracker(ns, target, HOME);
        } else {
            ns.print(`   ❌ Gagal crack ${target}. Perlu analisis lebih lanjut.`);
        }
    }

    // Simpan final password DB
    ns.write(PASS_DB, JSON.stringify(savedPasswords, null, 2), "w");
    await ns.scp(PASS_DB, HOME, myHost);
    ns.print(`\n✅ Selesai! Password database disimpan di ${PASS_DB}`);
}

// Menyebarkan CRACKER + PROBE ke server yang baru berhasil di-crack
// Sehingga eksplorasi berjalan rekursif / self-propagating
async function spreadCracker(ns, target, home) {
    try {
        const CRACKER = "ai/darknet-craker.js";
        const PROBE   = "ai/darknet-probe.js";

        let crackerRam = ns.getScriptRam(CRACKER);
        let freeRam    = ns.getServerMaxRam(target) - ns.getServerUsedRam(target);

        // Selalu copy probe (ringan)
        await ns.scp(PROBE, target, home);

        if (freeRam >= crackerRam) {
            // Copy cracker juga, lalu jalankan otomatis dari sana
            await ns.scp(CRACKER, target, home);
            let pid = ns.exec(CRACKER, target);
            if (pid > 0) {
                ns.print(`   🚀 Cracker self-propagated ke ${target} (PID ${pid})!`);
            } else {
                // Exec gagal (butuh sesi?), jalankan probe saja
                ns.exec(PROBE, target);
                ns.print(`   📡 Probe disebarkan ke ${target} (cracker exec gagal).`);
            }
        } else {
            // RAM tidak cukup untuk cracker, cukup probe saja
            ns.exec(PROBE, target);
            ns.print(`   📡 Probe saja di ${target} (RAM kurang untuk cracker: ${freeRam.toFixed(0)}/${crackerRam.toFixed(0)}GB).`);
        }

        // Baca .lit dan .cache files yang ada di server baru
        try {
            let files = ns.ls(target);
            let lits   = files.filter(f => f.endsWith(".lit"));
            let caches = files.filter(f => f.endsWith(".cache"));
            if (lits.length > 0) {
                ns.print(`   📖 .lit files: ${lits.join(", ")}`);
                // Copy .lit files ke home untuk dibaca nanti
                for (let lit of lits) {
                    await ns.scp(lit, home, target);
                    // Ekstrak password kandidat dari isi .lit
                    let content = ns.read(lit);
                    let hints = parseLitForPasswords(content);
                    if (hints.length > 0) {
                        ns.print(`   🔑 Kata kunci dari ${lit}: ${hints.join(", ")}`);
                    }
                }
            }
            if (caches.length > 0) ns.print(`   💾 .cache files: ${caches.join(", ")}`);
        } catch { }

    } catch (e) {
        ns.print(`   ⚠️ Gagal spread ke ${target}: ${e}`);
    }
}

// Menghasilkan semua permutasi array (untuk PHP 5.4 strategy)
function permute(arr) {
    if (arr.length <= 1) return [arr];
    let result = [];
    for (let i = 0; i < arr.length; i++) {
        let rest = arr.slice(0, i).concat(arr.slice(i + 1));
        for (let perm of permute(rest)) {
            result.push([arr[i], ...perm]);
        }
    }
    return result;
}

// Mengekstrak kandidat password dari isi file .lit
// Contoh: "admin, password, 0000, 12345" → ["admin", "password", "0000", "12345"]
function parseLitForPasswords(content) {
    let candidates = new Set();

    // Ekstrak string dalam tanda kutip: "admin" atau 'secret'
    let quoted = content.match(/["']([^"']{1,30})["']/g) || [];
    for (let q of quoted) candidates.add(q.slice(1, -1));

    // Ekstrak kata setelah kata kunci: "password is X", "PIN is X", "secret is X", "code is X"
    let keywordMatches = content.match(/(?:password|pin|secret|code|key)\s+(?:is\s+)?([^\s,\.]{1,20})/gi) || [];
    for (let m of keywordMatches) {
        let val = m.split(/\s+/).pop();
        candidates.add(val);
    }

    // Ekstrak semua angka 2-8 digit
    let nums = content.match(/\b\d{2,8}\b/g) || [];
    for (let n of nums) candidates.add(n);

    // Ekstrak kata-kata biasa yang terpisah koma (daftar password)
    let commaWords = content.match(/\b[a-zA-Z0-9_]{3,15}\b/g) || [];
    for (let w of commaWords) candidates.add(w);

    return [...candidates].filter(c => c.length > 0).slice(0, 30);
}

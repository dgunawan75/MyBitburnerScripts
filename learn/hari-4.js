/** @param {NS} ns **/
// ================================================================
// HARI 4: Fungsi — Deklarasi, Parameter, Return, Arrow Function
// Jalankan di Bitburner: run learn/hari-4.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 4: Fungsi ===\n");

    // ---------------------------------------------------------
    // MATERI 4.1: Fungsi Dasar (deklarasi + return)
    // ---------------------------------------------------------
    function hitungProfit(beliPerLembar, jualPerLembar, jumlahLembar, komisi) {
        let revenue = jualPerLembar * jumlahLembar - komisi;
        let cost = beliPerLembar * jumlahLembar + komisi;
        let profit = revenue - cost;
        let persen = (profit / cost) * 100;
        return { profit, persen };   // return object!
    }

    let hasil = hitungProfit(1000, 1150, 500, 100000);
    ns.print(`[4.1] Profit: $${hasil.profit.toLocaleString()} (${hasil.persen.toFixed(2)}%)`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 4.2: Arrow Function (bentuk ringkas)
    // ---------------------------------------------------------
    // Bentuk panjang:
    // function double(x) { return x * 2; }

    // Bentuk arrow singkat:
    let double = x => x * 2;
    let formatUang = n => `$${n.toLocaleString()}`;
    let isRooted = server => server.rooted === true;

    ns.print(`[4.2] double(64) = ${double(64)}`);
    ns.print(`[4.2] formatUang(1500000) = ${formatUang(1500000)}`);
    ns.print(`[4.2] isRooted({rooted: true}) = ${isRooted({ rooted: true })}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 4.3: Fungsi dengan banyak parameter (dari xp-farm.js)
    // ---------------------------------------------------------
    function alokasikanRAM(serverList, ramPerThread) {
        let total = 0;
        for (let s of serverList) {
            let free = s.maxRam - s.usedRam;
            if (s.nama === "home") free -= 128;   // Cadangkan 128GB untuk home
            if (free < ramPerThread) continue;
            let thread = Math.floor(free / ramPerThread);
            total += thread;
        }
        return total;
    }

    let servers = [
        { nama: "home", maxRam: 512, usedRam: 200 },
        { nama: "pserv-0", maxRam: 256, usedRam: 60 },
        { nama: "pserv-1", maxRam: 256, usedRam: 10 },
        { nama: "n00dles", maxRam: 4, usedRam: 0 },
    ];

    let totalThreads = alokasikanRAM(servers, 1.75); // 1.75GB per thread (hack.js)
    ns.print(`[4.3] Total thread yang bisa ditembak: ${totalThreads}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 4.4: Scope — Variabel lokal vs luar
    // ---------------------------------------------------------
    let jumlah = 10;   // Variabel di luar fungsi

    function tambahDua() {
        let jumlah = 99;   // Variabel LOKAL — tidak mempengaruhi yang di luar!
        return jumlah + 2;
    }

    ns.print(`[4.4] jumlah di luar fungsi: ${jumlah}`);
    ns.print(`[4.4] hasil tambahDua(): ${tambahDua()}`);
    ns.print(`[4.4] jumlah setelah panggil fungsi: ${jumlah} ← tidak berubah!`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 4.5: Fungsi memanggil fungsi lain
    // ---------------------------------------------------------
    function getRamGrade(ram) {
        if (ram >= 1024 * 1024) return "S (PB)";
        if (ram >= 1024) return "A (TB)";
        if (ram >= 256) return "B (>256GB)";
        return "C (<256GB)";
    }

    function laporServer(s) {
        let grade = getRamGrade(s.maxRam);   // memanggil fungsi lain
        return `${s.nama.padEnd(10)} | ${String(s.maxRam).padStart(5)}GB | Grade: ${grade}`;
    }

    ns.print("[4.5] Daftar Server:");
    for (let s of servers) ns.print(`  ${laporServer(s)}`);
    ns.print("");

    ns.print("=== ✅ Selesai Hari 4! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Buat fungsi isAffordable(harga, uang) → return true/false");
    ns.print("  2. Ubah hitungProfit menjadi arrow function");
    ns.print("  3. Buat fungsi getRamTermurah(anggaran) → return RAM terbesar yang terjangkau");
}

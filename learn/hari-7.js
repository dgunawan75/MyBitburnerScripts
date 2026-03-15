/** @param {NS} ns **/
// ================================================================
// HARI 7: PROYEK AKHIR — Mini Investment Tracker
// Gabungan: Variabel, if/else, Loop, Fungsi, Array, Async
//
// Deskripsi:
//   Script ini mensimulasikan portofolio investasi saham sederhana.
//   Tanpa ns.stock.* — murni JavaScript biasa yang bisa dipahami
//   dan dijalankan di luar game pun (dengan sedikit adaptasi).
//
// Jalankan: run learn/hari-7.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();

    // ================================================================
    // DATA AWAL
    // ================================================================
    const MODAL_AWAL = 100_000_000;  // $100 Juta
    const KOMISI = 100_000;       // $100K per transaksi

    // Portofolio: daftar saham yang kita pegang
    // Konsep: Array of Objects (Hari 5)
    let portofolio = [
        { sym: "APHE", lembar: 500, beliHarga: 1200 },
        { sym: "ECP", lembar: 100, beliHarga: 8500 },
        { sym: "BLD", lembar: 1000, beliHarga: 450 },
    ];

    // Pasar: harga saham saat ini (berubah tiap "tick")
    let pasar = {
        APHE: 1200,
        ECP: 8500,
        BLD: 450,
        NVMD: 320,
        WDS: 2100,
    };

    // ================================================================
    // FUNGSI-FUNGSI (Hari 4)
    // ================================================================

    // Hitung nilai satu posisi
    function nilaiPosisi(posisi) {
        let hargaSekarang = pasar[posisi.sym];
        return hargaSekarang ? posisi.lembar * hargaSekarang : 0;
    }

    // Hitung profit satu posisi
    function profitPosisi(posisi) {
        let hargaSekarang = pasar[posisi.sym] || 0;
        let revenue = posisi.lembar * hargaSekarang - KOMISI;
        let cost = posisi.lembar * posisi.beliHarga + KOMISI;
        return {
            nominal: revenue - cost,
            persen: ((revenue - cost) / cost) * 100,
        };
    }

    // Simulasi pergerakan harga acak (naik/turun ±5%)
    function simulasiPasar() {
        for (let sym in pasar) {
            let perubahan = (Math.random() - 0.5) * 0.10;  // ±5%
            pasar[sym] = Math.max(1, Math.round(pasar[sym] * (1 + perubahan)));
        }
    }

    // Tampilkan laporan portofolio (Hari 2, 3, 5)
    function tampilkanLaporan(tick, kasBank) {
        ns.clearLog();
        ns.print(`${"=".repeat(52)}`);
        ns.print(` 📊 INVESTMENT TRACKER — TICK ${tick}`);
        ns.print(`${"=".repeat(52)}`);
        ns.print(`💵 Kas    : $${kasBank.toLocaleString()}`);

        // Hitung total nilai saham menggunakan reduce (Hari 5)
        let totalSaham = portofolio.reduce((sum, p) => sum + nilaiPosisi(p), 0);
        let totalAset = kasBank + totalSaham;

        ns.print(`📈 Saham  : $${totalSaham.toLocaleString()}`);
        ns.print(`🏦 TOTAL  : $${totalAset.toLocaleString()}`);
        let pnlTotal = ((totalAset - MODAL_AWAL) / MODAL_AWAL * 100).toFixed(2);
        let pnlIcon = totalAset >= MODAL_AWAL ? "🟢" : "🔴";
        ns.print(`${pnlIcon} PnL     : ${pnlTotal}% dari modal awal`);
        ns.print("");

        ns.print(" POSISI SAHAM:");
        // Sortir berdasarkan profit % terbesar (Hari 5)
        let sorted = [...portofolio].sort((a, b) => profitPosisi(b).persen - profitPosisi(a).persen);
        for (let p of sorted) {
            let { nominal, persen } = profitPosisi(p);
            let icon = nominal >= 0 ? "📈" : "📉";
            let harga = pasar[p.sym];
            ns.print(`  ${icon} ${p.sym.padEnd(5)} Harga:$${harga.toLocaleString().padStart(6)} | Profit: ${persen.toFixed(1)}% ($${nominal.toLocaleString()})`);
        }
        ns.print("");
    }

    // Auto-sell jika profit >= target (Hari 2)
    function cekSell(kasBank, targetPct = 10) {
        let terjual = 0;
        let newPorto = [];
        for (let p of portofolio) {
            let { persen, nominal } = profitPosisi(p);
            if (persen >= targetPct) {
                let revenue = nilaiPosisi(p) - KOMISI;
                kasBank += revenue;
                terjual++;
                ns.print(`  ✅ AUTO SELL ${p.sym} +${persen.toFixed(1)}% | +$${nominal.toLocaleString()}`);
            } else {
                newPorto.push(p);
            }
        }
        portofolio = newPorto;
        return kasBank;
    }

    // ================================================================
    // MAIN LOOP (Hari 6: async/await while)
    // ================================================================
    let kasBank = MODAL_AWAL - portofolio.reduce((s, p) =>
        s + p.lembar * p.beliHarga + KOMISI, 0);

    ns.print("🚀 Memulai Investment Tracker...");
    await ns.sleep(500);

    for (let tick = 1; tick <= 10; tick++) {  // Jalankan 10 tick
        simulasiPasar();                        // Harga bergerak
        kasBank = cekSell(kasBank, 8);          // Auto-sell jika >= 8%
        tampilkanLaporan(tick, kasBank);
        await ns.sleep(2000);                   // Tunggu 2 detik per tick
    }

    ns.print("=".repeat(52));
    ns.print("🏁 Simulasi 10 tick selesai!");
    ns.print("");
    ns.print("📝 TANTANGAN AKHIR:");
    ns.print("  1. Tambah fitur AUTO-BUY: beli NVMD jika harganya turun 10%");
    ns.print("  2. Ubah target sell dari 8% ke angka lain, lihat efeknya");
    ns.print("  3. Tambah saham baru 'WDS' ke portofolio awal");
    ns.print("  4. Buat fungsi 'getRichest()' yang return saham paling untung");
}

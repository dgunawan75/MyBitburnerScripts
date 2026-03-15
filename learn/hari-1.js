/** @param {NS} ns **/
// ================================================================
// HARI 1: Variabel, Tipe Data, dan Operasi Dasar
// Jalankan di Bitburner: run learn/hari-1.js
// ================================================================

export async function main(ns) {
    ns.ui.openTail();
    ns.clearLog();
    ns.print("=== HARI 1: Variabel & Tipe Data ===\n");

    // ---------------------------------------------------------
    // MATERI 1.1: let vs const
    // ---------------------------------------------------------
    // const = tidak bisa diubah setelah ditetapkan
    const NAMA_GAME = "Bitburner";          // string
    const HARGA_SERVER = 55000;               // number
    const SUDAH_ROOTED = true;                // boolean

    // let = bisa diubah
    let uang = 1000000;     // 1 juta
    let level = 1;

    ns.print(`[1.1] Game: ${NAMA_GAME}`);
    ns.print(`[1.1] Harga server 8GB: $${HARGA_SERVER}`);
    ns.print(`[1.1] Sudah rooted: ${SUDAH_ROOTED}`);
    ns.print(`[1.1] Uang awal: $${uang}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 1.2: Operasi Aritmatika
    // ---------------------------------------------------------
    let hargaBeli = 1_000_000;   // 1 juta (underscore = pemisah ribuan, hanya visual)
    let hargaJual = 1_120_000;   // 1.12 juta
    let komisi = 100_000;

    let keuntungan = hargaJual - hargaBeli - (komisi * 2);
    let persenUntung = (keuntungan / hargaBeli) * 100;

    ns.print(`[1.2] Beli: $${hargaBeli.toLocaleString()}`);
    ns.print(`[1.2] Jual: $${hargaJual.toLocaleString()}`);
    ns.print(`[1.2] Profit: $${keuntungan.toLocaleString()} (${persenUntung.toFixed(2)}%)`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 1.3: Tipe Data dan typeof
    // ---------------------------------------------------------
    let nilaiString = "foodnstuff";          // string
    let nilaiNumber = 42;                    // number
    let nilaiFloat = 3.14;                  // number (desimal juga number!)
    let nilaiBoolean = false;                 // boolean
    let nilaiNull = null;                  // null
    let nilaiUndef;                            // undefined (belum diisi)

    ns.print(`[1.3] typeof "foodnstuff" → ${typeof nilaiString}`);
    ns.print(`[1.3] typeof 42           → ${typeof nilaiNumber}`);
    ns.print(`[1.3] typeof 3.14         → ${typeof nilaiFloat}`);
    ns.print(`[1.3] typeof false        → ${typeof nilaiBoolean}`);
    ns.print(`[1.3] typeof null         → ${typeof nilaiNull}  ← Bug JS klasik! null dianggap object`);
    ns.print(`[1.3] typeof undefined    → ${typeof nilaiUndef}`);
    ns.print("");

    // ---------------------------------------------------------
    // MATERI 1.4: Template Literal (Backtick)
    // ---------------------------------------------------------
    let serverName = "n00dles";
    let maxRam = 32;
    let hackLevel = 100;
    let reqLevel = 1;
    let bisa = hackLevel >= reqLevel;

    // Template literal: lebih mudah dari string concatenation
    ns.print(`[1.4] Server: ${serverName} | RAM: ${maxRam}GB | Bisa Hack: ${bisa}`);
    // Sama dengan: "[1.4] Server: " + serverName + " | RAM: " + maxRam + "GB ..."

    ns.print("");
    ns.print("=== ✅ Selesai Hari 1! ===");
    ns.print("");
    ns.print("📝 LATIHAN:");
    ns.print("  1. Ubah nilai 'hargaBeli' dan 'hargaJual', lihat profit berubah");
    ns.print("  2. Buat variabel: namaServer, ramGB, isRooted — cetak semuanya");
    ns.print("  3. Hitung: berapa server 8GB bisa dibeli dengan $1 Miliar?");
}

<div align="center">
  <h1>🚀 Bitburner Advanced Scripts 🚀</h1>
  <p><strong>Kumpulan otomasi pintar, bot pintar, dan script hack terdistribusi penuh untuk game "Bitburner"</strong></p>
  <img alt="JavaScript" src="https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E">
  <img alt="Bitburner" src="https://img.shields.io/badge/Bitburner-RPG-green?style=for-the-badge">
</div>

---

## 📖 Deskripsi

Repositori ini berisikan *scripts* level **Menengah hingga Lanjut (Mid-to-Late Game)** yang ditulis dengan `Netscript 2.0 (NS2)` untuk game *hacking-idle-RPG* **Bitburner**. Arsitekturnya dirancang sedemikian rupa untuk *scalability* yang ekstrem — mulai dari manajemen RAM cerdas, algoritma kalkulasi *batching* HWGW terdistribusi untuk meretas server paling mahal di game, hingga kecerdasan buatan (*AI*) kecil untuk aktivitas lain seperti Gang & Server Upgrade.

Lebih dari sekadar script pembobol dasar (*hack-loop*), skrip yang tersedia menggunakan kerangka *manager / brain* dan terpisah menjadi beberapa modul *(modular code)*.

---

## 📁 Struktur Direktori

Koleksi ini dibagi menjadi beberapa versi algoritma (pro) dan direktori pendukung, di antaranya:

*   **`pro-v4/`** ➡️ **Distributed HWGW Engine (Terbaru)**
    Versi mesin _Hack, Weaken, Grow, Weaken_ paling stabil dan efisien. Dapat menyebar (mendistribusikan) pecahan proses thread menyilang di beberapa server bayaran _(purchased servers)_ sekaligus. Menghabisi _target_ besar dengan keterbatasan RAM tiap server. Skrip utama: `dist-hwgw.js`.
*   **`pro-v3/`** ➡️ **HWGE Master Engine V2**
    Iterasi kuat sebelumnya untuk *batching* per server. Memiliki kalkulasi *sleep/delay* sempurna tanpa nabrak (*desync*).
*   **`pro-v1/`** ➡️ **Combat Gang Management**
    Serangkaian otak pengatur aktivitas Gang.
    *   `gang-master.js`: Versi *early game* yang berimbang mencari *Respect* dan *Money*.
    *   `gang-master-med.js`: Versi *mid/late game* dengan pergantian *Ascension* lebih agresif.
    *   `gang-master-rep.js`: Mode *Brutal Terrorism* yang diubah untuk murni menambang *Faction Reputation* secepat kilat.
*   **`modules/`** ➡️ **Library / Core Functions**
    Pustaka fungsi esensial (seperti `smart-server-manager.js`, `hack-engine.js`) yang di-impor (`import`) oleh skrip *brain* utama untuk menghindari pengulangan kode kering (*DRY*).
*   **`ai/` & `workers/`** ➡️ **Automasi Latar Belakang & Daemon**
    Mengurus tugas latar belakang yang tidak memerlukan pemantauan intensif, misal: mengeksekusi `auto-backdoor`, auto beli dan tingkatkan `hacknet`, atau mengeksekusi *port opening script*.
*   **Root Folder Scripts** ➡️ Skrip serbaguna untuk kebutuhan mendadak seperti:
    *   `ultimate-brain.js` / `hybrid-brain.js`: Pengendali jaring utama.
    *   `best-server.js` / `profitfind.js`: Pencari mangsa hack paling menguntungkan per sepersekian detik.

---

## 🛠️ Instalasi & Cara Menggunakan

1.  Buka terminal Bitburner Anda.
2.  Bisa diunduh menggunakan fitur `wget` in-game, atau sinkronisasikan menggunakan ekstensi / API pihak ketiga VS Code *(Bitburner VSCode Extension)* ke port rahasia komputer Anda, dengan melakukan *push* folder ini.
3.  Jalankan salah satu pengendali utama atau daemon. Contoh yang disarankan:
    ```bash
    [home ~/]> run pro-v4/dist-hwgw.js foodnstuff
    ```
    Atau kelola Gang menggunakan:
    ```bash
    [home ~/]> run pro-v1/gang-master-med.js
    ```

## ⚠️ Peringatan
*   Beberapa skrip kelas master (seperti `dist-hwgw.js` atau `mcp.js`) bisa mengonsumsi RAM awal sangat tinggi (di atas 10 - 20 GB hanya untuk menjalankan *script orchestrator*). Pastikan Anda memiliki server _Home_ yang sudah cukup besar atau server pribadi tangguh sebelum menjalankannya untuk menghindari *RAM Not Enough Error*.
*   Seluruh script disetel (kalibrasi) supaya berjalan 100% *background / daemon*. Dianjurkan memunculkan jendela status (Tail) secara manual sesekali atau pantau langsung _Active Scripts_ panel untuk memonitor progres keuangan Anda melesat!

---

*“Informasi adalah senjata pemusnah massal di abad ini. Retas secara bijak.”*

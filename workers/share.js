/** @param {NS} ns **/
export async function main(ns) {
    // Membutuhkan 4GB RAM per thread.
    // Menjalankan perintah share untuk meningkatkan rep gain (Reputation Multiplier).

    // Looping terus menerus
    while (true) {
        await ns.share();
    }
}

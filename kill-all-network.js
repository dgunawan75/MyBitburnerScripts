/** @param {NS} ns **/
export async function main(ns) {

    const servers = scanAll(ns);

    for (let server of servers) {
        ns.killall(server);
        ns.print("Killed scripts on " + server);
    }

}

function scanAll(ns) {
    let discovered = ["home"];

    for (let i = 0; i < discovered.length; i++) {
        let server = discovered[i];
        let neighbors = ns.scan(server);

        for (let n of neighbors) {
            if (!discovered.includes(n)) {
                discovered.push(n);
            }
        }
    }

    return discovered;
}
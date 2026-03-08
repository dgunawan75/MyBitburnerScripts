/** @param {NS} ns **/
export async function main(ns) {

    const myHackLevel = ns.getHackingLevel();
    const servers = scanAll(ns);

    let result = [];

    for (const server of servers) {

        if (server === "home") continue;

        const required = ns.getServerRequiredHackingLevel(server);
        const money = ns.getServerMaxMoney(server);

        result.push({
            name: server,
            required: required,
            money: money,
            canHack: myHackLevel >= required
        });

    }

    // urutkan berdasarkan money terbesar
    result.sort((a,b) => b.money - a.money);

    ns.tprint("Your hacking level: " + myHackLevel);
    ns.tprint("================================");

    for (const s of result) {

        if (s.canHack) {

            ns.tprint("✔ CAN HACK  | " + s.name +
            " | req:" + s.required +
            " | money:$" + s.money);

        } else {

            ns.tprint("✖ TOO HIGH | " + s.name +
            " | req:" + s.required +
            " | money:$" + s.money);

        }

    }

}


function scanAll(ns){

    let visited = new Set();
    let stack = ["home"];

    while(stack.length > 0){

        let server = stack.pop();

        if(!visited.has(server)){

            visited.add(server);

            for(const next of ns.scan(server)){
                stack.push(next);
            }

        }

    }

    return [...visited];
}
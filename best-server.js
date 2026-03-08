/** @param {NS} ns **/
export async function main(ns) {

    const servers = scan(ns);

    let list = [];

    for(const s of servers){

        if(ns.hasRootAccess(s)){

            list.push({
                server:s,
                money:ns.getServerMaxMoney(s)
            });

        }
    }

    list.sort((a,b)=>b.money-a.money);

    for(const s of list){

        ns.tprint(s.server + " : $" + s.money);

    }
}

function scan(ns){

    let visited=new Set();
    let stack=["home"];

    while(stack.length){

        let s=stack.pop();

        if(!visited.has(s)){

            visited.add(s);

            for(const n of ns.scan(s))
                stack.push(n);

        }
    }

    return [...visited];
}
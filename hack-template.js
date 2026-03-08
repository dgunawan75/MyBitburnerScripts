/** @param {NS} ns **/
export async function main(ns){

    const target = ns.args[0]

    while(true){

        let sec = ns.getServerSecurityLevel(target)
        let min = ns.getServerMinSecurityLevel(target)
        let money = ns.getServerMoneyAvailable(target)
        let max = ns.getServerMaxMoney(target)

        ns.print(target,"SEC:",sec,"/",min," MONEY:",money,"/",max)

        if(sec > min){

            ns.print("WEAKEN")
            await ns.weaken(target)

        }else if(money < max){

            ns.print("GROW")
            await ns.grow(target)

        }else{

            ns.print("HACK")
            await ns.hack(target)

        }
    }
}
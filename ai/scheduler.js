export async function schedule(ns,func,delay){

    await ns.sleep(delay)

    await func()

}

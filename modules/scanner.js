export function scanNetwork(ns){

    let discovered=["home"]

    for(let i=0;i<discovered.length;i++){

        let neighbors = ns.scan(discovered[i])

        for(let n of neighbors){

            if(!discovered.includes(n))
                discovered.push(n)

        }

    }

    return discovered
}
def ways_to_sum(target, coins):
    # Buat array DP dengan ukuran (target + 1) dan isi dengan 0
    dp = [0] * (target + 1)
    
    # Ada 1 cara untuk mencapai jumlah 0 (yaitu dengan tidak memilih angka sama sekali)
    dp[0] = 1
    
    # Untuk setiap koin yang tersedia
    for coin in coins:
        # Update array DP dari index koin hingga target
        for i in range(coin, target + 1):
            dp[i] += dp[i - coin]
            
    return dp[target]

if __name__ == "__main__":
    target = 199
    coins = [1,2,4,6,9,10,13,16,17,18,19]
    result = ways_to_sum(target, coins)
    print(f"Total Ways to Sum: {result}")

def ways_to_sum(n):
    dp = [0] * (n + 1)
    dp[0] = 1
    
    # Karena syaratnya adalah menjumlahkan "setidaknya dua bilangan", 
    # maka angka yang digunakan tidak boleh sebesar n itu sendiri.
    # Batas maksimal angkanya adalah n - 1.
    for i in range(1, n):
        for j in range(i, n + 1):
            dp[j] += dp[j - i]
            
    return dp[n]

if __name__ == "__main__":
    n = 89
    result = ways_to_sum(n)
    print(f"Total Ways to Sum {n}: {result}")

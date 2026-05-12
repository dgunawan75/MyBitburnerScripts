def maxProfit(k, prices):
    if not prices:
        return 0
        
    n = len(prices)
    
    # Jika k sangat besar, kita bisa melakukan transaksi sebanyak yang kita mau (seperti Algorithmic Stock Trader II)
    if k >= n // 2:
        profit = 0
        for i in range(1, n):
            if prices[i] > prices[i - 1]:
                profit += prices[i] - prices[i - 1]
        return profit
        
    # Jika k terbatas, gunakan Dynamic Programming
    dp = [[0] * n for _ in range(k + 1)]
    
    for i in range(1, k + 1):
        max_diff = -prices[0]
        for j in range(1, n):
            dp[i][j] = max(dp[i][j - 1], prices[j] + max_diff)
            max_diff = max(max_diff, dp[i - 1][j] - prices[j])
            
    return dp[k][-1]

if __name__ == "__main__":
    data = [7, [26,3,62,181,59,80,27,66,53,47,145,32,97,115,188,44,172,74,161,45]]
    k = data[0]
    prices = data[1]
    
    result = maxProfit(k, prices)
    print(f"Maximum possible profit: {result}")

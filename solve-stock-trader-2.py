def max_profit_ii(prices):
    profit = 0
    for i in range(1, len(prices)):
        if prices[i] > prices[i - 1]:
            profit += prices[i] - prices[i - 1]
    return profit

if __name__ == "__main__":
    prices = [166,48,155,88,12,36,5,87,22,106,155,148,19,191,63,77,75,144,179,100,18,52,69,38,35,24,6,82,177,9,14,86,185,126,50,148,88,15,187,142,7,49,119,78,182]
    result = max_profit_ii(prices)
    print(f"Maximum possible profit: {result}")

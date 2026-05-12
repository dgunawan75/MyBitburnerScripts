def count_primes_in_range(low, high):
    if high < 2:
        return 0
    limit = high
    sieve = [True] * (limit + 1)
    sieve[0] = sieve[1] = False
    for i in range(2, int(limit**0.5) + 1):
        if sieve[i]:
            for j in range(i*i, limit + 1, i):
                sieve[j] = False
    # Count primes between low and high inclusive
    count = 0
    for n in range(max(2, low), high + 1):
        if sieve[n]:
            count += 1
    return count

if __name__ == "__main__":
    low = 3618515
    high = 4176736
    result = count_primes_in_range(low, high)
    print(f"Jumlah bilangan prima antara {low} dan {high} adalah: {result}")
def largest_prime_factor(n):
    i = 2
    while i * i <= n:
        if n % i:
            i += 1
        else:
            n //= i
    return n

if __name__ == "__main__":
    number = 4632186
    result = largest_prime_factor(number)
    print(f"Largest Prime Factor: {result}")

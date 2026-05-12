def max_sub_array(nums):
    if not nums:
        return 0
        
    current_max = nums[0]
    max_so_far = nums[0]
    
    for i in range(1, len(nums)):
        current_max = max(nums[i], current_max + nums[i])
        max_so_far = max(max_so_far, current_max)
        
    return max_so_far

if __name__ == "__main__":
    nums = [-4,7,2,-4,-8,2,-2,5,8,-8,-5]
    result = max_sub_array(nums)
    print(f"Maximum Subarray Sum: {result}")

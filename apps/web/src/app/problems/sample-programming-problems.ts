/**
 * Sample programming problems — built-in, self-written examples for the
 * Learning Agent Platform problem center.
 *
 * Each problem is an original problem statement inspired by common algorithm
 * patterns. No problem text is copied from LeetCode, Luogu, Codeforces, or
 * any other online judge.
 *
 * @module sample-programming-problems
 * @previewOnly — built-in samples; not connected to a real OJ
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SampleProgrammingProblem {
  problemId: string;
  title: string;
  difficulty: "easy" | "medium" | "hard" | "challenge";
  tags: string[];
  statement: string;
  inputDescription: string;
  outputDescription: string;
  examples: ProblemExample[];
  hints: string[];
  sourceType: "built-in-sample";
  estimatedMinutes: number;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string;
}

// ---------------------------------------------------------------------------
// Problem library
// ---------------------------------------------------------------------------

export const SAMPLE_PROBLEMS: SampleProgrammingProblem[] = [
  // 1. Array / String — sliding window max sum
  {
    problemId: "lap-builtin-001",
    title: "Maximum Subarray Sum of Fixed Length",
    difficulty: "easy",
    tags: ["array", "sliding-window"],
    statement: `Given an array of integers arr and a positive integer k, find the
maximum sum of any contiguous subarray of length exactly k.

If the array has fewer than k elements, the result should indicate that
no valid subarray exists.

This is a classic sliding window problem: compute the sum of the first
k elements, then slide the window one position at a time, subtracting
the element that leaves and adding the new element that enters.`,
    inputDescription:
      "A single line containing space-separated integers (the array), followed by a second line containing a single integer k.",
    outputDescription:
      "A single integer: the maximum sum of any length-k contiguous subarray, or a message indicating no valid subarray.",
    examples: [
      {
        input: "1 4 2 10 23 3 1 0 20\n4",
        output: "39",
        explanation:
          "The subarray [4, 2, 10, 23] sums to 39, which is the maximum.",
      },
      {
        input: "100 200 300 400\n2",
        output: "700",
        explanation:
          "The subarray [300, 400] sums to 700.",
      },
      {
        input: "5\n3",
        output: "No valid subarray (k=3 > arr length=1)",
      },
    ],
    hints: [
      "Start by calculating the sum of the first k elements.",
      "For each step, subtract arr[i] and add arr[i+k].",
      "Track the maximum sum seen.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 10,
  },

  // 2. Hash Table — two-sum
  {
    problemId: "lap-builtin-002",
    title: "Pair Sum Finder",
    difficulty: "easy",
    tags: ["hash-table", "array"],
    statement: `Given an array of integers arr and a target integer target, determine
whether there exist two distinct indices i and j such that
arr[i] + arr[j] == target. If such a pair exists, return the two
values (not the indices). If multiple pairs exist, return any one of
them. If no pair exists, return an empty result.

You should solve this with O(n) time complexity by using a hash set to
track seen values.`,
    inputDescription:
      "First line: space-separated integers (the array). Second line: a single integer target.",
    outputDescription:
      "Two integers that sum to the target, space-separated, or 'no pair found'.",
    examples: [
      {
        input: "2 7 11 15\n9",
        output: "2 7",
        explanation: "arr[0] + arr[1] = 2 + 7 = 9.",
      },
      {
        input: "3 2 4\n6",
        output: "2 4",
        explanation: "arr[1] + arr[2] = 2 + 4 = 6.",
      },
      {
        input: "1 2 3\n10",
        output: "no pair found",
        explanation: "No two values in [1,2,3] sum to 10.",
      },
    ],
    hints: [
      "Iterate through the array. For each value v, check if target-v is already in the set.",
      "If found, return (target-v, v). Otherwise, add v to the set.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 8,
  },

  // 3. Two Pointers — palindrome check
  {
    problemId: "lap-builtin-003",
    title: "Longest Palindromic Substring",
    difficulty: "medium",
    tags: ["two-pointers", "string", "dynamic-programming"],
    statement: `Given a string s, find the longest substring of s that is a
palindrome (reads the same forwards and backwards). If there are
multiple longest palindromic substrings, return the one that appears
first (smallest starting index).

A palindrome can be expanded around its center(s). For each position
i, consider two cases:
1. Odd-length palindrome centered at i.
2. Even-length palindrome centered between i and i+1.

Use the two-pointer (expand-around-center) technique for O(n²) time.`,
    inputDescription:
      "A single line containing a non-empty string s (length <= 1000).",
    outputDescription:
      "The longest palindromic substring.",
    examples: [
      {
        input: "babad",
        output: "bab",
        explanation:
          "Both \"bab\" (indices 0-2) and \"aba\" (indices 1-3) have length 3. \"bab\" comes first.",
      },
      {
        input: "cbbd",
        output: "bb",
        explanation:
          "The substring \"bb\" at indices 1-2 has length 2.",
      },
      {
        input: "a",
        output: "a",
        explanation: "A single character is always a palindrome.",
      },
    ],
    hints: [
      "Write a helper function expand(s, left, right) that returns the longest palindrome centered at (left, right).",
      "Call expand for odd-length (i, i) and even-length (i, i+1) at each position.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 15,
  },

  // 4. Stack — balanced brackets
  {
    problemId: "lap-builtin-004",
    title: "Validate Bracket Sequence",
    difficulty: "easy",
    tags: ["stack", "string"],
    statement: `Given a string containing only the characters '(', ')', '{', '}',
'[', and ']', determine whether the bracket sequence is valid.

A valid bracket sequence must satisfy:
1. Every opening bracket must be closed by the same type of bracket.
2. Opening brackets must be closed in the correct order.
3. Every closing bracket has a corresponding opening bracket of the
   same type.

Use a stack to track unmatched opening brackets.`,
    inputDescription:
      "A single line containing a string of brackets.",
    outputDescription:
      '"valid" if the bracket sequence is valid, otherwise "invalid".',
    examples: [
      { input: "()", output: "valid" },
      { input: "()[]{}", output: "valid" },
      {
        input: "([)]",
        output: "invalid",
        explanation:
          "The bracket ']' closes before the '(' is closed by ')'.",
      },
      {
        input: "{[]}",
        output: "valid",
        explanation:
          "All brackets close in the correct nested order.",
      },
    ],
    hints: [
      "Push opening brackets onto the stack.",
      "When you see a closing bracket, pop from the stack and check that it matches.",
      "At the end, the stack should be empty.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 10,
  },

  // 5. BFS — shortest path in grid
  {
    problemId: "lap-builtin-005",
    title: "Shortest Path in Binary Grid",
    difficulty: "medium",
    tags: ["bfs", "graph", "grid"],
    statement: `Given an m x n grid of 0s (passable) and 1s (blocked), find the
shortest path from the top-left cell (0, 0) to the bottom-right cell
(m-1, n-1). You can move up, down, left, or right. If no path exists,
return -1.

Use breadth-first search (BFS) to find the shortest path. BFS
guarantees the first time you reach the target, you've found the
shortest path in an unweighted graph.

The grid is represented as a matrix of integers: 0 means passable,
1 means blocked (wall).`,
    inputDescription: `First line: two integers m and n (dimensions).
Next m lines: each with n space-separated integers (0 or 1).`,
    outputDescription:
      "A single integer: the minimum number of steps to reach (m-1, n-1), or -1 if unreachable.",
    examples: [
      {
        input: "3 3\n0 0 0\n0 1 0\n0 0 0",
        output: "4",
        explanation:
          "Path: (0,0) -> (0,1) -> (0,2) -> (1,2) -> (2,2). That's 4 steps.",
      },
      {
        input: "2 2\n0 1\n1 0",
        output: "-1",
        explanation:
          "No path from (0,0) to (1,1) because all paths are blocked.",
      },
    ],
    hints: [
      "Use a queue for BFS. Each entry should track (row, col, steps).",
      "Mark cells as visited to avoid cycles.",
      "Check boundaries and walls before enqueuing a neighbor.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 15,
  },

  // 6. DFS — connected components
  {
    problemId: "lap-builtin-006",
    title: "Number of Islands in Grid",
    difficulty: "medium",
    tags: ["dfs", "graph", "grid", "bfs"],
    statement: `Given an m x n binary grid of '0's (water) and '1's (land), count
the number of islands. An island is a group of connected '1's
surrounded by water. Cells are connected horizontally or vertically
(not diagonally).

You can solve this with DFS: iterate through each cell in the grid.
When you encounter a '1', increment the island count and perform a
DFS to mark all connected land cells as visited (e.g., by setting
them to '0' to avoid using extra space for a visited matrix).`,
    inputDescription: `First line: m and n.
Next m lines: each with n characters (0 or 1, no spaces).`,
    outputDescription:
      "A single integer: the number of islands.",
    examples: [
      {
        input: "4 5\n11110\n11010\n11000\n00000",
        output: "1",
        explanation:
          "Only one connected group of '1's exists.",
      },
      {
        input: "4 5\n11000\n11000\n00100\n00011",
        output: "3",
        explanation:
          "Three separate groups of connected '1's.",
      },
    ],
    hints: [
      "Loop through every cell. When you find a '1', count++ and DFS to sink it.",
      "DFS should check all 4 directions (up, down, left, right).",
      "Be careful about grid boundaries.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 12,
  },

  // 7. Dynamic Programming — climbing stairs
  {
    problemId: "lap-builtin-007",
    title: "Minimum Cost Climbing Stairs",
    difficulty: "medium",
    tags: ["dynamic-programming", "array"],
    statement: `You are given an array cost where cost[i] is the cost of the i-th
step on a staircase. Once you pay the cost, you can climb either one
or two steps. You can start from step 0 or step 1 (those are the
first two steps on the staircase, indexed from 0).

Return the minimum total cost to reach the top of the floor (beyond
the last index of the array).

Use dynamic programming: let dp[i] be the minimum cost to reach step i.
The recurrence is: dp[i] = cost[i] + min(dp[i-1], dp[i-2]).

The answer is min(dp[n-1], dp[n-2]) since you can reach the top from
either of the last two steps.`,
    inputDescription:
      "A single line: space-separated integers representing the cost array.",
    outputDescription:
      "A single integer: the minimum cost to reach the top.",
    examples: [
      {
        input: "10 15 20",
        output: "15",
        explanation:
          "Start at step 1 (cost 15), then jump two steps to the top. Total: 15.",
      },
      {
        input: "1 100 1 1 1 100 1 1 100 1",
        output: "6",
        explanation:
          "Cheapest path: step 0 (cost 1) -> step 2 (cost 1) -> step 4 (cost 1) -> step 6 (cost 1) -> step 7 (cost 1) -> step 9 (cost 1) -> top. Total: 6.",
      },
    ],
    hints: [
      "Define dp[i] = cost[i] + min(dp[i-1], dp[i-2]) for i >= 2.",
      "Handle base cases: dp[0] = cost[0], dp[1] = cost[1].",
      "You can optimize space to O(1) by keeping only the last two values.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 12,
  },

  // 8. Greedy — interval scheduling
  {
    problemId: "lap-builtin-008",
    title: "Maximum Non-Overlapping Intervals",
    difficulty: "medium",
    tags: ["greedy", "sorting", "intervals"],
    statement: `Given a list of n intervals, each defined by a start time and an
end time [start, end), find the maximum number of intervals you can
select such that no two selected intervals overlap.

Use the classic greedy algorithm: sort all intervals by their end time,
then iterate through the sorted list. Select an interval if its start
time is >= the end time of the last selected interval.

Input is provided as: first line with n (number of intervals), then
n lines each with start end (two integers).`,
    inputDescription: `First line: integer n.
Next n lines: each with two integers (start, end) representing an interval.`,
    outputDescription:
      "A single integer: the maximum number of non-overlapping intervals.",
    examples: [
      {
        input: "4\n1 3\n2 5\n4 6\n6 8",
        output: "3",
        explanation:
          "Select [1,3], [4,6], [6,8] for a total of 3 intervals.",
      },
      {
        input: "3\n1 10\n2 3\n4 5",
        output: "2",
        explanation:
          "Select [2,3] and [4,5] for 2 intervals. [1,10] overlaps both.",
      },
    ],
    hints: [
      "Sort by end time ascending.",
      "Iterate and greedily pick intervals that don't overlap with the last picked interval.",
      "This greedy choice is optimal (exchange argument).",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 10,
  },

  // 9. Graph — Dijkstra
  {
    problemId: "lap-builtin-009",
    title: "Cheapest Flight Path with Limited Stops",
    difficulty: "hard",
    tags: ["graph", "dijkstra", "bfs", "dynamic-programming"],
    statement: `There are n cities connected by some number of flights. You are
given an array flights where each flight[i] = [from, to, price]
indicates a flight from city from to city to with cost price.

You are also given three integers src, dst, and k. Return the cheapest
price from src to dst with at most k stops (not counting the
destination). If no such route exists, return -1.

This is a variation of the shortest path problem with a constraint on
the number of edges. You can solve it with a modified BFS (Bellman-Ford
style) or Dijkstra that tracks (city, stops).`,
    inputDescription: `First line: n (cities), m (flights), src, dst, k.
Next m lines: from to price (integers).`,
    outputDescription:
      "A single integer: the cheapest price, or -1 if unreachable.",
    examples: [
      {
        input: "4 5 0 3 1\n0 1 100\n1 2 100\n2 3 100\n0 2 500\n0 3 700",
        output: "700",
        explanation:
          "Direct flight from 0 to 3 costs 700 (0 stops). The path 0->1->2->3 costs 300 but requires 2 stops, exceeding k=1.",
      },
      {
        input: "3 3 0 2 0\n0 1 100\n1 2 100\n0 2 500",
        output: "500",
        explanation:
          "Direct flight costs 500 and uses 0 stops (k=0 allows 0 stops).",
      },
    ],
    hints: [
      "Model each state as (city, stopsUsed).",
      "Use BFS queue or priority queue ordered by price.",
      "Stop exploring if stopsUsed exceeds k.",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 20,
  },

  // 10. Hash Table + Sorting — top K frequent elements
  {
    problemId: "lap-builtin-010",
    title: "Top K Most Frequent Elements",
    difficulty: "medium",
    tags: ["hash-table", "sorting", "heap"],
    statement: `Given an array of integers arr and a positive integer k, return the
k most frequent elements. The answer may be returned in any order.

Use a hash map to count frequencies, then sort by frequency or use a
min-heap of size k to efficiently find the top k elements.

For a heap approach: build a frequency map, then maintain a min-heap
of size k. For each (element, frequency) pair, push to heap and pop if
size exceeds k.`,
    inputDescription: `First line: space-separated integers (the array).
Second line: a single integer k.`,
    outputDescription:
      "Space-separated integers: the k most frequent elements, in any order.",
    examples: [
      {
        input: "1 1 1 2 2 3\n2",
        output: "1 2",
        explanation:
          "1 appears 3 times, 2 appears 2 times, 3 appears 1 time. Top 2 are 1 and 2.",
      },
      {
        input: "1\n1",
        output: "1",
        explanation:
          "Only one element; it is the top 1.",
      },
    ],
    hints: [
      "Use a hash map to count frequencies: O(n).",
      "Then find the k elements with the highest counts.",
      "A min-heap of size k is O(n log k); sorting all is O(n log n).",
    ],
    sourceType: "built-in-sample",
    estimatedMinutes: 10,
  },
];

// ---------------------------------------------------------------------------
// Derived data
// ---------------------------------------------------------------------------

export const SAMPLE_PROBLEM_COUNT = SAMPLE_PROBLEMS.length;

export const SAMPLE_DIFFICULTY_COUNTS: Record<string, number> = {};
for (const p of SAMPLE_PROBLEMS) {
  SAMPLE_DIFFICULTY_COUNTS[p.difficulty] =
    (SAMPLE_DIFFICULTY_COUNTS[p.difficulty] ?? 0) + 1;
}

export const ALL_SAMPLE_TAGS: string[] = (() => {
  const set = new Set<string>();
  for (const p of SAMPLE_PROBLEMS) {
    for (const t of p.tags) {
      set.add(t);
    }
  }
  return Array.from(set).sort();
})();

export const SAMPLE_TAG_COUNT = ALL_SAMPLE_TAGS.length;

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\bDATABASE_URL\b/i,
  /\bapi[_\s-]*key\b/i,
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bcookie\b/i,
  /\bsession\b/i,
  /\bcertificate\b/i,
  /\bauthorization\b/i,
];

const FORBIDDEN_LABELS = [
  "真实判题",
  "生产可用",
  "云端同步",
  "账号同步完成",
  "真实在线判题",
  "LeetCode",
  "Luogu",
  "Codeforces",
  "OJ 已接入",
  "Online Judge",
] as const;

/**
 * Check that problem data contains no sensitive fields or forbidden labels.
 */
export function sampleProblemDataIsSafe(
  problems: readonly SampleProgrammingProblem[],
): { safe: boolean; violations: string[] } {
  const violations: string[] = [];
  const json = JSON.stringify(problems);

  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(json)) {
      violations.push(`Sensitive field matched: ${pattern.source}`);
    }
  }

  for (const label of FORBIDDEN_LABELS) {
    if (json.includes(label)) {
      violations.push(`Forbidden label found: ${label}`);
    }
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Verify that each problem has all required fields.
 */
export function allProblemsHaveRequiredFields(
  problems: readonly SampleProgrammingProblem[],
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const p of problems) {
    if (!p.problemId || typeof p.problemId !== "string") {
      missing.push(`${p.title ?? "unknown"}: missing problemId`);
    }
    if (!p.title || typeof p.title !== "string") {
      missing.push(`${p.problemId ?? "unknown"}: missing title`);
    }
    if (!p.difficulty) {
      missing.push(`${p.problemId}: missing difficulty`);
    }
    if (!Array.isArray(p.tags) || p.tags.length === 0) {
      missing.push(`${p.problemId}: missing tags`);
    }
    if (!p.statement || typeof p.statement !== "string") {
      missing.push(`${p.problemId}: missing statement`);
    }
    if (!Array.isArray(p.examples) || p.examples.length === 0) {
      missing.push(`${p.problemId}: missing examples`);
    }
    if (!Array.isArray(p.hints) || p.hints.length === 0) {
      missing.push(`${p.problemId}: missing hints`);
    }
    if (p.sourceType !== "built-in-sample") {
      missing.push(`${p.problemId}: incorrect sourceType`);
    }
    if (typeof p.estimatedMinutes !== "number" || p.estimatedMinutes <= 0) {
      missing.push(`${p.problemId}: missing estimatedMinutes`);
    }
  }
  return { valid: missing.length === 0, missing };
}

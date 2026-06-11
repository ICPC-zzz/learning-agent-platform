/**
 * Built-in programming sample book library for Web Reader demo.
 *
 * These books are project-authored educational content designed to demonstrate
 * the Books → BookDetail → Reader flow with real code blocks that trigger the
 * Reader's code-element extractor, code outline, language filter, and scroll
 * highlight features.
 *
 * All content is original teaching text, not copied from third-party sources.
 * All code examples are safe — no credentials, API keys, tokens, secrets,
 * or dangerous commands.
 *
 * Designation: **内置示例书** — 用于演示阅读与代码块识别，未连接用户书库。
 */

import type { ReaderBook, ReaderChapter, ReaderContentChunk } from "../../lib/reader-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SampleBookMeta {
  /** Unique book ID, used in routes like /books/:bookId */
  bookId: string;
  /** Human-readable title */
  title: string;
  /** Short description shown on the book list card */
  description: string;
  /** Rough difficulty label */
  difficulty: "入门" | "中级" | "进阶";
  /** Keywords shown as tags */
  tags: string[];
  /** The ReaderBook with full chapters & chunks */
  readerBook: ReaderBook;
}

export interface SampleChapterRef {
  bookId: string;
  chapterId: string;
  title: string;
  order: number;
  estimatedReadingMinutes: number;
}

// ---------------------------------------------------------------------------
// Book 1 — Python 基础入门示例
// ---------------------------------------------------------------------------

const pythonBasicsBook: ReaderBook = {
  document: {
    id: "sample-python-basics",
    title: "Python 基础入门示例",
    author: "Learning Agent Platform",
    sourceType: "builtin",
    sourceMetadata: { purpose: "内置示例书 — 演示编程阅读与代码块识别" },
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  chapters: [
    {
      id: "sample-python-ch01",
      bookId: "sample-python-basics",
      title: "第 1 章：变量与数据类型",
      orderIndex: 0,
      level: 1,
      plainText: `## 变量与数据类型

在 Python 中，变量不需要提前声明类型。解释器会根据你赋的值自动推断类型。这让 Python 代码读起来很自然，但也意味着你需要养成良好的命名习惯。

### 基本数据类型

Python 内置了几种常用的数据类型。整数、浮点数、字符串和布尔值是最基础的四种。

\`\`\`python
# 整数
age = 25
count = -3

# 浮点数
price = 19.99
ratio = 3.14

# 字符串
name = "Alice"
greeting = '你好，世界'

# 布尔值
is_active = True
is_empty = False
\`\`\`

你可以用 \`type()\` 函数来查看任何变量的类型。

\`\`\`python
print(type(age))       # <class 'int'>
print(type(price))     # <class 'float'>
print(type(name))      # <class 'str'>
print(type(is_active)) # <class 'bool'>
\`\`\`

### 变量命名规范

Python 社区推荐使用 snake_case 命名风格。变量名应该描述它保存的是什么，而不是它的类型。

\`\`\`python
# 好的命名
user_count = 42
total_price = 99.50
first_name = "Bob"

# 不好的命名
a = 42           # 不描述含义
UserCount = 42   # 不符合 snake_case
userCount = 42   # 不符合 snake_case
\`\`\`

### 类型转换

有时你需要把一种类型转换成另一种，比如从字符串转数字：

\`\`\`python
text = "123"
number = int(text)          # 123
float_number = float(text)  # 123.0
back_to_text = str(number)  # "123"
\`\`\`

理解变量和数据类型是编程的起点。下一章我们将学习如何用控制流让程序做出决策。`,
    },
    {
      id: "sample-python-ch02",
      bookId: "sample-python-basics",
      title: "第 2 章：列表与循环",
      orderIndex: 1,
      level: 1,
      plainText: `## 列表与循环

列表是 Python 中最常用的数据结构之一。它可以按顺序存储多个值，并且支持动态增删。

### 创建和访问列表

\`\`\`python
# 创建一个列表
fruits = ["苹果", "香蕉", "橙子", "葡萄"]

# 通过索引访问（从 0 开始）
first = fruits[0]    # "苹果"
last = fruits[-1]    # "葡萄" — 负数索引从末尾计数

# 切片
middle = fruits[1:3] # ["香蕉", "橙子"]
\`\`\`

### 遍历列表

Python 的 for 循环语法非常直观：

\`\`\`python
fruits = ["苹果", "香蕉", "橙子", "葡萄"]

for fruit in fruits:
    print(f"今天吃{fruit}")

# 如果需要索引，使用 enumerate
for index, fruit in enumerate(fruits):
    print(f"第 {index + 1} 种水果：{fruit}")
\`\`\`

### 列表操作

\`\`\`python
numbers = [1, 2, 3]

# 添加
numbers.append(4)       # [1, 2, 3, 4]
numbers.insert(0, 0)    # [0, 1, 2, 3, 4]

# 删除
last = numbers.pop()    # 移除并返回最后一个：4
numbers.remove(0)       # 移除值为 0 的元素

# 排序
numbers.sort()           # 原地排序
sorted_numbers = sorted(numbers, reverse=True)  # 返回新列表
\`\`\`

### 列表推导式

这是 Python 最具表达力的特性之一：

\`\`\`python
# 传统方式
squares = []
for x in range(10):
    squares.append(x ** 2)

# 列表推导式 — 一行搞定
squares = [x ** 2 for x in range(10)]

# 带条件的推导式
even_squares = [x ** 2 for x in range(10) if x % 2 == 0]
\`\`\`

列表和循环是 Python 日常编程中使用最频繁的工具。掌握它们之后，你就能够处理大多数数据批处理任务了。`,
    },
  ],
  chunks: [
    // Chapter 1 chunks
    {
      id: "sample-python-ch01-chunk0",
      bookId: "sample-python-basics",
      chapterId: "sample-python-ch01",
      orderIndex: 0,
      plainText: `## 变量与数据类型

在 Python 中，变量不需要提前声明类型。解释器会根据你赋的值自动推断类型。这让 Python 代码读起来很自然，但也意味着你需要养成良好的命名习惯。`,
      charCount: 150,
      startOffset: 0,
      endOffset: 150,
    },
    {
      id: "sample-python-ch01-chunk1",
      bookId: "sample-python-basics",
      chapterId: "sample-python-ch01",
      orderIndex: 1,
      plainText: `### 基本数据类型

Python 内置了几种常用的数据类型。整数、浮点数、字符串和布尔值是最基础的四种。

\`\`\`python
age = 25
count = -3
price = 19.99
name = "Alice"
is_active = True
\`\`\`

你可以用 type() 函数来查看任何变量的类型：

\`\`\`python
print(type(age))       # <class 'int'>
print(type(price))     # <class 'float'>
\`\`\``,
      charCount: 420,
      startOffset: 150,
      endOffset: 570,
    },
    // Chapter 2 chunks
    {
      id: "sample-python-ch02-chunk0",
      bookId: "sample-python-basics",
      chapterId: "sample-python-ch02",
      orderIndex: 0,
      plainText: `## 列表与循环

列表是 Python 中最常用的数据结构之一。它可以按顺序存储多个值，并且支持动态增删。

### 创建和访问列表

\`\`\`python
fruits = ["苹果", "香蕉", "橙子", "葡萄"]
first = fruits[0]    # "苹果"
last = fruits[-1]    # "葡萄"
\`\`\`

### 遍历列表

Python 的 for 循环语法非常直观：

\`\`\`python
for fruit in fruits:
    print(f"今天吃{fruit}")
\`\`\``,
      charCount: 450,
      startOffset: 0,
      endOffset: 450,
    },
    {
      id: "sample-python-ch02-chunk1",
      bookId: "sample-python-basics",
      chapterId: "sample-python-ch02",
      orderIndex: 1,
      plainText: `### 列表推导式

\`\`\`python
squares = [x ** 2 for x in range(10)]
even_squares = [x ** 2 for x in range(10) if x % 2 == 0]
\`\`\`

列表和循环是 Python 日常编程中使用最频繁的工具。`,
      charCount: 260,
      startOffset: 450,
      endOffset: 710,
    },
  ],
};

// ---------------------------------------------------------------------------
// Book 2 — JavaScript 异步编程示例
// ---------------------------------------------------------------------------

const jsAsyncBook: ReaderBook = {
  document: {
    id: "sample-js-async",
    title: "JavaScript 异步编程示例",
    author: "Learning Agent Platform",
    sourceType: "builtin",
    sourceMetadata: { purpose: "内置示例书 — 演示编程阅读与代码块识别" },
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  chapters: [
    {
      id: "sample-js-async-ch01",
      bookId: "sample-js-async",
      title: "第 1 章：理解回调与 Promise",
      orderIndex: 0,
      level: 1,
      plainText: `## 理解回调与 Promise

JavaScript 在浏览器和 Node.js 中都大量依赖异步操作。从早期的回调地狱到现代的 async/await，异步编程模型的演进是 JavaScript 发展史中最重要的故事之一。

### 回调模式

最传统的异步处理方式是传入一个回调函数：

\`\`\`js
function fetchUser(id, callback) {
  setTimeout(() => {
    callback(null, { id, name: "Alice" });
  }, 1000);
}

fetchUser(42, (error, user) => {
  if (error) {
    console.error("获取用户失败", error);
    return;
  }
  console.log("获取到用户:", user.name);
});
\`\`\`

当多个异步操作需要顺序执行时，回调嵌套会迅速失控：

\`\`\`js
fetchUser(42, (err, user) => {
  if (err) return;
  fetchOrders(user.id, (err, orders) => {
    if (err) return;
    fetchDetails(orders[0].id, (err, details) => {
      if (err) return;
      console.log(details);
    });
  });
});
\`\`\`

### Promise 来救援

Promise 用一个对象包装未来的值，让我们可以链式处理：

\`\`\`js
function fetchUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ id, name: "Alice" });
    }, 1000);
  });
}

fetchUser(42)
  .then((user) => {
    console.log("获取到用户:", user.name);
    return fetchOrders(user.id);
  })
  .then((orders) => fetchDetails(orders[0].id))
  .then((details) => console.log(details))
  .catch((error) => console.error("出错了:", error));
\`\`\`

Promise 还提供了并发工具：

\`\`\`js
const [user, config, permissions] = await Promise.all([
  fetchUser(42),
  fetchConfig(),
  fetchPermissions(),
]);
\`\`\`

理解 Promise 的三种状态（pending、fulfilled、rejected）以及 .then()/.catch()/.finally() 的行为，是掌握异步 JavaScript 的基础。`,
    },
    {
      id: "sample-js-async-ch02",
      bookId: "sample-js-async",
      title: "第 2 章：async/await 与错误处理",
      orderIndex: 1,
      level: 1,
      plainText: `## async/await 与错误处理

async/await 是建立在 Promise 之上的语法糖。它让异步代码看起来像同步代码，但不会阻塞事件循环。

### 基本用法

\`\`\`js
async function main() {
  const user = await fetchUser(42);
  const orders = await fetchOrders(user.id);

  console.log("用户:", user.name);
  console.log("订单数:", orders.length);

  return orders;
}

// async 函数总是返回 Promise
main().then((orders) => console.log("完成", orders));
\`\`\`

### 错误处理

async/await 可以和 try/catch 自然结合：

\`\`\`js
async function safeMain() {
  try {
    const user = await fetchUser(42);
    const orders = await fetchOrders(user.id);
    return orders;
  } catch (error) {
    console.error("操作失败:", error.message);
    return [];
  }
}
\`\`\`

### 并发与顺序

注意：多个 await 会顺序执行。如果你不需要等待上一个结果，应该并行：

\`\`\`js
// 顺序执行 — 慢
const user = await fetchUser(42);
const config = await fetchConfig();   // 等 user 完成后才执行

// 并行执行 — 快
const [user, config] = await Promise.all([
  fetchUser(42),
  fetchConfig(),
]);
\`\`\`

### 常见陷阱

一个常见的错误是在不需要顺序的地方使用顺序 await：

\`\`\`js
async function loadDashboard(userId) {
  // 这三个请求彼此独立，应该并行
  const [profile, notifications, stats] = await Promise.all([
    fetchProfile(userId),
    fetchNotifications(userId),
    fetchStats(userId),
  ]);

  return { profile, notifications, stats };
}
\`\`\`

async/await 让异步代码更容易阅读和调试，但理解它底层的 Promise 机制仍然很重要——尤其是在处理并发和错误传播时。`,
    },
    {
      id: "sample-js-async-ch03",
      bookId: "sample-js-async",
      title: "第 3 章：Fetch API 实战",
      orderIndex: 2,
      level: 1,
      plainText: `## Fetch API 实战

Fetch API 是现代浏览器中发送 HTTP 请求的标准方式。它返回 Promise，和 async/await 配合使用非常流畅。

### 基本 GET 请求

\`\`\`js
async function fetchData() {
  const response = await fetch("/api/example");
  if (!response.ok) {
    throw new Error("请求失败: " + response.status);
  }
  const data = await response.json();
  return data;
}
\`\`\`

### POST 请求

\`\`\`js
async function createItem(item) {
  const response = await fetch("/api/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });

  if (!response.ok) {
    throw new Error("创建失败: " + response.status);
  }

  return response.json();
}
\`\`\`

### 请求超时处理

fetch 本身不支持超时，但你可以用 AbortController 来实现：

\`\`\`js
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("请求超时");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
\`\`\`

### 请求重试

\`\`\`js
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}
\`\`\`

Fetch API 配合 async/await 是现代 Web 开发的基础技能。掌握它之后，你就可以自信地和任何 REST API 交互了。`,
    },
  ],
  chunks: [
    // Chapter 1 chunks
    {
      id: "sample-js-async-ch01-chunk0",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch01",
      orderIndex: 0,
      plainText: `## 理解回调与 Promise

JavaScript 在浏览器和 Node.js 中都大量依赖异步操作。从早期的回调地狱到现代的 async/await，异步编程模型的演进是 JavaScript 发展史中最重要的故事之一。

### 回调模式

\`\`\`js
function fetchUser(id, callback) {
  setTimeout(() => {
    callback(null, { id, name: "Alice" });
  }, 1000);
}
\`\`\``,
      charCount: 380,
      startOffset: 0,
      endOffset: 380,
    },
    {
      id: "sample-js-async-ch01-chunk1",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch01",
      orderIndex: 1,
      plainText: `### Promise 来救援

\`\`\`js
function fetchUser(id) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve({ id, name: "Alice" });
    }, 1000);
  });
}

fetchUser(42)
  .then((user) => console.log(user.name))
  .catch((error) => console.error(error));
\`\`\`

Promise 还提供了并发工具：

\`\`\`js
const [user, config] = await Promise.all([
  fetchUser(42),
  fetchConfig(),
]);
\`\`\``,
      charCount: 480,
      startOffset: 380,
      endOffset: 860,
    },
    // Chapter 2 chunks
    {
      id: "sample-js-async-ch02-chunk0",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch02",
      orderIndex: 0,
      plainText: `## async/await 与错误处理

async/await 是建立在 Promise 之上的语法糖。它让异步代码看起来像同步代码。

\`\`\`js
async function main() {
  const user = await fetchUser(42);
  console.log("用户:", user.name);
  return user;
}
\`\`\``,
      charCount: 280,
      startOffset: 0,
      endOffset: 280,
    },
    {
      id: "sample-js-async-ch02-chunk1",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch02",
      orderIndex: 1,
      plainText: `### 错误处理

\`\`\`js
async function safeMain() {
  try {
    const user = await fetchUser(42);
    return user;
  } catch (error) {
    console.error("操作失败:", error.message);
    return null;
  }
}
\`\`\`

### 并发与顺序

\`\`\`js
const [user, config] = await Promise.all([
  fetchUser(42),
  fetchConfig(),
]);
\`\`\``,
      charCount: 390,
      startOffset: 280,
      endOffset: 670,
    },
    // Chapter 3 chunks
    {
      id: "sample-js-async-ch03-chunk0",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch03",
      orderIndex: 0,
      plainText: `## Fetch API 实战

### 基本 GET 请求

\`\`\`js
async function fetchData() {
  const response = await fetch("/api/example");
  if (!response.ok) throw new Error("请求失败");
  return response.json();
}
\`\`\`

### POST 请求

\`\`\`js
async function createItem(item) {
  const response = await fetch("/api/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  return response.json();
}
\`\`\``,
      charCount: 470,
      startOffset: 0,
      endOffset: 470,
    },
    {
      id: "sample-js-async-ch03-chunk1",
      bookId: "sample-js-async",
      chapterId: "sample-js-async-ch03",
      orderIndex: 1,
      plainText: `### 请求超时处理

\`\`\`js
async function fetchWithTimeout(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
\`\`\`

### 请求重试

\`\`\`js
async function fetchWithRetry(url, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
}
\`\`\``,
      charCount: 580,
      startOffset: 470,
      endOffset: 1050,
    },
  ],
};

// ---------------------------------------------------------------------------
// Book 3 — 算法与数据结构入门
// ---------------------------------------------------------------------------

const algorithmsBook: ReaderBook = {
  document: {
    id: "sample-algorithms-intro",
    title: "算法与数据结构入门",
    author: "Learning Agent Platform",
    sourceType: "builtin",
    sourceMetadata: { purpose: "内置示例书 — 演示编程阅读与代码块识别" },
    createdAt: "2026-05-01T00:00:00.000Z",
  },
  chapters: [
    {
      id: "sample-algorithms-ch01",
      bookId: "sample-algorithms-intro",
      title: "第 1 章：时间复杂度与空间复杂度",
      orderIndex: 0,
      level: 1,
      plainText: `## 时间复杂度与空间复杂度

在编写算法时，我们不仅关心它能不能正确运行，还关心它在不同输入规模下的表现。大 O 符号是最常用的表示方法。

### 常见时间复杂度

从快到慢排列：

O(1) — 常数时间，与输入规模无关。例如数组索引访问。
O(log n) — 对数时间，每次操作把问题规模减半。例如二分查找。
O(n) — 线性时间，遍历一次输入。例如在数组中查找特定元素。
O(n log n) — 线性对数时间。高效排序算法的典型复杂度。
O(n²) — 平方时间。嵌套循环的常见结果。

### 代码实例

\`\`\`python
def find_max(numbers):
    """O(n) — 线性时间：遍历整个列表"""
    if not numbers:
        return None
    max_value = numbers[0]
    for num in numbers:
        if num > max_value:
            max_value = num
    return max_value
\`\`\`

\`\`\`python
def has_duplicate(numbers):
    """O(n²) — 平方时间：每个元素与所有其他元素比较"""
    n = len(numbers)
    for i in range(n):
        for j in range(i + 1, n):
            if numbers[i] == numbers[j]:
                return True
    return False
\`\`\`

### 空间复杂度

空间复杂度衡量算法运行过程中需要多少额外内存。就地算法（in-place）通常只需要 O(1) 额外空间。

\`\`\`python
def reverse_in_place(arr):
    """O(n) 时间，O(1) 额外空间"""
    left, right = 0, len(arr) - 1
    while left < right:
        arr[left], arr[right] = arr[right], arr[left]
        left += 1
        right -= 1
    return arr
\`\`\`

### 分析技巧

分析算法复杂度时，问自己三个问题：
1. 有哪些循环，它们嵌套了多少层？
2. 每次迭代的代价是多少？
3. 在最坏情况下会发生什么？

记住：我们关心的是增长趋势，而不是精确的执行次数。系数和低阶项在大 O 分析中可以忽略。`,
    },
    {
      id: "sample-algorithms-ch02",
      bookId: "sample-algorithms-intro",
      title: "第 2 章：链表与栈",
      orderIndex: 1,
      level: 1,
      plainText: `## 链表与栈

链表和栈是两种最基本的数据结构。理解它们有助于学习更复杂的数据结构。

### 单向链表

链表由节点组成，每个节点保存数据和指向下一个节点的引用：

\`\`\`python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def append(self, value):
        new_node = Node(value)
        if self.head is None:
            self.head = new_node
            return
        current = self.head
        while current.next is not None:
            current = current.next
        current.next = new_node

    def to_list(self):
        result = []
        current = self.head
        while current is not None:
            result.append(current.value)
            current = current.next
        return result
\`\`\`

### 栈（Stack）

栈是一种后进先出（LIFO）的数据结构。Python 的 list 可以很方便地模拟栈：

\`\`\`python
class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        if self.is_empty():
            raise IndexError("栈为空")
        return self.items.pop()

    def peek(self):
        if self.is_empty():
            return None
        return self.items[-1]

    def is_empty(self):
        return len(self.items) == 0

    def size(self):
        return len(self.items)
\`\`\`

### 栈的实际用途

栈在编程中无处不在：

1. **函数调用栈** — 每次函数调用压入调用栈，返回时弹出。
2. **括号匹配** — 编程语言编译器用栈检查括号是否匹配。
3. **撤销操作** — 编辑器中的撤销功能。
4. **浏览器后退** — 浏览历史的回退功能。

\`\`\`python
def is_balanced(expression):
    """用栈检查括号是否匹配"""
    stack = Stack()
    pairs = {")": "(", "]": "[", "}": "{"}

    for char in expression:
        if char in "([{":
            stack.push(char)
        elif char in ")]}":
            if stack.is_empty() or stack.pop() != pairs[char]:
                return False

    return stack.is_empty()
\`\`\`

掌握链表和栈，你就有了理解队列、树和图的基础。`,
    },
  ],
  chunks: [
    // Chapter 1 chunks
    {
      id: "sample-algorithms-ch01-chunk0",
      bookId: "sample-algorithms-intro",
      chapterId: "sample-algorithms-ch01",
      orderIndex: 0,
      plainText: `## 时间复杂度与空间复杂度

在编写算法时，我们不仅关心它能不能正确运行，还关心它在不同输入规模下的表现。大 O 符号是最常用的表示方法。

### 常见时间复杂度

从快到慢排列：O(1) 常数时间，O(log n) 对数时间，O(n) 线性时间，O(n log n) 线性对数时间，O(n²) 平方时间。`,
      charCount: 260,
      startOffset: 0,
      endOffset: 260,
    },
    {
      id: "sample-algorithms-ch01-chunk1",
      bookId: "sample-algorithms-intro",
      chapterId: "sample-algorithms-ch01",
      orderIndex: 1,
      plainText: `### 代码实例

\`\`\`python
def find_max(numbers):
    if not numbers:
        return None
    max_value = numbers[0]
    for num in numbers:
        if num > max_value:
            max_value = num
    return max_value

def has_duplicate(numbers):
    n = len(numbers)
    for i in range(n):
        for j in range(i + 1, n):
            if numbers[i] == numbers[j]:
                return True
    return False
\`\`\``,
      charCount: 440,
      startOffset: 260,
      endOffset: 700,
    },
    // Chapter 2 chunks
    {
      id: "sample-algorithms-ch02-chunk0",
      bookId: "sample-algorithms-intro",
      chapterId: "sample-algorithms-ch02",
      orderIndex: 0,
      plainText: `## 链表与栈

### 单向链表

\`\`\`python
class Node:
    def __init__(self, value):
        self.value = value
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def append(self, value):
        new_node = Node(value)
        if self.head is None:
            self.head = new_node
            return
        current = self.head
        while current.next is not None:
            current = current.next
        current.next = new_node
\`\`\``,
      charCount: 460,
      startOffset: 0,
      endOffset: 460,
    },
    {
      id: "sample-algorithms-ch02-chunk1",
      bookId: "sample-algorithms-intro",
      chapterId: "sample-algorithms-ch02",
      orderIndex: 1,
      plainText: `### 栈

\`\`\`python
class Stack:
    def __init__(self):
        self.items = []

    def push(self, item):
        self.items.append(item)

    def pop(self):
        if self.is_empty():
            raise IndexError("栈为空")
        return self.items.pop()

    def peek(self):
        return None if self.is_empty() else self.items[-1]

    def is_empty(self):
        return len(self.items) == 0

def is_balanced(expression):
    stack = Stack()
    pairs = {")": "(", "]": "[", "}": "{"}
    for char in expression:
        if char in "([{":
            stack.push(char)
        elif char in ")]}":
            if stack.is_empty() or stack.pop() != pairs[char]:
                return False
    return stack.is_empty()
\`\`\``,
      charCount: 640,
      startOffset: 460,
      endOffset: 1100,
    },
  ],
};

// ---------------------------------------------------------------------------
// Meta registry
// ---------------------------------------------------------------------------

export const SAMPLE_BOOKS_META: SampleBookMeta[] = [
  {
    bookId: pythonBasicsBook.document.id,
    title: pythonBasicsBook.document.title,
    description:
      "从零开始学习 Python 编程：变量、数据类型、列表、循环和列表推导式。适合完全没有编程经验的初学者。",
    difficulty: "入门",
    tags: ["Python", "编程基础", "入门"],
    readerBook: pythonBasicsBook,
  },
  {
    bookId: jsAsyncBook.document.id,
    title: jsAsyncBook.document.title,
    description:
      "深入理解 JavaScript 的异步编程模型：回调、Promise、async/await 和 Fetch API。适合有基础 JavaScript 知识的开发者。",
    difficulty: "中级",
    tags: ["JavaScript", "异步编程", "Promise", "async/await"],
    readerBook: jsAsyncBook,
  },
  {
    bookId: algorithmsBook.document.id,
    title: algorithmsBook.document.title,
    description:
      "理解时间复杂度、空间复杂度和大 O 符号，并用 Python 实现链表、栈等基础数据结构。适合正在学习算法思维的程序员。",
    difficulty: "进阶",
    tags: ["算法", "数据结构", "Python", "复杂度分析"],
    readerBook: algorithmsBook,
  },
];

// ---------------------------------------------------------------------------
// Map-based index for fast lookup
// ---------------------------------------------------------------------------

const BOOKS_BY_ID = new Map<string, ReaderBook>(
  SAMPLE_BOOKS_META.map((meta) => [meta.bookId, meta.readerBook]),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get a single sample book by ID, or null if not found. */
export function getSampleBook(bookId: string): ReaderBook | null {
  return BOOKS_BY_ID.get(bookId) ?? null;
}

/** Get a single chapter from a sample book, or null if not found. */
export function getSampleChapter(
  bookId: string,
  chapterId: string,
): {
  book: ReaderBook;
  chapter: ReaderChapter;
  chunks: ReaderContentChunk[];
} | null {
  const book = getSampleBook(bookId);
  if (book === null) return null;

  const chapter = book.chapters.find((ch) => ch.id === chapterId);
  if (chapter === undefined) return null;

  const chunks = book.chunks.filter((chunk) => chunk.chapterId === chapterId);

  return { book, chapter, chunks };
}

/** List all sample book IDs. */
export function listSampleBookIds(): string[] {
  return SAMPLE_BOOKS_META.map((meta) => meta.bookId);
}

/** Check whether a book ID belongs to a sample book. */
export function isSampleBookId(bookId: string): boolean {
  return BOOKS_BY_ID.has(bookId);
}

/** Get sample book meta for the book list page. */
export function getSampleBookMeta(bookId: string): SampleBookMeta | null {
  return SAMPLE_BOOKS_META.find((meta) => meta.bookId === bookId) ?? null;
}

/** List all sample book metas for the book library page. */
export function listSampleBookMetas(): SampleBookMeta[] {
  return [...SAMPLE_BOOKS_META];
}

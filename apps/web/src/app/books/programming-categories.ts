/**
 * Programming categories shared between server actions and client components.
 * NOT a "use server" file â only exports plain data/constants.
 */

export const PROGRAMMING_CATEGORIES: Record<string, string[]> = {
  Python: ["python programming", "python"],
  JavaScript: ["javascript programming", "javascript"],
  Algorithm: ["algorithms", "algorithm"],
  "Data Structures": ["data structures", "data structure"],
  Database: ["database systems", "database"],
  "Web Dev": ["web development", "web programming"],
  "Machine Learning": ["machine learning", "machine learning python"],
  "System Design": ["system design", "system design interview"],
  Java: ["java programming", "spring framework"],
  Go: ["go programming", "golang"],
  Rust: ["rust programming", "rust lang"],
  "C/C++": ["c++ programming", "cpp"],
  Linux: ["linux system", "linux administration"],
  "网络安全": ["cybersecurity", "security"],
  "软件测试": ["software testing", "testing"],
  DevOps: ["devops", "devops engineering"],
};

export function getBulkImportCategories(): string[] {
  return Object.keys(PROGRAMMING_CATEGORIES);
}

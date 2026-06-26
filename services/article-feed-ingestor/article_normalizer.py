from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from typing import Any, Iterable

from article_sanitizer import canonicalize_url, clean_text, truncate_excerpt

ALLOWED_PLATFORMS = {"cnblogs", "csdn"}
BASE_CATEGORIES = [
    "Python",
    "Java",
    "C/C++",
    "Go",
    "JavaScript",
    "前端",
    "后端",
    "数据库",
    "算法",
    "AI",
    "运维/云原生",
    "系统设计",
    "其他",
]

MAX_SOURCE_ITEMS = 50
MAX_TOTAL_ITEMS = 1500
DEFAULT_RETENTION_DAYS = 3650
DEFAULT_SUMMARY_CHARS = 220

CATEGORY_RULES: list[tuple[str, str]] = [
    ("python", "Python"),
    ("java script", "JavaScript"),
    ("javascript", "JavaScript"),
    ("typescript", "JavaScript"),
    ("node.js", "JavaScript"),
    ("vue", "前端"),
    ("react", "前端"),
    ("next.js", "前端"),
    ("前端", "前端"),
    ("后端", "后端"),
    ("spring", "Java"),
    ("jvm", "Java"),
    ("java", "Java"),
    ("c++", "C/C++"),
    ("cpp", "C/C++"),
    ("c/c++", "C/C++"),
    ("golang", "Go"),
    ("go ", "Go"),
    (" go", "Go"),
    ("数据库", "数据库"),
    ("mysql", "数据库"),
    ("redis", "数据库"),
    ("算法", "算法"),
    ("ai", "AI"),
    ("人工智能", "AI"),
    ("运维", "运维/云原生"),
    ("kubernetes", "运维/云原生"),
    ("docker", "运维/云原生"),
    ("云原生", "运维/云原生"),
    ("系统设计", "系统设计"),
]


@dataclass(frozen=True)
class SourceConfig:
    id: str
    name: str
    platform: str
    feedUrl: str
    category: str
    enabled: bool = True


def normalize_source_platform(value: str) -> str | None:
    normalized = value.strip().lower()
    return normalized if normalized in ALLOWED_PLATFORMS else None


def normalize_entry(
    entry: Any,
    source: SourceConfig,
    fetched_at: str,
    retention_days: int = DEFAULT_RETENTION_DAYS,
) -> dict[str, Any] | None:
    platform = normalize_source_platform(source.platform)
    if platform is None:
        return None

    title = clean_text(entry_get(entry, "title"))
    original_url = canonicalize_url(extract_original_url(entry))
    if not title or original_url is None:
        return None

    published_at = normalize_datetime(entry)
    if published_at is not None:
      cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
      published_dt = datetime.fromisoformat(published_at.replace("Z", "+00:00"))
      if published_dt < cutoff:
          return None

    summary = build_summary(entry)
    categories = normalize_categories(source, entry, title, summary)

    return {
        "id": build_article_id(platform, title, published_at, original_url, entry),
        "title": title,
        "summary": summary,
        "originalUrl": original_url,
        "sourceName": source.name.strip() or source.id,
        "sourcePlatform": platform,
        "author": normalize_optional_text(entry_get(entry, "author")),
        "publishedAt": published_at,
        "categories": categories,
        "feedId": source.id,
        "fetchedAt": fetched_at,
    }


def build_summary(entry: Any) -> str:
    summary_candidates: list[str] = []
    for key in ("summary", "description", "subtitle"):
        summary_candidates.append(clean_text(entry_get(entry, key)))

    content_values = entry_get(entry, "content")
    if isinstance(content_values, list):
        for item in content_values:
            if isinstance(item, dict):
                summary_candidates.append(clean_text(str(item.get("value", ""))))

    cleaned = [value for value in summary_candidates if value]
    if not cleaned:
        return "原文摘要暂缺，请点击原文阅读。"

    best = max(cleaned, key=len)
    excerpt = truncate_excerpt(best, DEFAULT_SUMMARY_CHARS)
    return excerpt


def normalize_categories(source: SourceConfig, entry: Any, title: str, summary: str) -> list[str]:
    categories: list[str] = []
    add_category(categories, source.category)
    for raw_tag in extract_tags(entry):
        add_category(categories, raw_tag)

    haystack = f"{title} {summary} {' '.join(extract_tags(entry))}".lower()
    for needle, category in CATEGORY_RULES:
        if needle in haystack:
            add_category(categories, category)

    if not categories:
        categories.append("其他")

    return categories[:3]


def add_category(categories: list[str], value: str | None) -> None:
    if not value:
        return
    normalized = value.strip()
    if not normalized:
        return
    if normalized not in categories:
        categories.append(normalized)


def normalize_optional_text(value: Any) -> str | None:
    if value is None:
        return None
    text = clean_text(str(value))
    return text or None


def extract_tags(entry: Any) -> list[str]:
    tags = entry_get(entry, "tags")
    if not isinstance(tags, list):
      return []
    values: list[str] = []
    for tag in tags:
        if isinstance(tag, dict):
            value = clean_text(str(tag.get("term", "")))
        else:
            value = clean_text(str(tag))
        if value:
            values.append(value)
    return values


def extract_original_url(entry: Any) -> str | None:
    for candidate in (
        entry_get(entry, "link"),
        entry_get(entry, "id"),
        entry_get(entry, "guid"),
        entry_get(entry, "feedburner_origlink"),
    ):
        if isinstance(candidate, str) and canonicalize_url(candidate) is not None:
            return candidate

    links = entry_get(entry, "links")
    if isinstance(links, list):
        for link in links:
            if isinstance(link, dict):
                candidate = link.get("href")
                if isinstance(candidate, str) and canonicalize_url(candidate) is not None:
                    return candidate
    return None


def normalize_datetime(entry: Any) -> str | None:
    for key in ("published_parsed", "updated_parsed"):
        parsed = entry_get(entry, key)
        if parsed is not None:
            try:
                dt = datetime(*parsed[:6], tzinfo=timezone.utc)
                return dt.isoformat().replace("+00:00", "Z")
            except Exception:
                pass

    for key in ("published", "updated"):
        raw = entry_get(entry, key)
        if isinstance(raw, str) and raw.strip():
            try:
                dt = parsedate_to_datetime(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            except Exception:
                pass

    return None


def build_article_id(platform: str, title: str, published_at: str | None, original_url: str, entry: Any) -> str:
    entry_id = entry_get(entry, "id") or entry_get(entry, "guid")
    if isinstance(entry_id, str) and entry_id.strip():
        return f"{platform}:{entry_id.strip()}"

    digest_source = "|".join([platform, title, published_at or "", original_url])
    digest = sha256(digest_source.encode("utf-8")).hexdigest()
    return f"{platform}:{digest[:24]}"


def dedupe_articles(articles: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    deduped: list[dict[str, Any]] = []
    for article in articles:
        key = dedupe_key(article)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(article)
    return deduped


def dedupe_key(article: dict[str, Any]) -> str:
    canonical_url = article.get("originalUrl")
    if isinstance(canonical_url, str) and canonical_url:
        return f"url:{canonical_url}"

    article_id = article.get("id")
    if isinstance(article_id, str) and article_id:
        return f"id:{article_id}"

    digest_source = "|".join(
        [
            str(article.get("sourcePlatform", "")),
            str(article.get("title", "")),
            str(article.get("publishedAt", "")),
        ]
    )
    return "hash:" + sha256(digest_source.encode("utf-8")).hexdigest()


def entry_get(entry: Any, key: str) -> Any:
    if isinstance(entry, dict):
        return entry.get(key)
    if hasattr(entry, key):
        return getattr(entry, key)
    try:
        return entry[key]
    except Exception:
        return None

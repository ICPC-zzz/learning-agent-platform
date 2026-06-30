from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import unescape
from pathlib import Path
from typing import Callable, Iterable
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from urllib.request import Request, urlopen

import feedparser

from article_normalizer import (
    MAX_SOURCE_ITEMS,
    MAX_TOTAL_ITEMS,
    SourceConfig,
    dedupe_articles,
    dedupe_key,
    normalize_entry,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE_FILE = Path(__file__).resolve().with_name("feed_sources.json")
DEFAULT_OUTPUT_FILE = PROJECT_ROOT / "apps/web/src/data/articles.generated.json"
MAX_PAGES_PER_SOURCE = 60
CNBLOGS_BLOGGER_LIST_URL = "https://www.cnblogs.com/allbloggers.aspx"
CNBLOGS_DISCOVERY_LIMIT = 120
CNBLOGS_DISCOVERY_PATTERN = re.compile(
    r'<small>\d+\.\s*&nbsp;</small>\s*<a href="(?P<blog>https://www\.cnblogs\.com/(?P<slug>[^/]+)/)">(?P<name>[^<]+)</a>\s*&nbsp;\s*<a href="(?P<rss>https://www\.cnblogs\.com/[^"]+/rss/)" class="BlogRss">\((?P<label>rss)\)</a>',
    re.IGNORECASE | re.DOTALL,
)


@dataclass
class SourceResult:
    source: SourceConfig
    success: bool
    article_count: int
    accepted_entries: int
    reason: str | None = None


@dataclass
class SourceCollectionResult:
    source_result: SourceResult
    accepted_articles: list[dict[str, object]]


@dataclass
class IngestionResult:
    source_results: list[SourceResult]
    raw_articles: list[dict[str, object]]
    deduped_articles: list[dict[str, object]]

    @property
    def success_source_count(self) -> int:
        return sum(1 for result in self.source_results if result.success)

    @property
    def failed_source_count(self) -> int:
        return sum(1 for result in self.source_results if not result.success)

    @property
    def fetched_article_count(self) -> int:
        return len(self.raw_articles)

    @property
    def deduped_article_count(self) -> int:
        return len(self.deduped_articles)


def load_sources(path: Path = DEFAULT_SOURCE_FILE) -> list[SourceConfig]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    sources: list[SourceConfig] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        sources.append(
            SourceConfig(
                id=str(item.get("id", "")).strip(),
                name=str(item.get("name", "")).strip(),
                platform=str(item.get("platform", "")).strip(),
                feedUrl=str(item.get("feedUrl", "")).strip(),
                category=str(item.get("category", "其他")).strip() or "其他",
                enabled=bool(item.get("enabled", True)),
            )
        )
    sources.extend(discover_cnblogs_sources())
    return dedupe_sources([source for source in sources if source.id and source.feedUrl and source.enabled])


def discover_cnblogs_sources(limit: int = CNBLOGS_DISCOVERY_LIMIT) -> list[SourceConfig]:
    try:
        request = Request(CNBLOGS_BLOGGER_LIST_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(request, timeout=20) as response:  # noqa: S310
            html = response.read().decode("utf-8", errors="ignore")
    except Exception:
        return []

    return parse_cnblogs_sources(html, limit)


def parse_cnblogs_sources(html: str, limit: int = CNBLOGS_DISCOVERY_LIMIT) -> list[SourceConfig]:
    discovered: list[SourceConfig] = []
    for match in CNBLOGS_DISCOVERY_PATTERN.finditer(html):
        name = unescape(match.group("name")).strip()
        slug = match.group("slug").strip()
        rss_url = match.group("rss").strip()
        if not name or not slug or not rss_url:
            continue
        discovered.append(
            SourceConfig(
                id=f"cnblogs-{slug}",
                name=name,
                platform="cnblogs",
                feedUrl=rss_url,
                category="鍏朵粬",
                enabled=True,
            ),
        )
        if len(discovered) >= limit:
            break
    return discovered


def dedupe_sources(sources: Iterable[SourceConfig]) -> list[SourceConfig]:
    seen: set[str] = set()
    unique: list[SourceConfig] = []
    for source in sources:
        if source.feedUrl in seen:
            continue
        seen.add(source.feedUrl)
        unique.append(source)
    return unique


def collect_articles(
    sources: Iterable[SourceConfig],
    fetch_feed: Callable[[str], object] = feedparser.parse,
    now: datetime | None = None,
) -> IngestionResult:
    fetched_at = (now or datetime.now(timezone.utc)).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    source_list = list(sources)
    collection_results: list[SourceCollectionResult | None] = [None] * len(source_list)
    max_workers = min(16, max(1, len(source_list)))

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_index = {
            executor.submit(collect_source_articles, source, fetch_feed, fetched_at): index
            for index, source in enumerate(source_list)
        }
        for future in as_completed(future_to_index):
            index = future_to_index[future]
            try:
                collection_results[index] = future.result()
            except Exception as exc:  # noqa: BLE001
                source = source_list[index]
                collection_results[index] = SourceCollectionResult(
                    source_result=SourceResult(
                        source=source,
                        success=False,
                        article_count=0,
                        accepted_entries=0,
                        reason=safe_error_message(exc),
                    ),
                    accepted_articles=[],
                )

    source_results: list[SourceResult] = []
    raw_articles: list[dict[str, object]] = []
    for result in collection_results:
        if result is None:
            continue
        source_results.append(result.source_result)
        raw_articles.extend(result.accepted_articles)

    deduped_articles = dedupe_articles(raw_articles)
    deduped_articles.sort(
        key=lambda article: str(article.get("publishedAt") or ""),
        reverse=True,
    )
    deduped_articles = deduped_articles[:MAX_TOTAL_ITEMS]
    return IngestionResult(source_results=source_results, raw_articles=raw_articles, deduped_articles=deduped_articles)


def collect_source_articles(
    source: SourceConfig,
    fetch_feed: Callable[[str], object],
    fetched_at: str,
) -> SourceCollectionResult:
    accepted: list[dict[str, object]] = []
    total_entries = 0
    total_accepted = 0
    exhausted = False
    seen_keys: set[str] = set()

    try:
        for page_number in range(1, MAX_PAGES_PER_SOURCE + 1):
            feed_url = build_paged_feed_url(source.feedUrl, page_number)
            feed = fetch_feed(feed_url)
            entries = list(getattr(feed, "entries", []) or [])
            total_entries += len(entries)

            if not entries:
                exhausted = True
                break

            page_accepted = 0
            for entry in entries[:MAX_SOURCE_ITEMS]:
                article = normalize_entry(entry, source, fetched_at)
                if article is None:
                    continue
                key = dedupe_key(article)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                accepted.append(article)
                page_accepted += 1
                total_accepted += 1

            if page_accepted == 0:
                exhausted = True
                break

        if not accepted:
            return SourceCollectionResult(
                source_result=SourceResult(
                    source=source,
                    success=False,
                    article_count=total_entries,
                    accepted_entries=0,
                    reason="no usable articles",
                ),
                accepted_articles=[],
            )

        return SourceCollectionResult(
            source_result=SourceResult(
                source=source,
                success=True,
                article_count=total_entries,
                accepted_entries=total_accepted,
                reason="exhausted" if exhausted else None,
            ),
            accepted_articles=accepted,
        )
    except Exception as exc:  # noqa: BLE001
        return SourceCollectionResult(
            source_result=SourceResult(
                source=source,
                success=False,
                article_count=total_entries,
                accepted_entries=total_accepted,
                reason=safe_error_message(exc),
            ),
            accepted_articles=accepted,
        )


def persist_articles(result: IngestionResult, output_path: Path = DEFAULT_OUTPUT_FILE) -> bool:
    if not result.deduped_articles:
        return False

    existing_articles = load_existing_articles(output_path)
    merged_articles = merge_articles_preserving_existing(existing_articles, result.deduped_articles)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = output_path.with_suffix(output_path.suffix + ".tmp")
    payload = json.dumps(merged_articles, ensure_ascii=False, indent=2)
    temp_path.write_text(payload + "\n", encoding="utf-8")
    temp_path.replace(output_path)
    return True


def load_existing_articles(output_path: Path) -> list[dict[str, object]]:
    try:
        raw = json.loads(output_path.read_text(encoding="utf-8"))
    except Exception:
        return []

    if not isinstance(raw, list):
        return []

    articles: list[dict[str, object]] = []
    for item in raw:
        if isinstance(item, dict):
            articles.append(item)
    return articles


def merge_articles_preserving_existing(
    existing_articles: Iterable[dict[str, object]],
    new_articles: Iterable[dict[str, object]],
) -> list[dict[str, object]]:
    seen: set[str] = set()
    merged: list[dict[str, object]] = []

    for article in existing_articles:
        key = dedupe_key(article)
        if key in seen:
            continue
        seen.add(key)
        merged.append(article)

    for article in new_articles:
        key = dedupe_key(article)
        if key in seen:
            continue
        seen.add(key)
        merged.append(article)

    merged.sort(key=lambda article: str(article.get("publishedAt") or ""), reverse=True)
    return merged


def safe_error_message(error: Exception) -> str:
    message = str(error).strip()
    if not message:
        return error.__class__.__name__
    return message.splitlines()[0][:240]


def build_paged_feed_url(feed_url: str, page_number: int) -> str:
    if page_number <= 1:
        return feed_url

    parsed = urlparse(feed_url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query["page"] = str(page_number)
    return urlunparse(parsed._replace(query=urlencode(query)))


def sync_articles(
    source_file: Path = DEFAULT_SOURCE_FILE,
    output_file: Path = DEFAULT_OUTPUT_FILE,
) -> IngestionResult | None:
    sources = load_sources(source_file)
    if not sources:
        print("No enabled feed sources were found.")
        return None

    result = collect_articles(sources)

    for source_result in result.source_results:
        if source_result.success:
            print(f"[ok] {source_result.source.id}: {source_result.accepted_entries} articles")
        else:
            print(f"[fail] {source_result.source.id}: {source_result.reason or 'unknown error'}")

    print(f"Success sources: {result.success_source_count}")
    print(f"Failed sources: {result.failed_source_count}")
    print(f"Fetched articles: {result.fetched_article_count}")
    print(f"Deduped articles: {result.deduped_article_count}")

    if not result.deduped_articles:
        if output_file.exists():
            print(f"No usable articles were produced. Existing file preserved: {output_file}")
        else:
            print("No usable articles were produced. Output file was not created.")
        return result

    persist_articles(result, output_file)
    print(f"Wrote {output_file}")
    return result


def main() -> int:
    result = sync_articles()
    if result is None:
        return 1

    return 0 if result.deduped_articles else 1


if __name__ == "__main__":
    sys.exit(main())

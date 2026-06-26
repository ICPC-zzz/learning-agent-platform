from __future__ import annotations

import json
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import feedparser

from article_normalizer import SourceConfig, dedupe_articles, normalize_entry
from ingest import IngestionResult, collect_articles, parse_cnblogs_sources, persist_articles


FIXTURES = Path(__file__).resolve().parent / "fixtures"


def load_feed(name: str):
    return feedparser.parse((FIXTURES / name).read_text(encoding="utf-8"))


class ArticleFeedIngestorTests(unittest.TestCase):
    def test_rss_parse_and_normalize(self):
        feed = load_feed("rss_sample.xml")
        source = SourceConfig(
            id="sample-rss",
            name="Sample RSS",
            platform="cnblogs",
            feedUrl="https://example.com/rss",
            category="Python",
            enabled=True,
        )
        fetched_at = "2024-06-18T12:00:00Z"
        first = normalize_entry(feed.entries[0], source, fetched_at, retention_days=9999)
        self.assertIsNotNone(first)
        assert first is not None
        self.assertEqual(first["title"], "Python Async Tips")
        self.assertEqual(first["summary"], "这是一段 HTML 摘要，应该被清洗。")
        self.assertEqual(first["originalUrl"], "https://example.com/python-async")
        self.assertEqual(first["sourcePlatform"], "cnblogs")
        self.assertIn("Python", first["categories"])
        self.assertEqual(first["publishedAt"], "2024-06-18T10:00:00Z")

    def test_rss_dangerous_url_rejected_and_missing_date_is_allowed(self):
        feed = load_feed("rss_sample.xml")
        source = SourceConfig(
            id="sample-rss",
            name="Sample RSS",
            platform="cnblogs",
            feedUrl="https://example.com/rss",
            category="其他",
            enabled=True,
        )
        fetched_at = "2024-06-18T12:00:00Z"
        rejected = normalize_entry(feed.entries[1], source, fetched_at, retention_days=9999)
        self.assertIsNone(rejected)

        fallback = normalize_entry(feed.entries[2], source, fetched_at, retention_days=9999)
        self.assertIsNotNone(fallback)
        assert fallback is not None
        self.assertIsNone(fallback["publishedAt"])
        self.assertIn("Short summary", fallback["summary"])

    def test_atom_parse_and_dedupe(self):
        rss = load_feed("rss_sample.xml")
        atom = load_feed("atom_sample.xml")
        source = SourceConfig(
            id="sample-atom",
            name="Sample Atom",
            platform="csdn",
            feedUrl="https://example.com/atom",
            category="Java",
            enabled=True,
        )
        fetched_at = "2024-06-18T12:00:00Z"
        rss_article = normalize_entry(rss.entries[0], source, fetched_at, retention_days=9999)
        atom_article = normalize_entry(atom.entries[0], source, fetched_at, retention_days=9999)
        duplicate_article = normalize_entry(atom.entries[1], source, fetched_at, retention_days=9999)

        articles = [article for article in [rss_article, atom_article, duplicate_article] if article is not None]
        deduped = dedupe_articles(articles)
        self.assertEqual(len(deduped), 2)
        self.assertEqual(deduped[0]["title"], "Python Async Tips")
        self.assertEqual(deduped[1]["title"], "Java Performance Deep Dive")

    def test_partial_success_and_preserve_existing_file_on_empty_result(self):
        rss = load_feed("rss_sample.xml")
        atom = load_feed("atom_sample.xml")
        good_source = SourceConfig(
            id="good",
            name="Good Source",
            platform="cnblogs",
            feedUrl="https://example.com/good",
            category="Python",
            enabled=True,
        )
        bad_source = SourceConfig(
            id="bad",
            name="Bad Source",
            platform="csdn",
            feedUrl="https://example.com/bad",
            category="AI",
            enabled=True,
        )

        def fake_fetch(url: str):
            if url.endswith("/good"):
                return rss
            if url.endswith("/bad"):
                raise RuntimeError("network unavailable")
            return atom

        result = collect_articles([good_source, bad_source], fetch_feed=fake_fetch, now=datetime(2024, 6, 20, tzinfo=timezone.utc))
        self.assertEqual(result.success_source_count, 1)
        self.assertEqual(result.failed_source_count, 1)
        self.assertGreater(result.fetched_article_count, 0)
        self.assertGreater(result.deduped_article_count, 0)

        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "articles.generated.json"
            output.write_text("keep me", encoding="utf-8")
            empty_result = IngestionResult(source_results=[], raw_articles=[], deduped_articles=[])
            wrote = persist_articles(empty_result, output)
            self.assertFalse(wrote)
            self.assertEqual(output.read_text(encoding="utf-8"), "keep me")

    def test_collect_articles_walks_feed_pages_until_exhausted(self):
        source = SourceConfig(
            id="paged",
            name="Paged Source",
            platform="cnblogs",
            feedUrl="https://example.com/rss",
            category="Python",
            enabled=True,
        )
        calls: list[str] = []

        def fake_fetch(url: str):
            calls.append(url)
            if "page=3" in url:
                return SimpleNamespace(entries=[])
            if "page=2" in url:
                return SimpleNamespace(
                    entries=[
                        {
                            "title": "Paged Article Two",
                            "summary": "<p>Second page item</p>",
                            "link": "https://example.com/paged-two",
                            "published": "Wed, 19 Jun 2024 12:00:00 GMT",
                        }
                    ]
                )
            return SimpleNamespace(
                entries=[
                    {
                        "title": "Paged Article One",
                        "summary": "<p>First page item</p>",
                        "link": "https://example.com/paged-one",
                        "published": "Tue, 18 Jun 2024 12:00:00 GMT",
                    }
                ]
            )

        result = collect_articles([source], fetch_feed=fake_fetch, now=datetime(2024, 6, 20, tzinfo=timezone.utc))
        self.assertEqual(result.success_source_count, 1)
        self.assertEqual(result.failed_source_count, 0)
        self.assertEqual(result.deduped_article_count, 2)
        self.assertTrue(any("page=2" in url for url in calls))
        self.assertTrue(any("page=3" in url for url in calls))

    def test_cnblogs_source_discovery_parses_official_listing(self):
        html = (FIXTURES / "cnblogs_allbloggers_sample.html").read_text(encoding="utf-8")
        sources = parse_cnblogs_sources(html, limit=10)
        self.assertEqual(len(sources), 2)
        self.assertEqual(sources[0].id, "cnblogs-Leo_wl")
        self.assertEqual(sources[0].name, "HackerVirus")
        self.assertEqual(sources[0].feedUrl, "https://www.cnblogs.com/Leo_wl/rss/")
        self.assertEqual(sources[1].id, "cnblogs-findumars")
        self.assertEqual(sources[1].name, "findumars")

    def test_json_payload_has_no_raw_feed_content(self):
        feed = load_feed("rss_sample.xml")
        source = SourceConfig(
            id="sample-rss",
            name="Sample RSS",
            platform="cnblogs",
            feedUrl="https://example.com/rss",
            category="Python",
            enabled=True,
        )
        article = normalize_entry(feed.entries[0], source, "2024-06-18T12:00:00Z", retention_days=9999)
        self.assertIsNotNone(article)
        assert article is not None
        payload = json.dumps(article, ensure_ascii=False)
        self.assertNotIn("content:encoded", payload)
        self.assertNotIn("<p>", payload)
        self.assertNotIn("raw feed", payload.lower())


if __name__ == "__main__":
    unittest.main()

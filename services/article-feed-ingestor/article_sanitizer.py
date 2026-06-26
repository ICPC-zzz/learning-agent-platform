from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data:
          self.parts.append(data)

    def get_text(self) -> str:
        return "".join(self.parts)


def strip_html(value: str) -> str:
    parser = _TextExtractor()
    parser.feed(value)
    parser.close()
    return parser.get_text()


def collapse_whitespace(value: str) -> str:
    return " ".join(value.split())


def clean_text(value: str | None) -> str:
    if value is None:
        return ""
    text = strip_html(unescape(value))
    return collapse_whitespace(text).strip()


def is_http_url(value: str | None) -> bool:
    if not value:
        return False
    parsed = urlsplit(value.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def canonicalize_url(value: str | None) -> str | None:
    if not is_http_url(value):
        return None
    parsed = urlsplit(value.strip())
    cleaned_query_items = [
        (key, item_value)
        for key, item_value in parse_qsl(parsed.query, keep_blank_values=True)
        if key and not key.lower().startswith("utm_") and key.lower() not in {"spm", "from", "ref", "source", "share_source"}
    ]
    cleaned_query = urlencode(cleaned_query_items, doseq=True)
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), parsed.path or "/", cleaned_query, ""))


def truncate_excerpt(value: str, max_chars: int = 220) -> str:
    text = collapse_whitespace(value).strip()
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rstrip() + "..."


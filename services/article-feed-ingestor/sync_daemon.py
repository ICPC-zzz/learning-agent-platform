from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

from ingest import DEFAULT_OUTPUT_FILE, DEFAULT_SOURCE_FILE, sync_articles


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run article feed sync on a fixed interval.")
    parser.add_argument("--once", action="store_true", help="Run a single sync cycle and exit.")
    parser.add_argument(
        "--interval-minutes",
        type=float,
        default=float(os.environ.get("ARTICLE_SYNC_INTERVAL_MINUTES", "60")),
        help="Minutes between sync cycles when running continuously.",
    )
    parser.add_argument(
        "--source-file",
        type=Path,
        default=Path(os.environ.get("ARTICLE_SYNC_SOURCE_FILE", str(DEFAULT_SOURCE_FILE))),
        help="Path to the feed source manifest.",
    )
    parser.add_argument(
        "--output-file",
        type=Path,
        default=Path(os.environ.get("ARTICLE_SYNC_OUTPUT_FILE", str(DEFAULT_OUTPUT_FILE))),
        help="Path to the generated article JSON file.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    interval_seconds = max(60.0, args.interval_minutes * 60.0)

    try:
        while True:
            started_at = time.monotonic()
            print(f"[sync] starting article refresh from {args.source_file}")
            result = sync_articles(args.source_file, args.output_file)
            if result is None:
                print("[sync] no enabled sources found; keeping daemon alive")
            elif result.deduped_articles:
                print(f"[sync] completed with {result.deduped_article_count} articles")
            else:
                print("[sync] completed with no usable articles")

            if args.once:
                return 0 if result and result.deduped_articles else 1

            elapsed = time.monotonic() - started_at
            sleep_seconds = max(0.0, interval_seconds - elapsed)
            print(f"[sync] sleeping {sleep_seconds:.0f}s before next cycle")
            time.sleep(sleep_seconds)
    except KeyboardInterrupt:
        print("[sync] stopped")
        return 0


if __name__ == "__main__":
    sys.exit(main())

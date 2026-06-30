import json
import os
import sys
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar

from scrapling.fetchers import StealthySession

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def login_vjudge(username: str, password: str):
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    payload = urllib.parse.urlencode({"username": username, "password": password}).encode("utf-8")
    request = urllib.request.Request(
        "https://vjudge.net/user/login",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
            ),
            "X-Requested-With": "XMLHttpRequest",
            "Origin": "https://vjudge.net",
            "Referer": "https://vjudge.net/user/login",
        },
    )
    with opener.open(request, timeout=30) as response:
        body = response.read().decode("utf-8", errors="replace")
        print(f"login status={response.status} body={body[:120]!r}")

    cookies = [
        {
            "name": cookie.name,
            "value": cookie.value,
            "domain": cookie.domain,
            "path": cookie.path,
        }
        for cookie in jar
        if "vjudge.net" in cookie.domain
    ]
    if not cookies:
        raise RuntimeError("Login succeeded but no VJudge cookies were captured")
    return opener, cookies


def choose_candidate_rows(rows):
    preferred = {
        "CodeForces": 0,
        "AtCoder": 1,
        "LeetCode": 2,
        "NowCoder": 3,
        "HDU": 4,
        "POJ": 5,
        "Luogu": 6,
        "PTA": 7,
    }
    return sorted(
        rows,
        key=lambda row: (
            0 if row.get("available") else 1,
            preferred.get(str(row.get("originOJ", "")), 99),
            str(row.get("title", "")),
        ),
    )


def print_xhr_summary(page):
    xhrs = getattr(page, "captured_xhr", []) or []
    print(f"captured_xhr={len(xhrs)}")
    for xhr in xhrs[:5]:
        print(f"xhr status={xhr.status} url={xhr.url}")


def is_unavailable_detail_page(text: str) -> bool:
    lowered = text.lower()
    return "this problem is unavailable" in lowered or "problem statement refresh failed" in lowered


def extract_rows_from_problem_page(page):
    for xhr in getattr(page, "captured_xhr", []) or []:
        if "/problem/data" not in xhr.url:
            continue

        body = xhr.body.decode(xhr.encoding or "utf-8", errors="replace")
        payload = json.loads(body)
        rows = payload.get("data") or []
        print(f"list rows={len(rows)} from captured xhr")
        return rows

    raise RuntimeError("No /problem/data XHR was captured from the problem page")


def main():
    username = require_env("VJUDGE_USERNAME")
    password = require_env("VJUDGE_PASSWORD")
    _, cookies = login_vjudge(username, password)

    with StealthySession(
        headless=False,
        real_chrome=True,
        solve_cloudflare=True,
        timeout=90000,
        wait=1500,
        network_idle=True,
        google_search=False,
        block_webrtc=True,
        hide_canvas=True,
        cookies=cookies,
        capture_xhr=r"https://vjudge\.net/problem/data.*",
    ) as session:
        problem_page = session.fetch(
            "https://vjudge.net/problem",
            wait_selector="table tbody tr",
            wait_selector_state="attached",
        )
        print(f"problem page status={problem_page.status} title={problem_page.css('title::text').get()!r}")
        print_xhr_summary(problem_page)
        rows = choose_candidate_rows(extract_rows_from_problem_page(problem_page))

        for row in rows[:8]:
            slug = f"{row['originOJ']}-{row['originProb']}"
            print(
                f"trying title={row['title']!r} slug={slug} available={row.get('available')} oj={row.get('originOJ')!r}"
            )
            detail_page = session.fetch(
                f"https://vjudge.net/problem/{slug}",
                wait_selector="body",
                wait_selector_state="attached",
            )
            title = detail_page.css("title::text").get()
            text_preview = detail_page.get_all_text(strip=True)[:500]
            print(f"detail page status={detail_page.status} title={title!r}")
            if is_unavailable_detail_page(text_preview):
                print("detail page is unavailable, trying next candidate")
                continue

            print(text_preview)
            break
        else:
            raise RuntimeError("No usable detail page found in the first candidate set")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise

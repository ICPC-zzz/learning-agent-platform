import "global-agent/bootstrap";
import https from "node:https";
import { URL } from "node:url";

import type { SafeFetch } from "@learning-agent-platform/book-engine";

export interface OpenLibraryDevFetchOptions {
  timeoutMs: number;
}

export function createOpenLibraryDevFetch(
  options: OpenLibraryDevFetchOptions,
): SafeFetch {
  return async (url, init) => {
    try {
      return await globalThis.fetch(url, init);
    } catch (error) {
      const content = await fetchJsonTextViaHttps(String(url), options.timeoutMs, init);
      return new Response(content, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
}

async function fetchJsonTextViaHttps(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<string> {
  const parsedUrl = new URL(url);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "learning-agent-platform/0.0.0",
    ...headersToRecord(init?.headers),
  };

  return new Promise<string>((resolve, reject) => {
    const request = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: "GET",
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          const content = Buffer.concat(chunks).toString("utf8").trim();
          if (content.length === 0) {
            reject(new Error("HTTPS fallback returned an empty body"));
            return;
          }
          resolve(content);
        });
      },
    );

    request.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      reject(new Error(`Book API request failed: ${truncateForError(message)}`));
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`Book API request timed out after ${timeoutMs}ms`));
    });

    if (init?.signal) {
      const onAbort = () => request.destroy(new Error("Book API request aborted"));
      if (init.signal.aborted) {
        onAbort();
        return;
      }
      init.signal.addEventListener("abort", onAbort, { once: true });
    }

    request.end();
  });
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }
  return headers;
}

function truncateForError(message: string): string {
  const cleaned = message.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 150) return cleaned;
  return `${cleaned.slice(0, 147)}...`;
}

/**
 * A492 — Analysis History Store (v3: saves full reports)
 *
 * Index: .data/analysis-history/{userId}.json — list of metadata entries
 * Reports: .data/reports/{runId}.json — full A492 report JSON
 */
"use server";

import { readAssistantSession } from "../../lib/assistant/assistant-session.ts";
import fs from "node:fs";
import path from "node:path";

export interface SavedAnalysisRecord {
  id: string;
  createdAt: string;
  summary: string;
  problemRating: number | null;
  userRating: number | null;
  findingCount: number;
  personalized: boolean;
  modelName: string;
  /** Whether full report is saved */
  hasFullReport: boolean;
}

var MAX_HISTORY = 20;
var HISTORY_DIR = path.join(process.cwd(), ".data", "analysis-history");
var REPORTS_DIR = path.join(process.cwd(), ".data", "reports");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
function histFile(uid: string) { ensureDir(HISTORY_DIR); return path.join(HISTORY_DIR, uid + ".json"); }
function reportFile(rid: string) { ensureDir(REPORTS_DIR); return path.join(REPORTS_DIR, rid + ".json"); }

function readHistory(uid: string): SavedAnalysisRecord[] {
  try { var fp = histFile(uid); if (!fs.existsSync(fp)) return []; return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch (_) { return []; }
}
function writeHistory(uid: string, recs: SavedAnalysisRecord[]) {
  fs.writeFileSync(histFile(uid), JSON.stringify(recs, null, 2), "utf-8");
}

// ==========================================================================
export async function saveAnalysisResult(input: {
  runId: string;
  summary: string;
  problemRating: number | null;
  userRating: number | null;
  findingCount: number;
  personalized: boolean;
  modelName: string;
  fullResult?: unknown;
}): Promise<{ success: boolean }> {
  try {
    var session = await readAssistantSession();
    if (!session.userId) return { success: false };
    var records = readHistory(session.userId);
    var record: SavedAnalysisRecord = {
      id: input.runId,
      createdAt: new Date().toISOString(),
      summary: input.summary,
      problemRating: input.problemRating,
      userRating: input.userRating,
      findingCount: input.findingCount,
      personalized: input.personalized,
      modelName: input.modelName,
      hasFullReport: input.fullReport != null,
    };
    records.unshift(record);
    if (records.length > MAX_HISTORY) records = records.slice(0, MAX_HISTORY);
    writeHistory(session.userId, records);
    if (input.fullResult) {
      fs.writeFileSync(reportFile(input.runId), JSON.stringify(input.fullResult), "utf-8");
    }
    return { success: true };
  } catch (_) { return { success: false }; }
}

export async function listAnalysisHistory(): Promise<SavedAnalysisRecord[]> {
  try { var s = await readAssistantSession(); if (!s.userId) return []; return readHistory(s.userId); } catch (_) { return []; }
}

export async function getAnalysisReport(runId: string): Promise<unknown | null> {
  try { var fp = reportFile(runId); if (!fs.existsSync(fp)) return null; return JSON.parse(fs.readFileSync(fp, "utf-8")); } catch (_) { return null; }
}

export async function deleteAnalysis(id: string): Promise<boolean> {
  try {
    var s = await readAssistantSession(); if (!s.userId) return false;
    var recs = readHistory(s.userId).filter(function(r) { return r.id !== id; });
    if (recs.length === readHistory(s.userId).length) return false;
    writeHistory(s.userId, recs);
    try { fs.unlinkSync(reportFile(id)); } catch (_) {}
    return true;
  } catch (_) { return false; }
}

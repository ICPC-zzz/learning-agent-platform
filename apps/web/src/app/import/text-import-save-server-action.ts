"use server";

import type { TextImportSaveRequestPreview } from "./text-import-save-request";

export interface TextImportSaveServerActionResult {
  success: false;
  previewOnly: true;
  implemented: false;
  safeToExposeToClient: true;
  reasonCode: "save-disabled-by-default";
  writesDatabase: false;
  callsRepository: false;
  message: string;
}

const NOOP_SERVER_ACTION_RESULT: TextImportSaveServerActionResult = {
  success: false,
  previewOnly: true,
  implemented: false,
  safeToExposeToClient: true,
  reasonCode: "save-disabled-by-default",
  writesDatabase: false,
  callsRepository: false,
  message: "保存请求合同已收到，但真实保存仍未连接。",
};

export async function saveTextImportSaveRequestNoopServerAction(
  previousState: TextImportSaveServerActionResult | null,
  requestPreview: TextImportSaveRequestPreview | null,
): Promise<TextImportSaveServerActionResult> {
  void previousState;
  void requestPreview;

  return NOOP_SERVER_ACTION_RESULT;
}

const READER_SYNC_READINESS_GATE_STATUS = Object.freeze({
  schemaVersion: 1,
  source: "desktop-reader-sync-readiness-gate",
  previewOnly: true,
  ready: false,
  mode: "preview-only / disabled-by-default",
  auth: "not connected",
  permissionGate: "required",
  idempotencyKey: "preview contract only",
  databaseWrites: "disabled",
  publicRoute: "not exposed",
  syncConnection: "真实同步未连接",
  productionDefault: "生产默认关闭",
  accessRequirement: "需要真实 auth/session 后才能进入生产路径",
  visibility: "只读",
});

function buildReaderSyncReadinessGatePanelScript() {
  return `(() => {
    const state = ${JSON.stringify(READER_SYNC_READINESS_GATE_STATUS)};
    const panelId = "desktop-reader-sync-readiness-gate-panel";
    const titleId = "desktop-reader-sync-readiness-gate-title";
    const summaryId = "desktop-reader-sync-readiness-gate-summary";
    const statusId = "desktop-reader-sync-readiness-gate-status";
    const notesId = "desktop-reader-sync-readiness-gate-notes";
    const listId = "desktop-reader-sync-readiness-gate-list";

    function ensureElement(id, tagName, parent) {
      let node = document.getElementById(id);
      if (node) {
        return node;
      }

      node = document.createElement(tagName);
      node.id = id;
      if (parent) {
        parent.appendChild(node);
      }
      return node;
    }

    function ensureRow(parent, id, labelText) {
      let row = document.getElementById(id);
      if (!row) {
        row = document.createElement("li");
        row.id = id;
        const label = document.createElement("span");
        label.id = id + "-label";
        label.style.color = "#5b6473";
        label.textContent = labelText + "：";
        const value = document.createElement("strong");
        value.id = id + "-value";
        value.style.marginLeft = "6px";
        value.textContent = "-";
        row.appendChild(label);
        row.appendChild(value);
        parent.appendChild(row);
      }
      return row;
    }

    function insertAfter(targetNode, node) {
      if (!targetNode || !targetNode.parentNode) {
        return false;
      }

      const parent = targetNode.parentNode;
      if (targetNode.nextSibling) {
        parent.insertBefore(node, targetNode.nextSibling);
      } else {
        parent.appendChild(node);
      }
      return true;
    }

    let panel = document.getElementById(panelId);
    if (!panel) {
      panel = document.createElement("section");
      panel.id = panelId;
      panel.setAttribute("aria-live", "polite");
      panel.style.marginTop = "12px";
      panel.style.border = "1px solid #d9dee7";
      panel.style.borderRadius = "10px";
      panel.style.background = "#f8fafc";
      panel.style.padding = "12px";
      panel.style.boxShadow = "0 1px 0 rgba(15, 23, 42, 0.03)";

      const title = document.createElement("p");
      title.id = titleId;
      title.style.margin = "0";
      title.style.fontWeight = "600";
      panel.appendChild(title);

      const summary = document.createElement("p");
      summary.id = summaryId;
      summary.style.marginTop = "6px";
      summary.style.color = "#5b6473";
      summary.style.fontSize = "13px";
      panel.appendChild(summary);

      const status = document.createElement("p");
      status.id = statusId;
      status.style.marginTop = "6px";
      status.style.fontWeight = "600";
      panel.appendChild(status);

      const notes = document.createElement("p");
      notes.id = notesId;
      notes.style.marginTop = "6px";
      notes.style.color = "#5b6473";
      notes.style.fontSize = "13px";
      panel.appendChild(notes);

      const list = document.createElement("ul");
      list.id = listId;
      list.style.marginTop = "8px";
      list.style.paddingLeft = "18px";
      list.style.display = "grid";
      list.style.gap = "4px";
      panel.appendChild(list);

      const anchor = document.getElementById("desktop-reader-sync-health-panel")
        || document.getElementById("desktop-navigation-shell");
      if (!insertAfter(anchor, panel) && document.body) {
        document.body.appendChild(panel);
      }
    }

    const titleNode = ensureElement(titleId, "p", panel);
    titleNode.style.margin = "0";
    titleNode.style.fontWeight = "600";
    titleNode.textContent = "Reader Sync readiness gate（开发预览）";

    const summaryNode = ensureElement(summaryId, "p", panel);
    summaryNode.style.marginTop = "6px";
    summaryNode.style.color = "#5b6473";
    summaryNode.style.fontSize = "13px";
    summaryNode.textContent =
      "开发预览 · 只读 · 真实同步未连接 · 生产默认关闭";

    const statusNode = ensureElement(statusId, "p", panel);
    statusNode.style.marginTop = "6px";
    statusNode.style.fontWeight = "600";
    statusNode.textContent =
      "ready: " + String(state.ready) + " / mode: " + state.mode;

    const notesNode = ensureElement(notesId, "p", panel);
    notesNode.style.marginTop = "6px";
    notesNode.style.color = "#5b6473";
    notesNode.style.fontSize = "13px";
    notesNode.textContent =
      state.accessRequirement + "；当前仅展示 safe-to-expose 的只读状态，不写 DB，不接 auth，不暴露公开路由。";

    const listNode = ensureElement(listId, "ul", panel);
    listNode.style.marginTop = "8px";
    listNode.style.paddingLeft = "18px";
    listNode.style.display = "grid";
    listNode.style.gap = "4px";

    const rows = [
      { id: "desktop-reader-sync-readiness-gate-ready", label: "ready", value: state.ready },
      { id: "desktop-reader-sync-readiness-gate-mode", label: "mode", value: state.mode },
      { id: "desktop-reader-sync-readiness-gate-auth", label: "auth", value: state.auth },
      { id: "desktop-reader-sync-readiness-gate-permission-gate", label: "permission gate", value: state.permissionGate },
      { id: "desktop-reader-sync-readiness-gate-idempotency-key", label: "idempotency key", value: state.idempotencyKey },
      { id: "desktop-reader-sync-readiness-gate-database-writes", label: "database writes", value: state.databaseWrites },
      { id: "desktop-reader-sync-readiness-gate-public-route", label: "public route", value: state.publicRoute },
      { id: "desktop-reader-sync-readiness-gate-production-default", label: "production default", value: state.productionDefault },
    ];

    for (let i = 0; i < rows.length; i += 1) {
      const row = ensureRow(listNode, rows[i].id, rows[i].label);
      const valueNode = document.getElementById(rows[i].id + "-value");
      if (valueNode) {
        valueNode.textContent = String(rows[i].value);
      }
    }

    return true;
  })();`;
}

module.exports = {
  READER_SYNC_READINESS_GATE_STATUS,
  buildReaderSyncReadinessGatePanelScript,
};

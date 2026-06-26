const READER_SYNC_HEALTH_STATUS = Object.freeze({
  schemaVersion: 1,
  source: "desktop-reader-sync-health",
  previewOnly: true,
  readiness: "disabled / preview-only",
  auth: "not connected",
  databaseWrites: "disabled",
  idempotency: "preview contract exists",
  permissionGate: "required before any dev/test path",
  syncConnection: "真实同步未连接",
  productionWrites: "生产写入默认关闭",
  developmentMode: "开发预览",
  visibility: "只读状态",
});

function buildReaderSyncHealthPanelScript() {
  return `(() => {
    const state = ${JSON.stringify(READER_SYNC_HEALTH_STATUS)};
    const panelId = "desktop-reader-sync-health-panel";
    const titleId = "desktop-reader-sync-health-title";
    const summaryId = "desktop-reader-sync-health-summary";
    const statusId = "desktop-reader-sync-health-status";
    const notesId = "desktop-reader-sync-health-notes";
    const listId = "desktop-reader-sync-health-list";

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

      const mountPoint = document.getElementById("desktop-navigation-shell");
      if (mountPoint && mountPoint.parentNode) {
        mountPoint.parentNode.insertBefore(panel, mountPoint.nextSibling);
      } else if (document.body) {
        document.body.appendChild(panel);
      }
    }

    const titleNode = ensureElement(titleId, "p", panel);
    titleNode.style.margin = "0";
    titleNode.style.fontWeight = "600";
    titleNode.textContent = "Reader Sync 健康状态（开发预览）";

    const summaryNode = ensureElement(summaryId, "p", panel);
    summaryNode.style.marginTop = "6px";
    summaryNode.style.color = "#5b6473";
    summaryNode.style.fontSize = "13px";
    summaryNode.textContent =
      "开发预览 · 只读状态 · 真实同步未连接 · 生产写入默认关闭";

    const statusNode = ensureElement(statusId, "p", panel);
    statusNode.style.marginTop = "6px";
    statusNode.style.fontWeight = "600";
    statusNode.textContent = state.syncConnection;

    const notesNode = ensureElement(notesId, "p", panel);
    notesNode.style.marginTop = "6px";
    notesNode.style.color = "#5b6473";
    notesNode.style.fontSize = "13px";
    notesNode.textContent =
      "当前面板仅展示 safe-to-expose 的只读健康状态，不接 auth，不写 DB，不发起真实同步。";

    const listNode = ensureElement(listId, "ul", panel);
    listNode.style.marginTop = "8px";
    listNode.style.paddingLeft = "18px";
    listNode.style.display = "grid";
    listNode.style.gap = "4px";

    const rows = [
      { id: "desktop-reader-sync-health-readiness", label: "readiness", value: state.readiness },
      { id: "desktop-reader-sync-health-auth", label: "auth", value: state.auth },
      { id: "desktop-reader-sync-health-database-writes", label: "database writes", value: state.databaseWrites },
      { id: "desktop-reader-sync-health-idempotency", label: "idempotency", value: state.idempotency },
      { id: "desktop-reader-sync-health-permission-gate", label: "permission gate", value: state.permissionGate },
    ];

    for (let i = 0; i < rows.length; i += 1) {
      const row = ensureRow(listNode, rows[i].id, rows[i].label);
      const valueNode = document.getElementById(rows[i].id + "-value");
      if (valueNode) {
        valueNode.textContent = rows[i].value;
      }
    }

    return true;
  })();`;
}

module.exports = {
  READER_SYNC_HEALTH_STATUS,
  buildReaderSyncHealthPanelScript,
};

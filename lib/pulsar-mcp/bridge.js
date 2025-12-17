/**
 * HTTP Bridge server for Pulsar MCP
 * Runs inside Pulsar and provides direct access to atom APIs
 */

const http = require("http");
const { URL } = require("url");
const { tools } = require("./tools");
const { validators, defineTool, executeFromRegistry } = require("./tool-registry");

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

// ============================================================================
// Tool Implementations
// ============================================================================

const toolImpls = {
  getActiveEditor() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const cursor = editor.getCursorBufferPosition();
    return {
      path: editor.getPath() || null,
      content: editor.getText(),
      cursorPosition: { row: cursor.row, column: cursor.column },
      grammar: editor.getGrammar()?.name || "Plain Text",
      modified: editor.isModified(),
    };
  },

  getSelection() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    const selection = editor.getLastSelection();
    if (!selection || selection.isEmpty()) return null;

    const range = selection.getBufferRange();
    return {
      text: selection.getText(),
      range: {
        start: { row: range.start.row, column: range.start.column },
        end: { row: range.end.row, column: range.end.column },
      },
    };
  },

  insertText({ text }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;
    editor.insertText(text);
    return true;
  },

  replaceSelection({ text }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const selection = editor.getLastSelection();
    if (!selection) return false;

    selection.insertText(text);
    return true;
  },

  async openFile({ path, line, column }) {
    const options = {};
    if (line !== undefined) {
      options.initialLine = line - 1;
      if (column !== undefined) {
        options.initialColumn = column - 1;
      }
    }
    await atom.workspace.open(path, options);
    return true;
  },

  goToPosition({ line, column = 1 }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    editor.setCursorBufferPosition([line - 1, column - 1]);
    editor.scrollToCursorPosition({ center: true });
    return true;
  },

  getOpenEditors() {
    const editors = atom.workspace.getTextEditors();
    const activeEditor = atom.workspace.getActiveTextEditor();

    return editors.map((editor) => ({
      path: editor.getPath() || null,
      modified: editor.isModified(),
      active: editor === activeEditor,
    }));
  },

  getProjectPaths() {
    return atom.project.getPaths();
  },

  async saveFile({ path }) {
    if (path) {
      const editor = atom.workspace.getTextEditors().find((e) => e.getPath() === path);
      if (!editor) return false;
      await editor.save();
      return true;
    }

    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    await editor.save();
    return true;
  },

  setSelections({ ranges }) {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    const bufferRanges = ranges.map((r) => [
      [r.startRow, r.startColumn],
      [r.endRow, r.endColumn],
    ]);
    editor.setSelectedBufferRanges(bufferRanges);
    return true;
  },

  getAllSelections() {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return null;

    return editor.getSelections().map((selection) => {
      const range = selection.getBufferRange();
      return {
        text: selection.getText(),
        isEmpty: selection.isEmpty(),
        range: {
          start: { row: range.start.row, column: range.start.column },
          end: { row: range.end.row, column: range.end.column },
        },
      };
    });
  },

  async revealInTreeView({ path }) {
    const target = atom.views.getView(atom.workspace);
    await atom.commands.dispatch(target, "tree-view:reveal-active-file");

    if (path) {
      await atom.workspace.open(path, { activatePane: true });
      await atom.commands.dispatch(target, "tree-view:reveal-active-file");
    }
    return true;
  },

  async closeFile({ path, save = false }) {
    let editor, pane;

    if (path) {
      editor = atom.workspace.getTextEditors().find((e) => e.getPath() === path);
      if (!editor) return false;
      pane = atom.workspace.paneForItem(editor);
    } else {
      editor = atom.workspace.getActiveTextEditor();
      if (!editor) return false;
      pane = atom.workspace.getActivePane();
    }

    if (save && editor.isModified()) {
      await editor.save();
    }

    pane.destroyItem(editor, true);
    return true;
  },

  async splitPane({ direction, path }) {
    const pane = atom.workspace.getActivePane();
    const splitMethods = {
      left: "splitLeft",
      right: "splitRight",
      up: "splitUp",
      down: "splitDown",
    };

    const method = splitMethods[direction];
    if (!method) return false;

    const newPane = pane[method]();

    if (path) {
      await atom.workspace.open(path, { pane: newPane });
    }
    return true;
  },

  async closePane({ saveAll = false }) {
    const pane = atom.workspace.getActivePane();
    if (!pane) return false;

    if (saveAll) {
      for (const item of pane.getItems()) {
        if (item.isModified?.() && item.save) {
          await item.save();
        }
      }
    }

    pane.destroy();
    return true;
  },

  getPanelState() {
    const getDockInfo = (dock) => ({
      visible: dock.isVisible(),
      items: dock.getPaneItems().length,
    });

    return {
      left: getDockInfo(atom.workspace.getLeftDock()),
      right: getDockInfo(atom.workspace.getRightDock()),
      bottom: getDockInfo(atom.workspace.getBottomDock()),
      panes: {
        count: atom.workspace.getPanes().length,
        activeIndex: atom.workspace.getPanes().indexOf(atom.workspace.getActivePane()),
      },
    };
  },
};

// ============================================================================
// Tool Registry
// ============================================================================

const toolRegistry = {
  GetActiveEditor: defineTool({
    impl: toolImpls.getActiveEditor,
    format: (data) => data,
  }),

  GetSelection: defineTool({
    impl: toolImpls.getSelection,
    format: (data) => data,
  }),

  InsertText: defineTool({
    impl: toolImpls.insertText,
    validate: { text: validators.string },
    format: (result) => ({ inserted: result }),
  }),

  ReplaceSelection: defineTool({
    impl: toolImpls.replaceSelection,
    validate: { text: validators.string },
    format: (result) => ({ replaced: result }),
  }),

  OpenFile: defineTool({
    impl: toolImpls.openFile,
    validate: { path: validators.string },
    format: (result) => ({ opened: result }),
  }),

  GoToPosition: defineTool({
    impl: toolImpls.goToPosition,
    validate: { line: validators.number },
    format: (result) => ({ navigated: result }),
  }),

  GetOpenEditors: defineTool({
    impl: toolImpls.getOpenEditors,
    format: (data) => data,
  }),

  GetProjectPaths: defineTool({
    impl: toolImpls.getProjectPaths,
    format: (data) => data,
  }),

  SaveFile: defineTool({
    impl: toolImpls.saveFile,
    format: (result) => ({ saved: result }),
  }),

  SetSelections: defineTool({
    impl: toolImpls.setSelections,
    validate: { ranges: validators.array },
    format: (result, args) => ({ selectionsSet: result, count: args.ranges.length }),
  }),

  GetAllSelections: defineTool({
    impl: toolImpls.getAllSelections,
    format: (data) => data,
  }),

  RevealInTreeView: defineTool({
    impl: toolImpls.revealInTreeView,
    validate: { path: validators.string },
    format: (result) => ({ revealed: result }),
  }),

  CloseFile: defineTool({
    impl: toolImpls.closeFile,
    format: (result) => ({ closed: result }),
  }),

  SplitPane: defineTool({
    impl: toolImpls.splitPane,
    validate: {
      direction: (v, n) => validators.enum(v, n, ["left", "right", "up", "down"]),
    },
    format: (result, args) => ({ split: result, direction: args.direction }),
  }),

  ClosePane: defineTool({
    impl: toolImpls.closePane,
    format: (result) => ({ closed: result }),
  }),

  GetPanelState: defineTool({
    impl: toolImpls.getPanelState,
    format: (data) => data,
  }),
};

/**
 * Execute a tool call using the registry
 */
function executeTool(toolName, args) {
  return executeFromRegistry(toolRegistry, toolName, args);
}

// ============================================================================
// HTTP Server
// ============================================================================

/**
 * Parse JSON body from request
 */
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

/**
 * Send JSON response
 */
function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(data));
}

/**
 * Start the HTTP bridge server
 */
function startBridge(config = {}) {
  const port = config.port ?? DEFAULT_PORT;
  const host = config.host ?? DEFAULT_HOST;

  const server = http.createServer(async (req, res) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      // GET /health - Health check
      if (req.method === "GET" && pathname === "/health") {
        sendJson(res, { status: "ok", timestamp: Date.now() });
        return;
      }

      // GET /tools - List available tools
      if (req.method === "GET" && pathname === "/tools") {
        sendJson(res, { tools });
        return;
      }

      // POST /tools/:toolName - Execute a tool
      const toolMatch = pathname.match(/^\/tools\/([A-Z][a-zA-Z]*)$/);
      if (req.method === "POST" && toolMatch) {
        const toolName = toolMatch[1];
        const args = await parseBody(req);
        const result = await executeTool(toolName, args);

        if (result.success) {
          sendJson(res, result);
        } else {
          sendJson(res, result, 400);
        }
        return;
      }

      // 404 Not Found
      sendJson(res, { error: "Not found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sendJson(res, { error: message }, 500);
    }
  });

  server.listen(port, host);

  console.log(`[claude-chat] MCP bridge listening on http://${host}:${port}`);

  return {
    port,
    host,
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  };
}

/**
 * Stop the bridge server
 */
async function stopBridge(bridge) {
  await bridge.stop();
  console.log("[claude-chat] MCP bridge stopped");
}

module.exports = { startBridge, stopBridge };

/**
 * HTTP Bridge server for Pulsar MCP
 * Runs inside Pulsar and provides direct access to atom APIs
 */

const http = require("http");
const { URL } = require("url");
const { tools } = require("./tools");

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = "127.0.0.1";

// ============================================================================
// Pulsar API Implementation (direct atom access)
// ============================================================================

/**
 * Get information about the active text editor
 */
function getActiveEditor() {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return null;

  const cursor = editor.getCursorBufferPosition();

  return {
    path: editor.getPath() || null,
    content: editor.getText(),
    cursorPosition: {
      row: cursor.row,
      column: cursor.column,
    },
    grammar: editor.getGrammar()?.name || "Plain Text",
    modified: editor.isModified(),
  };
}

/**
 * Get the current selection in the active editor
 */
function getSelection() {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return null;

  const selection = editor.getLastSelection();
  if (!selection || selection.isEmpty()) return null;

  const range = selection.getBufferRange();

  return {
    text: selection.getText(),
    range: {
      start: {
        row: range.start.row,
        column: range.start.column,
      },
      end: {
        row: range.end.row,
        column: range.end.column,
      },
    },
  };
}

/**
 * Insert text at the current cursor position
 */
function insertText(text) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return false;

  editor.insertText(text);
  return true;
}

/**
 * Replace the current selection with new text
 */
function replaceSelection(text) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return false;

  const selection = editor.getLastSelection();
  if (!selection) return false;

  selection.insertText(text);
  return true;
}

/**
 * Open a file in the editor
 */
async function openFile(filePath, line, column) {
  try {
    const options = {};

    if (line !== undefined) {
      options.initialLine = line - 1;
      if (column !== undefined) {
        options.initialColumn = column - 1;
      }
    }

    await atom.workspace.open(filePath, options);
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to open file:", error);
    return false;
  }
}

/**
 * Navigate to a specific position in the active editor
 */
function goToPosition(line, column = 1) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return false;

  try {
    editor.setCursorBufferPosition([line - 1, column - 1]);
    editor.scrollToCursorPosition({ center: true });
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to go to position:", error);
    return false;
  }
}

/**
 * Get list of all open editor tabs
 */
function getOpenEditors() {
  const editors = atom.workspace.getTextEditors();
  const activeEditor = atom.workspace.getActiveTextEditor();

  return editors.map((editor) => ({
    path: editor.getPath() || null,
    modified: editor.isModified(),
    active: editor === activeEditor,
  }));
}

/**
 * Get list of project root paths
 */
function getProjectPaths() {
  return atom.project.getPaths();
}

/**
 * Save the current or specified file
 */
async function saveFile(filePath) {
  try {
    if (filePath) {
      const editors = atom.workspace.getTextEditors();
      const editor = editors.find((e) => e.getPath() === filePath);
      if (editor) {
        await editor.save();
        return true;
      }
      return false;
    }

    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) return false;

    await editor.save();
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to save file:", error);
    return false;
  }
}

/**
 * Set one or more selections in the active editor
 */
function setSelections(ranges) {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return false;

  try {
    const bufferRanges = ranges.map((r) => [
      [r.startRow, r.startColumn],
      [r.endRow, r.endColumn],
    ]);
    editor.setSelectedBufferRanges(bufferRanges);
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to set selections:", error);
    return false;
  }
}

/**
 * Get all current selections in the active editor
 */
function getAllSelections() {
  const editor = atom.workspace.getActiveTextEditor();
  if (!editor) return null;

  const selections = editor.getSelections();
  return selections.map((selection) => {
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
}

/**
 * Reveal a file or folder in the tree view
 */
async function revealInTreeView(filePath) {
  try {
    // Dispatch the tree-view reveal command
    const target = atom.views.getView(atom.workspace);
    await atom.commands.dispatch(target, "tree-view:reveal-active-file");

    // If a specific path was provided, try to select it
    if (filePath) {
      // First open the file to make it active, then reveal
      await atom.workspace.open(filePath, { activatePane: true });
      await atom.commands.dispatch(target, "tree-view:reveal-active-file");
    }
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to reveal in tree view:", error);
    return false;
  }
}

/**
 * Close an open editor tab
 */
async function closeFile(filePath, save = false) {
  try {
    let editor;
    let pane;

    if (filePath) {
      const editors = atom.workspace.getTextEditors();
      editor = editors.find((e) => e.getPath() === filePath);
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
  } catch (error) {
    console.error("[claude-chat] Failed to close file:", error);
    return false;
  }
}

/**
 * Split the current pane in a specified direction
 */
async function splitPane(direction, filePath) {
  try {
    const pane = atom.workspace.getActivePane();
    let newPane;

    switch (direction) {
      case "left":
        newPane = pane.splitLeft();
        break;
      case "right":
        newPane = pane.splitRight();
        break;
      case "up":
        newPane = pane.splitUp();
        break;
      case "down":
        newPane = pane.splitDown();
        break;
      default:
        return false;
    }

    if (filePath) {
      await atom.workspace.open(filePath, { pane: newPane });
    }

    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to split pane:", error);
    return false;
  }
}

/**
 * Close the active pane
 */
async function closePane(saveAll = false) {
  try {
    const pane = atom.workspace.getActivePane();
    if (!pane) return false;

    if (saveAll) {
      const items = pane.getItems();
      for (const item of items) {
        if (item.isModified && item.isModified() && item.save) {
          await item.save();
        }
      }
    }

    pane.destroy();
    return true;
  } catch (error) {
    console.error("[claude-chat] Failed to close pane:", error);
    return false;
  }
}

/**
 * Get the visibility state of all docks
 */
function getPanelState() {
  return {
    left: {
      visible: atom.workspace.getLeftDock().isVisible(),
      items: atom.workspace.getLeftDock().getPaneItems().length,
    },
    right: {
      visible: atom.workspace.getRightDock().isVisible(),
      items: atom.workspace.getRightDock().getPaneItems().length,
    },
    bottom: {
      visible: atom.workspace.getBottomDock().isVisible(),
      items: atom.workspace.getBottomDock().getPaneItems().length,
    },
    panes: {
      count: atom.workspace.getPanes().length,
      activeIndex: atom.workspace.getPanes().indexOf(atom.workspace.getActivePane()),
    },
  };
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Execute a tool call using direct atom access
 */
async function executeTool(toolName, args) {
  try {
    switch (toolName) {
      case "GetActiveEditor": {
        const editor = getActiveEditor();
        return { success: true, data: editor };
      }

      case "GetSelection": {
        const selection = getSelection();
        return { success: true, data: selection };
      }

      case "InsertText": {
        if (typeof args.text !== "string") {
          return { success: false, error: "text is required" };
        }
        const result = insertText(args.text);
        return { success: result, data: { inserted: result } };
      }

      case "ReplaceSelection": {
        if (typeof args.text !== "string") {
          return { success: false, error: "text is required" };
        }
        const result = replaceSelection(args.text);
        return { success: result, data: { replaced: result } };
      }

      case "OpenFile": {
        if (typeof args.path !== "string") {
          return { success: false, error: "path is required" };
        }
        const result = await openFile(args.path, args.line, args.column);
        return { success: result, data: { opened: result } };
      }

      case "GoToPosition": {
        if (typeof args.line !== "number") {
          return { success: false, error: "line is required" };
        }
        const result = goToPosition(args.line, args.column);
        return { success: result, data: { navigated: result } };
      }

      case "GetOpenEditors": {
        const editors = getOpenEditors();
        return { success: true, data: editors };
      }

      case "GetProjectPaths": {
        const paths = getProjectPaths();
        return { success: true, data: paths };
      }

      case "SaveFile": {
        const result = await saveFile(args.path);
        return { success: result, data: { saved: result } };
      }

      case "SetSelections": {
        if (!Array.isArray(args.ranges) || args.ranges.length === 0) {
          return { success: false, error: "ranges array is required" };
        }
        const result = setSelections(args.ranges);
        return { success: result, data: { selectionsSet: result, count: args.ranges.length } };
      }

      case "GetAllSelections": {
        const selections = getAllSelections();
        return { success: true, data: selections };
      }

      case "RevealInTreeView": {
        if (typeof args.path !== "string") {
          return { success: false, error: "path is required" };
        }
        const result = await revealInTreeView(args.path);
        return { success: result, data: { revealed: result } };
      }

      case "CloseFile": {
        const result = await closeFile(args.path, args.save);
        return { success: result, data: { closed: result } };
      }

      case "SplitPane": {
        if (!["left", "right", "up", "down"].includes(args.direction)) {
          return { success: false, error: "direction must be one of: left, right, up, down" };
        }
        const result = await splitPane(args.direction, args.path);
        return { success: result, data: { split: result, direction: args.direction } };
      }

      case "ClosePane": {
        const result = await closePane(args.saveAll);
        return { success: result, data: { closed: result } };
      }

      case "GetPanelState": {
        const state = getPanelState();
        return { success: true, data: state };
      }

      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
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

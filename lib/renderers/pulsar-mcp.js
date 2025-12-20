/** @babel */
/** @jsx etch.dom */

import etch from "etch";
import {
  createToolRenderer,
  createSimpleToolRenderer,
  renderPreContent,
} from "./tool-base";
import { parseJsonResult, truncateWithCount } from "../utils/result-parsers";

/**
 * MCP Tool renderers for Pulsar integration
 * Handles tools prefixed with mcp__pulsar__
 */

// Alias for cleaner usage
const parseMcpResult = parseJsonResult;

// ============================================================================
// Tool Renderers
// ============================================================================

export const renderMcpGetActiveEditor = createToolRenderer({
  name: "GetActiveEditor",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: data?.path,
      resultInfo: data?.grammar,
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.content?.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!data?.content) return null;
    return (
      <div className="tool-mcp-content">
        <div className="mcp-info-row">
          <span className="mcp-label">Cursor:</span>
          <span className="mcp-value">
            Line {(data.cursorPosition?.row || 0) + 1}, Col {(data.cursorPosition?.column || 0) + 1}
          </span>
          {data.modified ? <span className="mcp-badge mcp-modified">modified</span> : null}
        </div>
        <pre className="tool-content">{truncateWithCount(data.content, 2000)}</pre>
      </div>
    );
  },
});

export const renderMcpInsertText = createToolRenderer({
  name: "InsertText",
  className: "mcp-pulsar",
  getInfo: (input) => ({
    resultInfo: input?.text ? `${input.text.length} chars` : null,
  }),
  hasExpandable: (input) => input?.text?.length > 40,
  renderContent: (msg) => renderPreContent(msg.input?.text, 500),
});

export const renderMcpOpenFile = createToolRenderer({
  name: "OpenFile",
  className: "mcp-pulsar",
  getInfo: (input) => ({
    path: input?.path,
    pathInfo: input?.row != null ? `line ${input.row + 1}${input.column != null ? `:${input.column + 1}` : ""}` : null,
  }),
  hasExpandable: () => false,
});

export const renderMcpGetProjectPaths = createToolRenderer({
  name: "GetProjectPaths",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = Array.isArray(data) ? data.length : 0;
    return { count, countLabel: "projects" };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return Array.isArray(data) && data.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!Array.isArray(data)) return null;
    return (
      <div className="search-results">
        {data.map((path, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-path"
              href="#"
              title={path}
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.openFile(path);
                },
              }}
            >
              {path}
            </a>
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpSaveFile = createToolRenderer({
  name: "SaveFile",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: input?.path,
      resultInfo: data?.saved ? "saved" : "failed",
    };
  },
  hasExpandable: () => false,
});

export const renderMcpSetSelections = createToolRenderer({
  name: "SetSelections",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = input?.ranges?.length || 0;
    return {
      count,
      countLabel: count === 1 ? "selection" : "selections",
      resultInfo: data?.selectionsSet ? null : "failed",
    };
  },
  hasExpandable: (input) => input?.ranges?.length > 0,
  renderContent: (msg) => {
    const ranges = msg.input?.ranges || [];
    return (
      <div className="tool-mcp-list">
        {ranges.map((r, i) => (
          <div className="mcp-list-item" key={i}>
            <span className="mcp-value">
              [{r.startRow + 1}:{r.startColumn + 1}] → [{r.endRow + 1}:{r.endColumn + 1}]
            </span>
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpGetSelections = createToolRenderer({
  name: "GetSelections",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    const count = Array.isArray(data) ? data.length : 0;
    return { count, countLabel: count === 1 ? "selection" : "selections" };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return Array.isArray(data) && data.length > 0;
  },
  renderContent: (msg) => {
    const data = parseMcpResult(msg.result);
    if (!Array.isArray(data)) return null;
    return (
      <div className="tool-mcp-list">
        {data.map((sel, i) => (
          <div className={`mcp-list-item ${sel.isEmpty ? "mcp-empty" : ""}`} key={i}>
            <span className="mcp-value">
              [{sel.range?.start?.row + 1}:{sel.range?.start?.column + 1}] → [{sel.range?.end?.row + 1}:{sel.range?.end?.column + 1}]
            </span>
            {sel.isEmpty ? (
              <span className="mcp-badge">cursor</span>
            ) : (
              <span className="mcp-selection-text">{sel.text?.slice(0, 30)}{sel.text?.length > 30 ? "..." : ""}</span>
            )}
          </div>
        ))}
      </div>
    );
  },
});

export const renderMcpCloseFile = createToolRenderer({
  name: "CloseFile",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      path: input?.path,
      resultInfo: data?.closed ? "closed" : "failed",
    };
  },
  hasExpandable: () => false,
});

export const renderMcpFindText = createToolRenderer({
  name: "FindText",
  className: "mcp-pulsar",
  getInfo: (input, result) => {
    const data = parseMcpResult(result);
    return {
      count: data?.count || 0,
      countLabel: "matches",
      code: input?.pattern?.slice(0, 30),
    };
  },
  hasExpandable: (input, result) => {
    const data = parseMcpResult(result);
    return data?.matches?.length > 0;
  },
  renderContent: (msg, handlers) => {
    const data = parseMcpResult(msg.result);
    if (!data?.matches) return null;
    return (
      <div className="search-results">
        {data.matches.slice(0, 20).map((m, i) => (
          <div className="search-entry" key={i}>
            <a
              className="search-line-link"
              href="#"
              on={{
                click: (e) => {
                  e.preventDefault();
                  handlers.goToLine(m.range.start.row, m.range.start.column);
                },
              }}
            >
              {m.range.start.row + 1}:{m.range.start.column + 1}
            </a>
            <span className="search-content">{m.text}</span>
          </div>
        ))}
        {data.matches.length > 20 ? (
          <div className="search-more">... {data.matches.length - 20} more</div>
        ) : null}
      </div>
    );
  },
});

export const renderMcpAddProjectPath = createSimpleToolRenderer("AddProjectPath", (input) => ({
  path: input?.path,
}), "mcp-pulsar");

// ============================================================================
// Registry
// ============================================================================

export const MCP_TOOL_RENDERERS = {
  // P0 - Must Have
  "mcp__pulsar__GetActiveEditor": renderMcpGetActiveEditor,
  "mcp__pulsar__InsertText": renderMcpInsertText,
  // P1 - Important
  "mcp__pulsar__OpenFile": renderMcpOpenFile,
  "mcp__pulsar__GetProjectPaths": renderMcpGetProjectPaths,
  "mcp__pulsar__SaveFile": renderMcpSaveFile,
  // P2 - Editor Enhancement
  "mcp__pulsar__SetSelections": renderMcpSetSelections,
  "mcp__pulsar__GetSelections": renderMcpGetSelections,
  "mcp__pulsar__CloseFile": renderMcpCloseFile,
  // P3 - Text Operations
  "mcp__pulsar__FindText": renderMcpFindText,
  // P4 - Project Management
  "mcp__pulsar__AddProjectPath": renderMcpAddProjectPath,
};

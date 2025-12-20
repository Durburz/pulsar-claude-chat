/**
 * Tool definitions for Pulsar MCP server
 * Tool names use PascalCase (displayed as mcp__pulsar__ToolName)
 */

const tools = [
  // P0 - Must Have
  {
    name: "GetActiveEditor",
    description:
      "Get the active editor state. Returns {path: string|null, content: string, cursorPosition: {row, column} (0-indexed), grammar: string, modified: boolean}, or null if no editor is open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "InsertText",
    description:
      "Insert text at cursor or replace selection. If text is selected, replaces it; otherwise inserts at cursor. Works with multi-cursor. Returns true on success, false if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text to insert (replaces selection if any)",
        },
      },
      required: ["text"],
    },
  },

  // P1 - Important
  {
    name: "OpenFile",
    description:
      "Open a file in editor. All positions are 0-indexed. Returns true on success. Creates new file if path doesn't exist.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path (absolute or relative to project root)",
        },
        row: {
          type: "number",
          description: "Row to navigate to (0-indexed, optional)",
        },
        column: {
          type: "number",
          description: "Column to navigate to (0-indexed, optional)",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "GetProjectPaths",
    description: "Get project root folders. Returns string[] of absolute paths. Empty array if no project open.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "SaveFile",
    description:
      "Save a file. Returns true on success, false if file not found or no editor. If path omitted, saves active editor.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to save (optional, defaults to active editor)",
        },
      },
      required: [],
    },
  },

  // P2 - Editor Enhancement
  {
    name: "SetSelections",
    description:
      "Set multi-cursor selections. All positions are 0-indexed. Example: [{startRow:0, startColumn:0, endRow:0, endColumn:5}] selects first 5 chars of line 1. Returns false if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        ranges: {
          type: "array",
          description: "Array of selection ranges",
          items: {
            type: "object",
            properties: {
              startRow: { type: "number", description: "Start line (0-indexed)" },
              startColumn: { type: "number", description: "Start column (0-indexed)" },
              endRow: { type: "number", description: "End line (0-indexed)" },
              endColumn: { type: "number", description: "End column (0-indexed)" },
            },
            required: ["startRow", "startColumn", "endRow", "endColumn"],
          },
        },
      },
      required: ["ranges"],
    },
  },
  {
    name: "GetSelections",
    description:
      "Get all selections/cursors. Returns array of {text: string, isEmpty: boolean, range: {start: {row, column}, end: {row, column}}} (0-indexed). First element is primary selection. Returns null if no editor.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "CloseFile",
    description:
      "Close an editor tab. Returns true on success, false if file not found. If path omitted, closes active editor. Unsaved changes are discarded unless save=true.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "File path to close (optional, defaults to active editor)",
        },
        save: {
          type: "boolean",
          description: "Save before closing if modified (default: false)",
        },
      },
      required: [],
    },
  },

  // P3 - Text Operations
  {
    name: "FindText",
    description:
      "Find all matches in active editor. Returns {matches: [{text, range: {start: {row, column}, end: {row, column}}}], count}. All positions 0-indexed. Uses JavaScript regex. Returns null if no editor.",
    inputSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Search text or JavaScript regex pattern",
        },
        isRegex: {
          type: "boolean",
          description: "Treat pattern as regex (default: false)",
        },
        caseSensitive: {
          type: "boolean",
          description: "Case sensitive search (default: true)",
        },
      },
      required: ["pattern"],
    },
  },

  // P4 - Project Management
  {
    name: "AddProjectPath",
    description: "Add a folder to project roots without removing existing paths. Returns true on success, false if path invalid.",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Absolute folder path to add",
        },
      },
      required: ["path"],
    },
  },
];

/**
 * Get tool definition by name
 */
function getToolByName(name) {
  return tools.find((t) => t.name === name);
}

module.exports = { tools, getToolByName };

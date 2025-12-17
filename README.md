# claude-chat

Interactive chat panel for [Claude Code](https://github.com/anthropics/claude-code).

- Streaming responses with real-time text display.
- Markdown rendering with syntax highlighting.
- Timeline-based message display showing conversation flow.
- Session persistence - conversations are saved and can be resumed.
- Chat history browser to revisit previous sessions.
- Context extender methods.
- Extended thinking toggle.
- Permission modes switch.
- Built-in MCP server for AI-powered editor control.

## Installation

To install `claude-chat` search for [claude-chat](https://web.pulsar-edit.dev/packages/claude-chat) in the Install pane of the Pulsar settings or run `ppm install claude-chat`. Alternatively, you can run `ppm install asiloisad/pulsar-claude-chat` to install a package directly from the GitHub repository.

## Service API

The package provides a `claude-chat` service that other packages can consume:

```javascript
// In your package.json:
"consumedServices": {
  "claude-chat": {
    "versions": { "^1.0.0": "consumeClaudeChat" }
  }
}

// In your package:
consumeClaudeChat(service) {
  this.claudeChat = service;
}
```

### Methods

#### `sendPrompt(text, options)`

Send a prompt to Claude programmatically.

```javascript
// Simple prompt
await service.sendPrompt("Explain this code");

// With attach context (supports multi-cursor selections)
await service.sendPrompt("Review this selection", {
  attachContext: {
    type: "selections",
    path: "src/app.js",
    line: 42,
    selections: [
      { text: "const foo = bar()", range: { start: { row: 41, column: 0 }, end: { row: 41, column: 18 } } }
    ],
    label: "src/app.js:42",
    icon: "code"
  }
});

// Without focusing the panel
await service.sendPrompt("Run tests", { focus: false });
```

**Options:**
- `attachContext` - Context to attach (selection, paths, position, image)
- `focus` - Whether to focus the panel after sending (default: `true`)

**Returns:** `Promise<boolean>` - Whether the message was sent successfully.

#### `setAttachContext(context)`

Set the attach context without sending a message.

```javascript
service.setAttachContext({
  type: "paths",
  paths: ["relative/path/to/file.js"],
  label: "file.js",
  icon: "file"
});
```

**Context types:**
- `paths` - File or directory paths
- `selections` - Selections/cursors with `path`, `line`, `selections` array (empty text = cursor position)
- `image` - Image file with optional region selection

#### `clearAttachContext()`

Clear the current attach context.

#### `hasPanel()`

Check if the chat panel exists. Returns `boolean`.

#### `onDidReceiveMessage(callback)`

Subscribe to receive messages from Claude.

```javascript
const disposable = service.onDidReceiveMessage((message) => {
  console.log("Claude responded:", message.content);
  if (message.thinking) {
    console.log("Thinking:", message.thinking);
  }
});

// Later, to unsubscribe:
disposable.dispose();
```

**Message object:**
- `role` - Always `"assistant"`
- `content` - The response text
- `thinking` - Extended thinking content (if enabled)

## MCP Server

The package includes a built-in MCP (Model Context Protocol) server that allows AI assistants to programmatically control the Pulsar editor. The server can be enabled/disabled in package settings (`pulsarMCP`, enabled by default) and implements the [MCP specification](https://modelcontextprotocol.io).

### Configuration

For MCP clients (Claude Desktop, Claude Code, etc.), add this to your MCP configuration:

```json
{
  "mcpServers": {
    "pulsar": {
      "url": "http://localhost:3000/mcp",
      "type": "streamable"
    }
  }
}
```

### Port Handling

The base port can be configured in package settings (`mcpBridgePort`). Default is `3000`.

**Automatic port discovery:** If the base port is in use (by another Pulsar window or external application), the server automatically finds the next available port (3001, 3002, etc.).

External MCP clients configured with port `3000` will only control the window currently using that port. For the built-in claude-chat panel, this is handled automatically since it communicates with its own window's server.

### Available Tools

| Tool | Description |
|------|-------------|
| **GetActiveEditor** | Get content, file path, cursor position, and grammar of the active editor |
| **GetSelection** | Get currently selected text and its range |
| **InsertText** | Insert text at the current cursor position |
| **ReplaceSelection** | Replace selected text with new text |
| **OpenFile** | Open a file, optionally navigate to a specific line and column |
| **GoToPosition** | Navigate to a specific line and column |
| **GetOpenEditors** | List all open editor tabs with their status |
| **GetProjectPaths** | Get project root folder paths |
| **SaveFile** | Save the current or a specific file |
| **SetSelections** | Set one or more selections (multi-cursor support) |
| **GetAllSelections** | Get all current selections |
| **RevealInTreeView** | Reveal a file in the tree view panel |
| **CloseFile** | Close an editor tab |
| **SplitPane** | Split the current pane in a direction |
| **ClosePane** | Close the active pane |
| **GetPanelState** | Get visibility state of all docks |
| **Undo** | Undo the last change |
| **Redo** | Redo the last undone change |
| **FindText** | Find all occurrences of a pattern (supports regex) |
| **GetContextAround** | Get lines of context around a match |
| **DeleteLine** | Delete a single line |
| **DeleteLineRange** | Delete a range of lines |
| **GetLineCount** | Get total number of lines |

### REST API (for debugging)

In addition to the MCP protocol, the bridge exposes a simple REST API for debugging and direct integration:

- `GET /health` - Health check
- `GET /tools` - List available tools
- `POST /tools/:ToolName` - Execute a tool

Example:
```bash
# Get active editor content
curl -X POST http://localhost:3000/tools/GetActiveEditor

# Find text in editor
curl -X POST http://localhost:3000/tools/FindText \
  -H "Content-Type: application/json" \
  -d '{"pattern": "function", "isRegex": false}'

# Open a file at specific line
curl -X POST http://localhost:3000/tools/OpenFile \
  -H "Content-Type: application/json" \
  -d '{"path": "src/main.js", "line": 42}'
```

# Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub — any feedback’s welcome!

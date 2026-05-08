# Public Circle MCP Server

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that exposes the Public Circle project to LLMs, enabling AI assistants to read files, search code, and execute safe commands.

## Features

### Resources

- **`file://{path}`** - Read-only access to any file in the project
- **`search://{pattern}`** - Text search across the codebase using ripgrep

### Tools

| Tool | Description |
|------|-------------|
| `shell_command` | Execute allowlisted commands (`rg`, `ls`, `cat`, `sed`, `awk`, `grep`, `find`, `head`, `tail`, `wc`) |
| `search_code` | Search for patterns with optional glob filtering |
| `read_file` | Read file contents |
| `list_directory` | List directory contents |

### Security

- **Path restriction**: All file access is restricted to the repository root
- **Command allowlist**: Only safe, read-only commands are permitted
- **No network access**: Server cannot make external network requests
- **Argument sanitization**: Shell metacharacters and path traversal attempts are blocked
- **Logging**: All tool calls are logged to `mcp-server.log`

## Installation

```bash
cd mcp-server
npm install
npm run build
```

## Running the Server

### Direct execution

```bash
npm run mcp
# or
node dist/index.js
```

### Development mode (with auto-reload)

```bash
npm run dev
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCP_REPO_ROOT` | Path to the repository root | Parent directory of mcp-server |
| `MCP_LOG_FILE` | Path to the log file | `mcp-server/mcp-server.log` |

## Registering with Claude Code

Add the following to your Claude Code configuration (`~/.claude/claude_desktop_config.json` or similar):

```json
{
  "mcpServers": {
    "public-circle": {
      "command": "node",
      "args": ["/Users/waqasraza/Documents/Wander/public-circle/mcp-server/dist/index.js"],
      "env": {
        "MCP_REPO_ROOT": "/Users/waqasraza/Documents/Wander/public-circle"
      }
    }
  }
}
```

### For VSCode Claude Extension

Add to your VSCode settings (`.vscode/settings.json`):

```json
{
  "claude.mcpServers": {
    "public-circle": {
      "command": "node",
      "args": ["${workspaceFolder}/mcp-server/dist/index.js"],
      "env": {
        "MCP_REPO_ROOT": "${workspaceFolder}"
      }
    }
  }
}
```

### For Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "public-circle": {
      "command": "node",
      "args": ["/Users/waqasraza/Documents/Wander/public-circle/mcp-server/dist/index.js"],
      "env": {
        "MCP_REPO_ROOT": "/Users/waqasraza/Documents/Wander/public-circle"
      }
    }
  }
}
```

## Verification / Testing

Run the test client to verify the server is working:

```bash
npm run test
```

### Manual Testing with MCP Inspector

You can also use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) for interactive testing:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Example Usage

### List Resources (via MCP client)

```typescript
const resources = await client.listResources();
// Returns: { resources: [{ uri: "file://package.json", name: "package.json", ... }, ...] }
```

### Read a File

```typescript
const content = await client.readResource({ uri: "file://src/App.tsx" });
// Returns the contents of App.tsx
```

### Search Code

```typescript
const results = await client.callTool({
  name: "search_code",
  arguments: {
    pattern: "useState",
    glob: "*.tsx"
  }
});
// Returns matching lines with file paths and line numbers
```

### Execute Shell Command

```typescript
const result = await client.callTool({
  name: "shell_command",
  arguments: {
    command: "rg",
    args: ["--type", "ts", "interface"]
  }
});
// Returns ripgrep output
```

## Excluded Paths

The following paths are automatically excluded from listings and searches:

- `node_modules/`
- `.git/`
- `dist/`
- `.next/`
- `.cache/`
- `coverage/`
- `.env` files
- `*.log` files

## Troubleshooting

### Server won't start

1. Ensure you've built the TypeScript: `npm run build`
2. Check that `MCP_REPO_ROOT` points to a valid directory
3. Check the log file for errors: `cat mcp-server.log`

### Permission denied errors

The server only allows access to files within the repository root. Ensure your requested paths are relative to the project.

### Command not found

Only allowlisted commands can be executed. The full list is:
`rg`, `ls`, `cat`, `sed`, `awk`, `grep`, `find`, `head`, `tail`, `wc`

## Development

### Project Structure

```
mcp-server/
├── src/
│   ├── index.ts        # Main MCP server implementation
│   └── test-client.ts  # Test client for verification
├── dist/               # Compiled JavaScript output
├── mcp.json           # MCP server manifest
├── package.json       # Dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── README.md          # This file
```

### Adding New Tools

To add a new tool, update the `ListToolsRequestSchema` handler in `src/index.ts` and add a case to the `CallToolRequestSchema` handler.

### Modifying Security Rules

- **Allowed commands**: Update the `ALLOWED_COMMANDS` array
- **Excluded paths**: Update the `EXCLUDED_PATTERNS` array
- **Dangerous patterns**: Update the `dangerousPatterns` array in the `shell_command` handler

## License

ISC

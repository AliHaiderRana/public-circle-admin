# MCP Server Verification Examples

This document provides examples to verify the MCP server is working correctly.

## Quick Start

```bash
# 1. Install dependencies
cd mcp-server
npm install

# 2. Build the server
npm run build

# 3. Run the test client
npm run test
```

## Manual Verification with MCP Inspector

The MCP Inspector is an interactive tool for testing MCP servers:

```bash
# Install and run the inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

This will open a web interface where you can:
- List all resources
- Read specific files
- Execute tools
- View logs

## Example MCP Client Calls

### 1. List Available Resources

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({ name: "my-client", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);

// List all project files
const resources = await client.listResources();
console.log(resources);

// Output:
// {
//   resources: [
//     { uri: "file://package.json", name: "package.json", ... },
//     { uri: "file://src/App.tsx", name: "src/App.tsx", ... },
//     ...
//   ]
// }
```

### 2. Read a Project File

```typescript
// Read package.json
const content = await client.readResource({ uri: "file://package.json" });
console.log(content.contents[0].text);

// Output: Contents of package.json
```

### 3. Search Code with search:// Resource

```typescript
// Search for "useState" across the codebase
const searchResults = await client.readResource({
  uri: "search://useState"
});
console.log(searchResults.contents[0].text);

// Output:
// src/components/example.tsx:5:  const [state, setState] = useState(null);
// src/pages/home.tsx:12:  const [loading, setLoading] = useState(true);
// ...
```

### 4. Search Code with Tool (with glob filter)

```typescript
// Search for "interface" in TypeScript files only
const result = await client.callTool({
  name: "search_code",
  arguments: {
    pattern: "interface",
    glob: "*.ts"
  }
});
console.log(result.content[0].text);
```

### 5. List Directory Contents

```typescript
// List files in src directory
const dirResult = await client.callTool({
  name: "list_directory",
  arguments: {
    path: "src"
  }
});
console.log(JSON.parse(dirResult.content[0].text));

// Output:
// [
//   { name: "App.tsx", type: "file" },
//   { name: "components", type: "directory" },
//   { name: "pages", type: "directory" },
//   ...
// ]
```

### 6. Execute Shell Command

```typescript
// Run ripgrep to find all React components
const rgResult = await client.callTool({
  name: "shell_command",
  arguments: {
    command: "rg",
    args: ["--type", "tsx", "export (default )?function"]
  }
});
console.log(rgResult.content[0].text);
```

## Security Verification

### Test 1: Path Traversal Prevention

```typescript
// This should fail - trying to access outside repo
try {
  await client.readResource({ uri: "file://../../../etc/passwd" });
  console.log("FAIL: Should have been blocked");
} catch (e) {
  console.log("PASS: Access denied as expected");
}
```

### Test 2: Command Allowlist

```typescript
// This should fail - rm is not in allowlist
const result = await client.callTool({
  name: "shell_command",
  arguments: {
    command: "rm",
    args: ["-rf", "/"]
  }
});

if (result.isError) {
  console.log("PASS: Dangerous command blocked");
}
```

### Test 3: Argument Sanitization

```typescript
// This should fail - shell injection attempt
const result = await client.callTool({
  name: "shell_command",
  arguments: {
    command: "ls",
    args: ["; rm -rf /"]
  }
});

if (result.isError) {
  console.log("PASS: Shell injection blocked");
}
```

## Checking Logs

All tool calls are logged to `mcp-server/mcp-server.log`:

```bash
# View recent log entries
tail -f mcp-server/mcp-server.log
```

Log format:
```json
{"timestamp":"2024-01-15T10:30:00.000Z","level":"INFO","message":"Tool call","tool":"search_code","args":{"pattern":"useState"}}
```

## Integration with Claude Desktop

After configuring in `~/.claude/claude_desktop_config.json`:

1. Restart Claude Desktop
2. Open a new conversation
3. The MCP server should be available
4. Try asking Claude to:
   - "List the files in the src directory"
   - "Search for useState in the codebase"
   - "Read the package.json file"
   - "Find all React components in the project"

Claude will automatically use the MCP server to access your project files.

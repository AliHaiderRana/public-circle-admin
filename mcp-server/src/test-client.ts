#!/usr/bin/env node

/**
 * Test client for Public Circle MCP Server
 *
 * This script demonstrates how to interact with the MCP server
 * and can be used to verify the server is working correctly.
 *
 * Usage:
 *   npm run test
 *   or
 *   npx tsx src/test-client.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");

// Type for tool call result content
interface TextContent {
  type: "text";
  text: string;
}

async function runTests() {
  console.log("=== Public Circle MCP Server Test Client ===\n");

  // Start the MCP server as a subprocess
  console.log("Starting MCP server...\n");

  const serverProcess = spawn("node", [path.join(__dirname, "../dist/index.js")], {
    env: {
      ...process.env,
      MCP_REPO_ROOT: REPO_ROOT,
    },
    stdio: ["pipe", "pipe", "inherit"],
  });

  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(__dirname, "../dist/index.js")],
    env: {
      ...process.env,
      MCP_REPO_ROOT: REPO_ROOT,
    },
  });

  const client = new Client(
    {
      name: "test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    await client.connect(transport);
    console.log("Connected to MCP server\n");

    // Test 1: List resources
    console.log("--- Test 1: List Resources ---");
    const resources = await client.listResources();
    console.log(`Found ${resources.resources.length} resources`);
    console.log("First 5 resources:");
    resources.resources.slice(0, 5).forEach((r) => {
      console.log(`  - ${r.uri}`);
    });
    console.log();

    // Test 2: List tools
    console.log("--- Test 2: List Tools ---");
    const tools = await client.listTools();
    console.log(`Found ${tools.tools.length} tools:`);
    tools.tools.forEach((t) => {
      console.log(`  - ${t.name}: ${t.description?.slice(0, 60)}...`);
    });
    console.log();

    // Test 3: Read a specific file
    console.log("--- Test 3: Read Resource (package.json) ---");
    try {
      const fileContent = await client.readResource({ uri: "file://package.json" });
      const text = fileContent.contents[0];
      if ("text" in text) {
        console.log(`Read package.json (${text.text.length} characters)`);
        const pkg = JSON.parse(text.text);
        console.log(`  Project name: ${pkg.name}`);
        console.log(`  Dependencies: ${Object.keys(pkg.dependencies || {}).length}`);
      }
    } catch (error) {
      console.log(`Error reading file: ${error}`);
    }
    console.log();

    // Test 4: Search for a pattern
    console.log("--- Test 4: Search Code ---");
    try {
      const searchResult = await client.callTool({
        name: "search_code",
        arguments: {
          pattern: "useState",
          glob: "*.tsx",
        },
      });
      const contentArray = searchResult.content as TextContent[];
      const content = contentArray[0];
      if (content && "text" in content) {
        const lines = content.text.split("\n").filter(Boolean);
        console.log(`Found ${lines.length} matches for 'useState' in .tsx files`);
        console.log("First 3 matches:");
        lines.slice(0, 3).forEach((line: string) => {
          // Truncate long lines
          const truncated = line.length > 80 ? line.slice(0, 80) + "..." : line;
          console.log(`  ${truncated}`);
        });
      }
    } catch (error) {
      console.log(`Error searching: ${error}`);
    }
    console.log();

    // Test 5: List directory
    console.log("--- Test 5: List Directory (src) ---");
    try {
      const dirResult = await client.callTool({
        name: "list_directory",
        arguments: {
          path: "src",
        },
      });
      const dirContentArray = dirResult.content as TextContent[];
      const dirContent = dirContentArray[0];
      if (dirContent && "text" in dirContent) {
        const entries = JSON.parse(dirContent.text);
        console.log(`Found ${entries.length} entries in src/:`);
        entries.slice(0, 10).forEach((entry: { name: string; type: string }) => {
          console.log(`  ${entry.type === "directory" ? "[DIR]" : "[FILE]"} ${entry.name}`);
        });
      }
    } catch (error) {
      console.log(`Error listing directory: ${error}`);
    }
    console.log();

    // Test 6: Shell command (ls)
    console.log("--- Test 6: Shell Command (ls -la) ---");
    try {
      const lsResult = await client.callTool({
        name: "shell_command",
        arguments: {
          command: "ls",
          args: ["-la"],
        },
      });
      const lsContentArray = lsResult.content as TextContent[];
      const lsContent = lsContentArray[0];
      if (lsContent && "text" in lsContent) {
        const lines = lsContent.text.split("\n");
        console.log(`Command output (${lines.length} lines):`);
        lines.slice(0, 8).forEach((line: string) => {
          console.log(`  ${line}`);
        });
        if (lines.length > 8) {
          console.log(`  ... (${lines.length - 8} more lines)`);
        }
      }
    } catch (error) {
      console.log(`Error executing command: ${error}`);
    }
    console.log();

    // Test 7: Security - try to access outside repo (should fail)
    console.log("--- Test 7: Security Test (access outside repo) ---");
    try {
      await client.readResource({ uri: "file://../../../etc/passwd" });
      console.log("ERROR: Should have blocked access to /etc/passwd!");
    } catch (error) {
      console.log("PASS: Access correctly denied to path outside repo");
    }
    console.log();

    // Test 8: Security - try disallowed command (should fail)
    console.log("--- Test 8: Security Test (disallowed command) ---");
    try {
      await client.callTool({
        name: "shell_command",
        arguments: {
          command: "rm",
          args: ["-rf", "/"],
        },
      });
      console.log("ERROR: Should have blocked rm command!");
    } catch (error) {
      console.log("PASS: Disallowed command correctly rejected");
    }
    console.log();

    console.log("=== All tests completed ===");

    await client.close();
  } catch (error) {
    console.error("Test error:", error);
  } finally {
    serverProcess.kill();
    process.exit(0);
  }
}

runTests();

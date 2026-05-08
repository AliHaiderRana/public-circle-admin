#!/usr/bin/env node

/**
 * Public Circle MCP Server
 *
 * Exposes project resources to LLMs via Model Context Protocol (MCP).
 *
 * Resources:
 * - file:// - Read-only access to project files
 * - search:// - Text search across the repository
 *
 * Tools:
 * - shell_command - Execute allowlisted commands (rg, ls, cat, sed, awk)
 *
 * Security:
 * - All paths are restricted to the repository root
 * - Only allowlisted commands can be executed
 * - All tool calls are logged
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { spawn } from "child_process";
import { existsSync, createWriteStream } from "fs";

// Configuration
const REPO_ROOT = process.env.MCP_REPO_ROOT || path.resolve(process.cwd(), "..");
const LOG_FILE = process.env.MCP_LOG_FILE || path.join(REPO_ROOT, "mcp-server", "mcp-server.log");

// Allowlisted commands for shell_command tool
const ALLOWED_COMMANDS = ["rg", "ls", "cat", "sed", "awk", "grep", "find", "head", "tail", "wc"];

// File patterns to exclude from listing/searching
const EXCLUDED_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  ".next",
  ".cache",
  "coverage",
  ".env",
  ".env.*",
  "*.log",
];

// Logger
class Logger {
  private logStream: ReturnType<typeof createWriteStream> | null = null;

  constructor() {
    try {
      this.logStream = createWriteStream(LOG_FILE, { flags: "a" });
    } catch {
      // If we can't create log file, log to stderr
      console.error(`[MCP] Could not create log file at ${LOG_FILE}`);
    }
  }

  log(level: "INFO" | "WARN" | "ERROR", message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const logEntry = JSON.stringify({
      timestamp,
      level,
      message,
      ...meta,
    });

    if (this.logStream) {
      this.logStream.write(logEntry + "\n");
    }

    // Also output to stderr for debugging
    console.error(`[${timestamp}] [${level}] ${message}`);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log("INFO", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log("WARN", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>) {
    this.log("ERROR", message, meta);
  }
}

const logger = new Logger();

// Security utilities
function isPathSafe(requestedPath: string): boolean {
  const resolved = path.resolve(REPO_ROOT, requestedPath);
  return resolved.startsWith(REPO_ROOT) && !resolved.includes("..");
}

function sanitizePath(requestedPath: string): string {
  // Remove any leading slashes or file:// prefix
  let cleaned = requestedPath.replace(/^file:\/\//, "").replace(/^\/+/, "");

  // Resolve to absolute path within repo
  const resolved = path.resolve(REPO_ROOT, cleaned);

  if (!resolved.startsWith(REPO_ROOT)) {
    throw new Error(`Access denied: path outside repository root`);
  }

  return resolved;
}

function isExcluded(filePath: string): boolean {
  const relativePath = path.relative(REPO_ROOT, filePath);
  return EXCLUDED_PATTERNS.some((pattern) => {
    if (pattern.includes("*")) {
      const regex = new RegExp(pattern.replace(/\*/g, ".*"));
      return regex.test(relativePath);
    }
    return relativePath.includes(pattern);
  });
}

// Execute shell command safely
async function executeCommand(
  command: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: REPO_ROOT,
      timeout: 30000, // 30 second timeout
      env: {
        ...process.env,
        PATH: process.env.PATH,
      },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code ?? 0,
      });
    });

    proc.on("error", (err) => {
      reject(err);
    });
  });
}

// Get list of project files
async function getProjectFiles(dir: string = REPO_ROOT, relativeTo: string = REPO_ROOT): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(relativeTo, fullPath);

      if (isExcluded(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await getProjectFiles(fullPath, relativeTo);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  } catch (error) {
    logger.error(`Error reading directory: ${dir}`, { error: String(error) });
  }

  return files;
}

// Search files using ripgrep
async function searchFiles(pattern: string, glob?: string): Promise<string> {
  const args = [
    "--no-heading",
    "--line-number",
    "--color=never",
    "--max-count=100", // Limit results per file
  ];

  // Add glob pattern if specified
  if (glob) {
    args.push("--glob", glob);
  }

  // Exclude common patterns
  for (const excluded of EXCLUDED_PATTERNS) {
    args.push("--glob", `!${excluded}`);
  }

  args.push(pattern, REPO_ROOT);

  try {
    const result = await executeCommand("rg", args);
    return result.stdout || result.stderr || "No matches found";
  } catch (error) {
    // Try with grep as fallback
    try {
      const grepArgs = ["-r", "-n", "--include=*", pattern, REPO_ROOT];
      const result = await executeCommand("grep", grepArgs);
      return result.stdout || result.stderr || "No matches found";
    } catch {
      return `Search error: ${String(error)}`;
    }
  }
}

// Create MCP Server
const server = new Server(
  {
    name: "public-circle-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// List available resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => {
  return {
    resourceTemplates: [
      {
        uriTemplate: "file://{path}",
        name: "Project File",
        description: "Read a file from the project repository",
        mimeType: "text/plain",
      },
      {
        uriTemplate: "search://{pattern}",
        name: "Code Search",
        description: "Search for a pattern across the project using ripgrep",
        mimeType: "text/plain",
      },
    ],
  };
});

// List available resources (project files)
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.info("Listing resources");

  const files = await getProjectFiles();

  // Limit to first 100 files to avoid overwhelming the client
  const limitedFiles = files.slice(0, 100);

  return {
    resources: limitedFiles.map((file) => ({
      uri: `file://${file}`,
      name: file,
      description: `Project file: ${file}`,
      mimeType: getMimeType(file),
    })),
  };
});

// Read a resource
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  logger.info("Reading resource", { uri });

  // Handle file:// resources
  if (uri.startsWith("file://")) {
    const filePath = sanitizePath(uri);

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${uri}`);
    }

    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      // Return directory listing
      const entries = await fs.readdir(filePath, { withFileTypes: true });
      const listing = entries
        .filter((e) => !isExcluded(path.join(filePath, e.name)))
        .map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`)
        .join("\n");

      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: listing,
          },
        ],
      };
    }

    // Read file contents
    const content = await fs.readFile(filePath, "utf-8");

    return {
      contents: [
        {
          uri,
          mimeType: getMimeType(filePath),
          text: content,
        },
      ],
    };
  }

  // Handle search:// resources
  if (uri.startsWith("search://")) {
    const pattern = decodeURIComponent(uri.replace("search://", ""));
    const results = await searchFiles(pattern);

    return {
      contents: [
        {
          uri,
          mimeType: "text/plain",
          text: results,
        },
      ],
    };
  }

  throw new Error(`Unsupported resource URI: ${uri}`);
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "shell_command",
        description: `Execute an allowlisted shell command in the project directory. Allowed commands: ${ALLOWED_COMMANDS.join(", ")}. The working directory is locked to the repository root. No destructive or network commands are allowed.`,
        inputSchema: {
          type: "object" as const,
          properties: {
            command: {
              type: "string",
              description: `The command to execute. Must be one of: ${ALLOWED_COMMANDS.join(", ")}`,
            },
            args: {
              type: "array",
              items: { type: "string" },
              description: "Command arguments",
            },
          },
          required: ["command"],
        },
      },
      {
        name: "search_code",
        description: "Search for a pattern across the project codebase using ripgrep",
        inputSchema: {
          type: "object" as const,
          properties: {
            pattern: {
              type: "string",
              description: "The search pattern (regex supported)",
            },
            glob: {
              type: "string",
              description: "Optional glob pattern to filter files (e.g., '*.ts', 'src/**/*.tsx')",
            },
          },
          required: ["pattern"],
        },
      },
      {
        name: "read_file",
        description: "Read the contents of a file in the project",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Path to the file (relative to project root)",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "list_directory",
        description: "List contents of a directory in the project",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Path to the directory (relative to project root, empty for root)",
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  logger.info("Tool call", { tool: name, args });

  try {
    switch (name) {
      case "shell_command": {
        const command = args?.command as string;
        const cmdArgs = (args?.args as string[]) || [];

        // Validate command is in allowlist
        if (!ALLOWED_COMMANDS.includes(command)) {
          throw new Error(
            `Command '${command}' is not allowed. Allowed commands: ${ALLOWED_COMMANDS.join(", ")}`
          );
        }

        // Validate no dangerous arguments
        const dangerousPatterns = [
          /[;&|`$]/,  // Shell metacharacters
          /\.\./,     // Path traversal
          />>/,       // Append redirect
          />/,        // Output redirect
          /</,        // Input redirect
        ];

        for (const arg of cmdArgs) {
          for (const pattern of dangerousPatterns) {
            if (pattern.test(arg)) {
              throw new Error(`Dangerous argument detected: ${arg}`);
            }
          }

          // If arg looks like a path, validate it
          if (arg.includes("/") || arg.includes("\\")) {
            if (!isPathSafe(arg)) {
              throw new Error(`Path argument outside repository: ${arg}`);
            }
          }
        }

        const result = await executeCommand(command, cmdArgs);

        logger.info("Command executed", {
          command,
          args: cmdArgs,
          exitCode: result.exitCode,
        });

        return {
          content: [
            {
              type: "text",
              text: result.stdout || result.stderr || "(no output)",
            },
          ],
          isError: result.exitCode !== 0,
        };
      }

      case "search_code": {
        const pattern = args?.pattern as string;
        const glob = args?.glob as string | undefined;

        if (!pattern) {
          throw new Error("Pattern is required");
        }

        const results = await searchFiles(pattern, glob);

        return {
          content: [
            {
              type: "text",
              text: results,
            },
          ],
        };
      }

      case "read_file": {
        const filePath = args?.path as string;

        if (!filePath) {
          throw new Error("Path is required");
        }

        const absolutePath = sanitizePath(filePath);

        if (!existsSync(absolutePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        const stat = await fs.stat(absolutePath);

        if (stat.isDirectory()) {
          throw new Error(`Path is a directory, use list_directory instead: ${filePath}`);
        }

        const content = await fs.readFile(absolutePath, "utf-8");

        return {
          content: [
            {
              type: "text",
              text: content,
            },
          ],
        };
      }

      case "list_directory": {
        const dirPath = (args?.path as string) || "";
        const absolutePath = sanitizePath(dirPath);

        if (!existsSync(absolutePath)) {
          throw new Error(`Directory not found: ${dirPath || "."}`);
        }

        const stat = await fs.stat(absolutePath);

        if (!stat.isDirectory()) {
          throw new Error(`Path is not a directory: ${dirPath}`);
        }

        const entries = await fs.readdir(absolutePath, { withFileTypes: true });
        const listing = entries
          .filter((e) => !isExcluded(path.join(absolutePath, e.name)))
          .map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
          }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(listing, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error("Tool error", { tool: name, error: String(error) });

    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Utility function to determine MIME type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".ts": "text/typescript",
    ".tsx": "text/typescript",
    ".js": "application/javascript",
    ".jsx": "application/javascript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".css": "text/css",
    ".html": "text/html",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
    ".txt": "text/plain",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  };
  return mimeTypes[ext] || "text/plain";
}

// Main entry point
async function main() {
  logger.info("Starting MCP server", { repoRoot: REPO_ROOT });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info("MCP server connected and ready");
}

main().catch((error) => {
  logger.error("Failed to start MCP server", { error: String(error) });
  process.exit(1);
});

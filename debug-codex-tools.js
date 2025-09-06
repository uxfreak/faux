#!/usr/bin/env node

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function debugCodexTools() {
  console.log('🔍 Debugging Codex MCP tools...');
  
  try {
    // Create MCP client
    const client = new Client({
      name: "debug-codex-tools",
      version: "1.0.0"
    });

    // Create stdio transport
    const transport = new StdioClientTransport({
      command: "codex",
      args: ["mcp"],
    });

    // Connect
    await client.connect(transport);
    console.log('✅ Connected to Codex MCP');

    // List available tools
    const result = await client.listTools();
    console.log('📋 Available tools:', JSON.stringify(result, null, 2));

    // List available resources
    const resources = await client.listResources();
    console.log('📄 Available resources:', resources);

    // List available prompts
    const prompts = await client.listPrompts();
    console.log('💬 Available prompts:', prompts);

    await client.close();
    console.log('✅ Debug complete');

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
  }
}

debugCodexTools();
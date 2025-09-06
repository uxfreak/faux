import { spawn } from 'child_process';

// Test MCP server directly by sending JSON-RPC commands
const codexBinary = '/Users/kasa/Downloads/codex-experiments/codex/codex-rs/target/release/codex';

console.log('Starting codex MCP server...');
const process = spawn(codexBinary, ['mcp'], {
  cwd: '/Users/kasa/Downloads/FOUX',
  stdio: ['pipe', 'pipe', 'pipe']
});

process.stderr.on('data', (data) => {
console.log('STDERR:', data.toString());
});

process.stdout.on('data', (data) => {
console.log('STDOUT:', data.toString());
});

process.on('error', (error) => {
  console.error('ERROR:', error);
});

// Wait a bit then send a getAuthStatus request
setTimeout(() => {
console.log('Sending getAuthStatus request...');
  const request = {
    jsonrpc: '2.0',
    id: 'test-1',
    method: 'getAuthStatus',
    params: { include_token: false, refresh_token: false }
  };
  
  process.stdin.write(JSON.stringify(request) + '\n');
}, 2000);

// Cleanup after 10 seconds
setTimeout(() => {
  process.kill();
  process.exit(0);
}, 10000);

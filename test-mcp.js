import CodexService from './src/services/codexService.js';

async function testMCP() {
  const codexService = new CodexService();
  
  try {
console.log('Starting codex service...');
    await codexService.start('/Users/kasa/Downloads/FOUX');
    
console.log('Service started. Checking if running:', codexService.isRunning());
    
console.log('Getting auth status...');
    const authStatus = await codexService.getAuthStatus();
console.log('Auth status:', JSON.stringify(authStatus, null, 2));
    
console.log('Creating conversation...');
    const conversationId = await codexService.newConversation({
      workingDirectory: '/Users/kasa/Downloads/FOUX'
    });
console.log('Conversation ID:', conversationId);
    
console.log('Sending test message...');
    const result = await codexService.sendMessage('Hello, can you help me?');
console.log('Send result:', result);
    
    // Wait for potential streaming content
    setTimeout(() => {
console.log('Stopping service...');
      codexService.stop();
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('Error:', error);
    codexService.stop();
    process.exit(1);
  }
}

// Listen for streaming content
const codexService = new CodexService();
codexService.on('streamingContent', (data) => {
console.log('Streaming content:', data);
});

codexService.on('taskComplete', (data) => {
console.log('Task complete:', data);
});

codexService.on('error', (error) => {
  console.error('Codex error:', error);
});

testMCP();

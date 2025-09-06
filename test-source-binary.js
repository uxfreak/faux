import CodexService from './src/services/codexService.js';

async function testSourceBinary() {
  const codexService = new CodexService();
  
  try {
console.log('🚀 Starting codex service with source-built binary...');
    await codexService.start('/Users/kasa/Downloads/FOUX');
    
console.log('✅ Service started. Running:', codexService.isRunning());
    
console.log('🔐 Getting auth status...');
    const authStatus = await codexService.getAuthStatus();
console.log('Auth status:', JSON.stringify(authStatus, null, 2));
    
console.log('💬 Creating conversation...');
    const conversationId = await codexService.newConversation({
      workingDirectory: '/Users/kasa/Downloads/FOUX'
    });
console.log('Conversation ID:', conversationId);
    
console.log('📤 Sending test message...');
    
    // Set up event listeners first
    codexService.on('streamingContent', (data) => {
console.log('📥 STREAMING:', data);
    });

    codexService.on('taskComplete', (data) => {
console.log('✅ TASK COMPLETE:', data);
      setTimeout(() => {
        codexService.stop();
        process.exit(0);
      }, 1000);
    });

    const result = await codexService.sendMessage('Hello! Can you help me understand this codebase?');
console.log('📮 Send result:', result);
    
  } catch (error) {
    console.error('💥 Error:', error);
    codexService.stop();
    process.exit(1);
  }
}

testSourceBinary();

import CodexService from './src/services/codexService.js';

const codexService = new CodexService();

// Listen for all events and logs
codexService.on('error', (error) => {
  console.log('❌ CODEX ERROR:', error);
});

codexService.on('log', (message) => {
  console.log('📝 CODEX LOG:', message.trim());
});

codexService.on('streamingContent', (data) => {
console.log('📤 STREAMING:', data);
});

codexService.on('taskComplete', (data) => {
console.log('✅ TASK COMPLETE:', data);
});

codexService.on('notification', (data) => {
console.log('🔔 NOTIFICATION:', data);
});

async function test() {
  try {
console.log('🚀 Starting codex service...');
    await codexService.start('/Users/kasa/Downloads/FOUX');
    
console.log('🆕 Creating conversation...');
    const conversationId = await codexService.newConversation({ workingDirectory: '/Users/kasa/Downloads/FOUX' });
console.log('📋 Conversation ID:', conversationId);
    
console.log('💬 Sending message...');
    const result = await codexService.sendMessage('Hello, can you help me?');
console.log('📮 Send result:', result);
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
  
  // Auto-exit after 30 seconds
  setTimeout(() => {
console.log('⏰ Timeout reached, stopping...');
    codexService.stop();
    process.exit(0);
  }, 30000);
}

test();

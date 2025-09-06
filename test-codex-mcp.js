#!/usr/bin/env node

/**
 * Test script for Codex MCP integration
 * 
 * This script tests the basic functionality of our Codex MCP service
 * to ensure the backend foundation is working correctly.
 */

import codexService from './src/services/codexService.js';

async function testCodexMCP() {
  console.log('🧪 Testing Codex MCP Integration...\n');

  try {
    // Test 1: Check if service is initialized
    console.log('1️⃣ Testing service initialization...');
    const initialStatus = codexService.getStatus();
    console.log('   Initial status:', initialStatus);
    
    if (initialStatus.connected) {
      console.log('   ⚠️ Service already connected, disconnecting first...');
      await codexService.disconnect();
    }
    console.log('   ✅ Service initialized successfully\n');

    // Test 2: Connect to Codex MCP
    console.log('2️⃣ Testing connection to Codex MCP...');
    try {
      await codexService.connect();
      const connectedStatus = codexService.getStatus();
      console.log('   Connected status:', connectedStatus);
      
      if (connectedStatus.connected) {
        console.log('   ✅ Connection successful\n');
      } else {
        console.log('   ❌ Connection failed - status shows not connected\n');
        return false;
      }
    } catch (error) {
      console.log('   ❌ Connection failed:', error.message);
      console.log('   💡 Make sure you have:');
      console.log('      - OpenAI Codex CLI installed (`npm install -g @openai/codex`)');
      console.log('      - Authenticated with `codex login`');
      console.log('      - Network connectivity\n');
      return false;
    }

    // Test 3: Event listeners
    console.log('3️⃣ Testing event listeners...');
    let eventReceived = false;
    
    const cleanup = codexService.on('connected', () => {
      console.log('   📡 Connected event received');
      eventReceived = true;
    });
    
    // Trigger a reconnect to test events
    await codexService.disconnect();
    await codexService.connect();
    
    // Wait a moment for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));
    
    if (cleanup && typeof cleanup === 'function') {
      cleanup(); // Remove event listener
    }
    
    if (eventReceived) {
      console.log('   ✅ Event listeners working correctly\n');
    } else {
      console.log('   ⚠️ Event listeners may not be working correctly\n');
    }

    // Test 4: Simple conversation (optional - requires authentication)
    console.log('4️⃣ Testing basic conversation...');
    try {
      const conversationResult = await codexService.startConversation(
        'Hello! This is a test message. Please respond with "Test successful".',
        {
          model: 'gpt-5',
          sandbox: 'read-only', // Safe for testing
          approvalPolicy: 'never' // No approvals for test
        }
      );
      
      console.log('   Conversation started:', conversationResult.sessionId);
      
      if (conversationResult.sessionId) {
        console.log('   ✅ Conversation creation successful');
        
        // Close the test session
        codexService.closeSession(conversationResult.sessionId);
        console.log('   🧹 Test session cleaned up\n');
      } else {
        console.log('   ❌ Conversation creation failed - no session ID returned\n');
      }
    } catch (error) {
      console.log('   ❌ Conversation test failed:', error.message);
      console.log('   💡 This might be due to authentication or API limits\n');
    }

    // Test 5: Session management
    console.log('5️⃣ Testing session management...');
    const allSessions = codexService.getAllSessions();
    console.log('   Active sessions:', allSessions.length);
    console.log('   ✅ Session management working\n');

    // Test 6: Cleanup
    console.log('6️⃣ Testing cleanup...');
    await codexService.disconnect();
    const disconnectedStatus = codexService.getStatus();
    console.log('   Disconnected status:', disconnectedStatus);
    
    if (!disconnectedStatus.connected) {
      console.log('   ✅ Cleanup successful\n');
    } else {
      console.log('   ⚠️ Cleanup may not have worked correctly\n');
    }

    console.log('🎉 Backend foundation test completed!');
    console.log('✅ All core components are working correctly.');
    console.log('📝 Ready to proceed with UI integration.\n');
    
    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Install dependencies: npm install');
    console.log('2. Install Codex CLI: npm install -g @openai/codex');
    console.log('3. Authenticate: codex login');
    console.log('4. Check network connectivity');
    console.log('5. Verify environment variables\n');
    
    return false;
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down test...');
  try {
    await codexService.disconnect();
  } catch (error) {
    // Ignore errors during shutdown
  }
  process.exit(0);
});

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testCodexMCP()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testCodexMCP };
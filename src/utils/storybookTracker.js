// Storybook URL tracking script - to be injected into Storybook iframe
(function() {
  console.log('🎬 Storybook URL tracker initialized');
  
  let lastUrl = window.location.href;
  let lastPathname = window.location.pathname;
  let lastSearch = window.location.search;
  let lastHash = window.location.hash;
  
  // Function to notify parent window of URL changes
  const notifyUrlChange = (url) => {
    try {
      window.parent.postMessage({
        type: 'storybook-navigation',
        url: url,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        timestamp: Date.now()
      }, '*');
      console.log('📤 Sent URL update to parent:', url);
    } catch (error) {
      console.log('❌ Failed to send URL update:', error);
    }
  };
  
  // Monitor URL changes using multiple methods
  
  // Method 1: Override history API
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function() {
    originalPushState.apply(history, arguments);
    setTimeout(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        notifyUrlChange(currentUrl);
      }
    }, 0);
  };
  
  history.replaceState = function() {
    originalReplaceState.apply(history, arguments);
    setTimeout(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        notifyUrlChange(currentUrl);
      }
    }, 0);
  };
  
  // Method 2: Listen for popstate events
  window.addEventListener('popstate', () => {
    setTimeout(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        notifyUrlChange(currentUrl);
      }
    }, 0);
  });
  
  // Method 3: Listen for hashchange events
  window.addEventListener('hashchange', () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      notifyUrlChange(currentUrl);
    }
  });
  
  // Method 4: Periodic URL checking as fallback
  setInterval(() => {
    const currentUrl = window.location.href;
    const currentPathname = window.location.pathname;
    const currentSearch = window.location.search;
    const currentHash = window.location.hash;
    
    if (currentUrl !== lastUrl || 
        currentPathname !== lastPathname || 
        currentSearch !== lastSearch || 
        currentHash !== lastHash) {
      
      lastUrl = currentUrl;
      lastPathname = currentPathname;
      lastSearch = currentSearch;
      lastHash = currentHash;
      
      notifyUrlChange(currentUrl);
    }
  }, 1000); // Check every second
  
  // Method 5: Monitor for Storybook-specific events
  if (window.__STORYBOOK_ADDONS_CHANNEL__) {
    window.__STORYBOOK_ADDONS_CHANNEL__.on('storyChanged', (data) => {
      console.log('📖 Storybook story changed:', data);
      setTimeout(() => {
        const currentUrl = window.location.href;
        notifyUrlChange(currentUrl);
      }, 100);
    });
  }
  
  // Send initial URL
  setTimeout(() => {
    notifyUrlChange(window.location.href);
  }, 1000);
  
})();
/**
 * DOM Inspector Injection Script
 * This script is injected into the preview iframe to handle element inspection
 */

(function() {
  'use strict';

  // Check if already injected
  if (window.__DOM_INSPECTOR_INJECTED__) {
    console.log('Inspector already injected');
    return;
  }
  window.__DOM_INSPECTOR_INJECTED__ = true;

  class DOMInspector {
    constructor() {
      this.isActive = false;
      this.hasSelection = false;  // True after clicking an element
      this.currentElement = null;
      this.hoveredElement = null;
      this.overlay = null;
      this.tooltip = null;
      this.config = {
        highlightColor: '#4F46E5',
        highlightOpacity: 0.3,
        selectedColor: '#10B981',
        selectedOpacity: 0.4
      };

      // Bind methods
      this.handleMouseMove = this.handleMouseMove.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleKeyDown = this.handleKeyDown.bind(this);
      this.handleMessage = this.handleMessage.bind(this);

      // Setup
      this.createOverlay();
      this.setupMessageListener();
      
      // Notify parent that inspector is ready
      this.sendToParent('INSPECTOR_READY', {});
    }

    /**
     * Create visual overlay elements
     */
    createOverlay() {
      // Create highlight overlay
      this.overlay = document.createElement('div');
      this.overlay.id = 'dom-inspector-overlay';
      this.overlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        transition: all 0.1s ease;
        border: 2px solid ${this.config.highlightColor};
        background-color: ${this.config.highlightColor}${Math.round(this.config.highlightOpacity * 255).toString(16)};
        display: none;
      `;
      document.body.appendChild(this.overlay);

      // Create tooltip
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'dom-inspector-tooltip';
      this.tooltip.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 999999;
        background: #1F2937;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        font-family: monospace;
        display: none;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      document.body.appendChild(this.tooltip);
    }

    /**
     * Setup message listener for commands from parent
     */
    setupMessageListener() {
      window.addEventListener('message', this.handleMessage);
    }

    /**
     * Handle messages from parent window
     */
    handleMessage(event) {
      console.log('🔍 Inspector received message:', event.data);
      if (event.data && event.data.source === 'dom-inspector-parent') {
        const { type, config, direction, selector } = event.data;
        console.log('📩 Processing inspector command:', type);

        switch (type) {
          case 'ACTIVATE_INSPECTOR':
            console.log('🚀 Activating inspector with config:', config);
            this.activate(config);
            break;
          case 'DEACTIVATE_INSPECTOR':
            console.log('🛑 Deactivating inspector');
            this.deactivate();
            break;
          case 'NAVIGATE_TREE':
            this.navigateTree(direction);
            break;
          case 'CAPTURE_SCREENSHOT':
            this.captureElementScreenshot(selector);
            break;
          default:
            console.log('Unknown inspector command:', type);
        }
      }
    }

    /**
     * Activate the inspector
     */
    activate(config) {
      if (this.isActive) return;

      this.isActive = true;
      this.hasSelection = false;  // Reset selection state for new inspection
      this.currentElement = null;
      this.hoveredElement = null;
      
      if (config) {
        this.config = { ...this.config, ...config };
      }

      // Add event listeners
      document.addEventListener('mousemove', this.handleMouseMove, true);
      document.addEventListener('click', this.handleClick, true);
      document.addEventListener('keydown', this.handleKeyDown, true);

      // Add custom cursor
      document.body.style.cursor = 'crosshair';
      
      console.log('Inspector activated - hover enabled');
    }

    /**
     * Deactivate the inspector
     */
    deactivate() {
      if (!this.isActive) return;

      this.isActive = false;
      this.hasSelection = false;  // Reset selection state
      this.currentElement = null;
      this.hoveredElement = null;

      // Remove event listeners
      document.removeEventListener('mousemove', this.handleMouseMove, true);
      document.removeEventListener('click', this.handleClick, true);
      document.removeEventListener('keydown', this.handleKeyDown, true);

      // Reset cursor
      document.body.style.cursor = '';

      // Hide overlay
      this.hideOverlay();

      console.log('Inspector deactivated - state reset');
    }

    /**
     * Handle mouse move for hover effect
     */
    handleMouseMove(event) {
      if (!this.isActive || this.hasSelection) return;  // Don't hover after selection

      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (element && element !== this.hoveredElement) {
        this.hoveredElement = element;
        this.highlightElement(element);
        
        // Send hover event
        this.sendToParent('ELEMENT_HOVERED', {
          tagName: element.tagName,
          selector: this.generateSelector(element)
        });
      }
    }

    /**
     * Handle click for element selection
     */
    handleClick(event) {
      if (!this.isActive) return;

      event.preventDefault();
      event.stopPropagation();

      const element = document.elementFromPoint(event.clientX, event.clientY);
      if (element) {
        this.selectElement(element);
        // Don't deactivate - keep inspector active for more selections
        console.log('📌 Element selected, inspector remains active');
      }
    }

    /**
     * Handle keyboard navigation
     */
    handleKeyDown(event) {
      if (!this.isActive) return;

      switch (event.key) {
        case 'Escape':
          // Don't deactivate here - let parent handle it
          event.preventDefault();
          break;
        case 'ArrowUp':
          event.preventDefault();
          this.navigateTree('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          this.navigateTree('down');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          this.navigateTree('left');
          break;
        case 'ArrowRight':
          event.preventDefault();
          this.navigateTree('right');
          break;
        case 'Enter':
          event.preventDefault();
          if (this.currentElement) {
            this.selectElement(this.currentElement);
          }
          break;
      }
    }

    /**
     * Navigate DOM tree with keyboard
     */
    navigateTree(direction) {
      let newElement = null;
      const current = this.currentElement || this.hoveredElement || document.body;

      switch (direction) {
        case 'up':
          newElement = current.parentElement;
          break;
        case 'down':
          newElement = current.firstElementChild;
          break;
        case 'left':
          newElement = current.previousElementSibling;
          break;
        case 'right':
          newElement = current.nextElementSibling;
          break;
      }

      if (newElement) {
        this.currentElement = newElement;
        this.hoveredElement = newElement;
        this.highlightElement(newElement);
        
        // Scroll into view if needed
        newElement.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'nearest', 
          inline: 'nearest' 
        });
        
        // Don't capture screenshot on navigation - wait for Enter key
        console.log('🔍 Navigated to:', newElement.tagName, '- Press Enter to select');
      }
    }

    /**
     * Highlight an element
     */
    highlightElement(element) {
      if (!element) return;

      const rect = element.getBoundingClientRect();
      
      // Update overlay position and size (fixed positioning uses viewport coordinates directly)
      this.overlay.style.left = `${rect.left}px`;
      this.overlay.style.top = `${rect.top}px`;
      this.overlay.style.width = `${rect.width}px`;
      this.overlay.style.height = `${rect.height}px`;
      this.overlay.style.display = 'block';

      // Update tooltip
      const tooltipText = this.getElementLabel(element);
      this.tooltip.textContent = tooltipText;
      this.tooltip.style.left = `${rect.left}px`;
      this.tooltip.style.top = `${rect.top - 25}px`;
      this.tooltip.style.display = 'block';

      // Adjust tooltip position if it goes off screen
      const tooltipRect = this.tooltip.getBoundingClientRect();
      if (tooltipRect.right > window.innerWidth) {
        this.tooltip.style.left = `${window.innerWidth - tooltipRect.width - 10}px`;
      }
      if (tooltipRect.top < 0) {
        this.tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
      }
    }

    /**
     * Hide overlay and tooltip
     */
    hideOverlay() {
      if (this.overlay) {
        this.overlay.style.display = 'none';
      }
      if (this.tooltip) {
        this.tooltip.style.display = 'none';
      }
    }

    /**
     * Select an element and extract its information
     */
    selectElement(element) {
      this.currentElement = element;
      this.hasSelection = true;  // Mark that we have a selection

      // Change overlay color to indicate selection
      this.overlay.style.borderColor = this.config.selectedColor;
      this.overlay.style.backgroundColor = `${this.config.selectedColor}${Math.round(this.config.selectedOpacity * 255).toString(16)}`;

      // Extract element information
      const elementData = this.extractElementData(element);
      
      // Send to parent
      this.sendToParent('ELEMENT_SELECTED', elementData);
      
      console.log('✅ Element selected - hover disabled, use arrow keys to navigate');

      // Extract React info if available
      const reactInfo = this.extractReactInfo(element);
      if (reactInfo) {
        this.sendToParent('REACT_INFO_EXTRACTED', reactInfo);
      }
    }

    /**
     * Extract comprehensive element data
     */
    extractElementData(element) {
      const rect = element.getBoundingClientRect();
      const computedStyles = window.getComputedStyle(element);
      
      // Extract attributes
      const attributes = {};
      for (const attr of element.attributes) {
        attributes[attr.name] = attr.value;
      }

      return {
        // Selectors
        selector: this.generateSelector(element),
        xpath: this.generateXPath(element),
        
        // Basic info
        tagName: element.tagName.toLowerCase(),
        id: element.id || null,
        className: element.className || null,
        attributes: attributes,
        
        // Content
        textContent: element.textContent?.trim().substring(0, 200),
        innerHTML: element.innerHTML?.substring(0, 500),
        
        // Computed styles (extract all, filter on parent side)
        computedStyles: this.extractComputedStyles(computedStyles),
        
        // Visual info
        boundingBox: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right
        },
        
        // State
        isVisible: this.isElementVisible(element),
        isInteractive: this.isElementInteractive(element)
      };
    }

    /**
     * Extract React component information with enhanced source mapping
     */
    extractReactInfo(element) {
      // Find React fiber node
      const fiberKey = Object.keys(element).find(key => 
        key.startsWith('__reactFiber$') || 
        key.startsWith('__reactInternalInstance$')
      );

      if (!fiberKey) return null;

      try {
        const fiber = element[fiberKey];
        
        // Extract component hierarchy with source info
        const componentHierarchy = [];
        let currentFiber = fiber;
        
        while (currentFiber && componentHierarchy.length < 10) {
          if (currentFiber.elementType && typeof currentFiber.elementType !== 'string') {
            const componentInfo = {
              name: currentFiber.elementType.name || 'Anonymous',
              props: this.sanitizeProps(currentFiber.memoizedProps),
              // Try to get source information from multiple places
              source: this.extractSourceInfo(currentFiber)
            };
            
            componentHierarchy.push(componentInfo);
          }
          currentFiber = currentFiber.return;
        }

        // Extract detailed component information
        const componentInfo = {
          componentName: fiber.elementType?.name || fiber.type?.name || 'Unknown',
          displayName: fiber.elementType?.displayName || null,
          props: this.sanitizeProps(fiber.memoizedProps),
          state: fiber.memoizedState,
          key: fiber.key,
          ref: fiber.ref,
          parentComponents: componentHierarchy.slice(1),
          
          // Enhanced source detection
          source: this.extractSourceInfo(fiber),
          
          // Component tree path
          componentPath: this.buildComponentPath(fiber),
          
          // Owner component (who rendered this)
          owner: fiber._debugOwner ? {
            name: fiber._debugOwner.elementType?.name || 'Unknown',
            source: this.extractSourceInfo(fiber._debugOwner)
          } : null,
          
          // Hooks (if function component)
          hooks: fiber.memoizedState ? this.extractHooks(fiber.memoizedState) : null,
          
          // Component type
          componentType: this.getComponentType(fiber),
          
          // Render info
          renderInfo: {
            isFirstRender: fiber.alternate === null,
            updateQueue: fiber.updateQueue,
            effectTag: fiber.effectTag || fiber.flags
          }
        };

        // Try to find source file from Vite HMR or webpack metadata
        const enhancedSource = this.findSourceFromBundler(fiber, componentInfo);
        if (enhancedSource) {
          componentInfo.source = { ...componentInfo.source, ...enhancedSource };
        }

        return componentInfo;
      } catch (error) {
        console.error('Error extracting React info:', error);
        return null;
      }
    }

    /**
     * Extract source information from fiber
     */
    extractSourceInfo(fiber) {
      const source = {};
      
      // Try React DevTools source
      if (fiber._debugSource) {
        source.fileName = fiber._debugSource.fileName;
        source.lineNumber = fiber._debugSource.lineNumber;
        source.columnNumber = fiber._debugSource.columnNumber;
      }
      
      // Try to extract from function toString (works in dev)
      if (fiber.elementType && typeof fiber.elementType === 'function') {
        const funcString = fiber.elementType.toString();
        
        // Look for source map comments
        const sourceMapMatch = funcString.match(/\/\/# sourceMappingURL=(.+)/);
        if (sourceMapMatch) {
          source.sourceMap = sourceMapMatch[1];
        }
        
        // Look for Vite HMR imports
        const viteMatch = funcString.match(/import\.meta\.hot/);
        if (viteMatch) {
          source.bundler = 'vite';
        }
        
        // Try to extract file path from function
        const fileMatch = funcString.match(/\/src\/(.+?)\.(tsx?|jsx?)/);
        if (fileMatch) {
          source.inferredPath = `/src/${fileMatch[1]}.${fileMatch[2]}`;
        }
      }
      
      // Check for Vite specific metadata
      if (fiber.elementType?.__vite_ssr_import_0__) {
        source.viteModule = true;
      }
      
      return source;
    }

    /**
     * Find source from bundler metadata
     */
    findSourceFromBundler(fiber, componentInfo) {
      const source = {};
      
      // Check Vite HMR metadata
      if (window.__vite_ssr_exports__) {
        // Vite SSR exports might contain source info
        source.bundler = 'vite';
      }
      
      // Check for webpack metadata
      if (window.webpackChunkName) {
        source.bundler = 'webpack';
      }
      
      // Try to find in loaded modules (Vite)
      // Check if we're in a module context with import.meta available
      try {
        // Use eval to avoid syntax error in non-module contexts
        const hasImportMeta = eval('typeof import !== "undefined" && import.meta');
        if (hasImportMeta && hasImportMeta.hot) {
          source.hmr = true;
          source.bundler = 'vite';
          
          // Try to get the actual file path from import.meta.url
          if (hasImportMeta.url) {
            try {
              const url = new URL(hasImportMeta.url);
              source.modulePath = url.pathname;
            } catch (e) {
              // Ignore URL parsing errors
            }
          }
        }
      } catch (e) {
        // Not in a module context, skip import.meta checks
      }
      
      // Look for source in stack trace (hacky but works)
      try {
        const stack = new Error().stack;
        const stackLines = stack.split('\n');
        
        // Find lines with /src/ paths
        const srcLine = stackLines.find(line => line.includes('/src/'));
        if (srcLine) {
          const pathMatch = srcLine.match(/\/src\/(.+?):(\d+):(\d+)/);
          if (pathMatch) {
            source.stackPath = `/src/${pathMatch[1]}`;
            source.stackLine = parseInt(pathMatch[2]);
            source.stackColumn = parseInt(pathMatch[3]);
          }
        }
      } catch (e) {
        // Ignore stack trace errors
      }
      
      return Object.keys(source).length > 0 ? source : null;
    }

    /**
     * Build component path
     */
    buildComponentPath(fiber) {
      const path = [];
      let current = fiber;
      
      while (current && path.length < 15) {
        if (current.elementType) {
          const name = typeof current.elementType === 'string' 
            ? current.elementType 
            : current.elementType.name || 'Component';
          path.unshift(name);
        }
        current = current.return;
      }
      
      return path.join(' > ');
    }

    /**
     * Sanitize props to avoid circular references
     */
    sanitizeProps(props) {
      if (!props) return null;
      
      try {
        // Create a shallow copy and remove functions/circular refs
        const sanitized = {};
        for (const key in props) {
          const value = props[key];
          if (value === null || value === undefined) {
            sanitized[key] = value;
          } else if (typeof value === 'function') {
            sanitized[key] = '[Function]';
          } else if (typeof value === 'object') {
            // Only include simple objects, not complex ones
            if (Array.isArray(value)) {
              sanitized[key] = `[Array(${value.length})]`;
            } else if (value.constructor === Object) {
              sanitized[key] = '[Object]';
            } else {
              sanitized[key] = `[${value.constructor.name}]`;
            }
          } else {
            sanitized[key] = value;
          }
        }
        return sanitized;
      } catch (e) {
        return null;
      }
    }

    /**
     * Get component type
     */
    getComponentType(fiber) {
      if (fiber.elementType) {
        if (typeof fiber.elementType === 'string') {
          return 'host'; // DOM element
        } else if (fiber.elementType.$$typeof) {
          const symbol = fiber.elementType.$$typeof.toString();
          if (symbol.includes('react.forward_ref')) return 'forwardRef';
          if (symbol.includes('react.memo')) return 'memo';
          if (symbol.includes('react.lazy')) return 'lazy';
        } else if (fiber.elementType.prototype?.isReactComponent) {
          return 'class';
        } else {
          return 'function';
        }
      }
      return 'unknown';
    }

    /**
     * Extract hooks information
     */
    extractHooks(memoizedState) {
      const hooks = [];
      let hookState = memoizedState;
      
      while (hookState && hooks.length < 10) {
        hooks.push({
          value: hookState.memoizedState,
          queue: hookState.queue
        });
        hookState = hookState.next;
      }
      
      return hooks.length > 0 ? hooks : null;
    }

    /**
     * Extract computed styles
     */
    extractComputedStyles(styles) {
      const extracted = {};
      
      // Get all properties
      for (let i = 0; i < styles.length; i++) {
        const prop = styles[i];
        extracted[prop] = styles.getPropertyValue(prop);
      }
      
      return extracted;
    }

    /**
     * Check if element is visible
     */
    isElementVisible(element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      
      return rect.width > 0 && 
             rect.height > 0 && 
             style.display !== 'none' && 
             style.visibility !== 'hidden' && 
             style.opacity !== '0';
    }

    /**
     * Check if element is interactive
     */
    isElementInteractive(element) {
      const interactiveTags = ['a', 'button', 'input', 'select', 'textarea'];
      return interactiveTags.includes(element.tagName.toLowerCase()) ||
             element.onclick !== null ||
             element.getAttribute('role') === 'button';
    }

    /**
     * Generate unique CSS selector
     */
    generateSelector(element) {
      const path = [];
      let current = element;

      while (current && current !== document.body) {
        let selector = current.tagName.toLowerCase();
        
        if (current.id) {
          selector = `#${current.id}`;
          path.unshift(selector);
          break;
        } else if (current.className) {
          const classes = current.className.split(' ').filter(c => c.trim());
          if (classes.length > 0) {
            selector += `.${classes.join('.')}`;
          }
        }
        
        // Add nth-child if needed
        const siblings = current.parentElement ? Array.from(current.parentElement.children) : [];
        const index = siblings.indexOf(current);
        if (siblings.length > 1) {
          selector += `:nth-child(${index + 1})`;
        }
        
        path.unshift(selector);
        current = current.parentElement;
      }

      return path.join(' > ');
    }

    /**
     * Generate XPath
     */
    generateXPath(element) {
      const path = [];
      let current = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;
        
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }
        
        const tagName = current.tagName.toLowerCase();
        const xpathIndex = index > 1 ? `[${index}]` : '';
        path.unshift(`${tagName}${xpathIndex}`);
        
        current = current.parentElement;
      }

      return '/' + path.join('/');
    }

    /**
     * Get element label for tooltip
     */
    getElementLabel(element) {
      let label = element.tagName.toLowerCase();
      
      if (element.id) {
        label += `#${element.id}`;
      }
      
      if (element.className && typeof element.className === 'string') {
        const classes = element.className.split(' ').filter(c => c.trim()).slice(0, 2);
        if (classes.length > 0) {
          label += `.${classes.join('.')}`;
        }
      }
      
      return label;
    }

    /**
     * Send message to parent window
     */
    sendToParent(type, data) {
      window.parent.postMessage({
        source: 'dom-inspector',
        type: type,
        data: data
      }, '*');
    }

    /**
     * Capture element screenshot (using html2canvas if available)
     */
    async captureElementScreenshot(selector) {
      try {
        const element = document.querySelector(selector);
        if (!element) {
          console.error('Element not found for screenshot:', selector);
          return;
        }

        // Check if html2canvas is available
        if (typeof html2canvas !== 'undefined') {
          const canvas = await html2canvas(element, {
            backgroundColor: null,
            scale: 2,
            logging: false
          });
          
          const screenshot = canvas.toDataURL('image/png');
          this.sendToParent('SCREENSHOT_CAPTURED', {
            selector: selector,
            screenshot: screenshot
          });
        } else {
          // Fallback: send element dimensions for parent to capture
          const rect = element.getBoundingClientRect();
          this.sendToParent('SCREENSHOT_CAPTURE_FALLBACK', {
            selector: selector,
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            }
          });
        }
      } catch (error) {
        console.error('Error capturing screenshot:', error);
      }
    }

    /**
     * Cleanup
     */
    destroy() {
      this.deactivate();
      window.removeEventListener('message', this.handleMessage);
      
      // Remove overlay elements
      if (this.overlay && this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      if (this.tooltip && this.tooltip.parentNode) {
        this.tooltip.parentNode.removeChild(this.tooltip);
      }
    }
  }

  // Initialize inspector (but don't activate yet - wait for user action)
  window.__domInspector = new DOMInspector();
  console.log('DOM Inspector injected and ready');
  
  // Send ready message to parent
  window.__domInspector.sendToParent('INSPECTOR_READY', {});
})();
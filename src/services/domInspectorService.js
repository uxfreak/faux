/**
 * DOM Inspector Service
 * Manages element inspection, selection, and data extraction
 */

class DOMInspectorService {
  constructor() {
    this.isActive = false;
    this.selectedElement = null;
    this.messageHandlers = new Map();
    this.currentFrame = null;
    this.injectionScript = null;
    
    // Bind methods
    this.handleMessage = this.handleMessage.bind(this);
    this.setupMessageListener();
  }

  /**
   * Setup message listener for cross-frame communication
   */
  setupMessageListener() {
    window.addEventListener('message', this.handleMessage);
  }

  /**
   * Handle messages from injected scripts
   */
  async handleMessage(event) {
    // Validate origin if needed (for now accepting all since we're on localhost)
    if (event.data && event.data.source === 'dom-inspector') {
      const { type, data } = event.data;
      
      switch (type) {
        case 'ELEMENT_SELECTED':
          await this.handleElementSelection(data);
          break;
        case 'ELEMENT_HOVERED':
          this.handleElementHover(data);
          break;
        case 'INSPECTOR_READY':
          console.log('Inspector script injected and ready');
          break;
        case 'SCREENSHOT_CAPTURED':
          this.handleScreenshotCapture(data);
          break;
        case 'REACT_INFO_EXTRACTED':
          this.handleReactInfo(data);
          break;
        default:
          console.log('Unknown inspector message type:', type);
      }
    }
  }

  /**
   * Activate the inspector
   */
  async activate(frameElement) {
    if (this.isActive) return;
    
    this.currentFrame = frameElement;
    this.isActive = true;
    
    // Load and inject the inspector script
    await this.injectInspectorScript(frameElement);
    
    // Send activation message
    this.sendToFrame({
      type: 'ACTIVATE_INSPECTOR',
      config: {
        highlightColor: '#4F46E5',
        highlightOpacity: 0.3,
        selectedColor: '#10B981',
        selectedOpacity: 0.4
      }
    });
    
    return true;
  }

  /**
   * Deactivate the inspector
   */
  deactivate() {
    if (!this.isActive) return;
    
    this.isActive = false;
    this.selectedElement = null;
    
    // Send deactivation message
    this.sendToFrame({
      type: 'DEACTIVATE_INSPECTOR'
    });
    
    // Cleanup
    this.currentFrame = null;
  }

  /**
   * Inject inspector script into iframe
   */
  async injectInspectorScript(frameElement) {
    if (!frameElement || !frameElement.contentWindow) {
      console.error('Invalid frame element');
      return;
    }

    try {
      // For Electron, we can also use IPC to inject scripts
      if (window.electronAPI && window.electronAPI.inspector) {
        await window.electronAPI.inspector.inject(frameElement.src);
      } else {
        // Direct injection for same-origin frames
        const script = document.createElement('script');
        script.src = '/inspectorInjection.js'; // Will create this next
        frameElement.contentDocument.head.appendChild(script);
      }
    } catch (error) {
      console.error('Failed to inject inspector script:', error);
      // Fallback to postMessage approach
      this.sendToFrame({
        type: 'LOAD_INSPECTOR_SCRIPT',
        script: this.getInjectionScriptCode()
      });
    }
  }

  /**
   * Send message to frame
   */
  sendToFrame(message) {
    console.log('📨 Sending message to frame:', message);
    if (this.currentFrame && this.currentFrame.contentWindow) {
      this.currentFrame.contentWindow.postMessage({
        ...message,
        source: 'dom-inspector-parent'
      }, '*');
      console.log('✅ Message sent to frame');
    } else {
      console.error('❌ No frame to send message to:', {
        currentFrame: this.currentFrame,
        contentWindow: this.currentFrame?.contentWindow
      });
    }
  }

  /**
   * Handle element selection
   */
  async handleElementSelection(elementData) {
    console.log('🔍 DOM Inspector: Element selection received', elementData);
    this.selectedElement = elementData;
    
    // Format for optimal context
    const formattedData = this.formatElementData(elementData);
    
    // Capture screenshot if we have bounding box and project path
    console.log('📷 Checking for screenshot capture:', {
      hasBoundingBox: !!elementData.boundingBox,
      hasProjectPath: !!window.currentProject?.path,
      project: window.currentProject
    });
    
    if (elementData.boundingBox && window.currentProject?.path) {
      try {
        console.log('📸 Capturing element screenshot...');
        const screenshot = await window.electronAPI.inspector.captureElement(
          elementData.boundingBox,
          window.currentProject.path
        );
        
        console.log('📸 Screenshot result:', screenshot);
        
        if (screenshot.success) {
          formattedData.screenshot = {
            path: screenshot.path,
            thumbnail: screenshot.thumbnail,
            name: screenshot.name,
            size: screenshot.size
          };
          console.log('✅ Screenshot attached to element data');
        } else {
          console.warn('❌ Screenshot capture failed:', screenshot.error);
        }
      } catch (error) {
        console.error('Failed to capture element screenshot:', error);
      }
    } else {
      console.warn('⚠️ Cannot capture screenshot - missing data:', {
        boundingBox: elementData.boundingBox,
        projectPath: window.currentProject?.path
      });
    }
    
    // Emit event for UI update
    console.log('📤 Emitting elementSelected event:', formattedData);
    this.emit('elementSelected', formattedData);
    
    // Auto-deactivate after selection (optional)
    // this.deactivate();
  }

  /**
   * Handle element hover
   */
  handleElementHover(elementData) {
    this.emit('elementHovered', elementData);
  }

  /**
   * Handle screenshot capture
   */
  handleScreenshotCapture(data) {
    if (this.selectedElement) {
      this.selectedElement.screenshot = data.screenshot;
      this.emit('screenshotCaptured', data);
    }
  }

  /**
   * Handle React component info
   */
  handleReactInfo(data) {
    if (this.selectedElement) {
      this.selectedElement.reactInfo = data;
      this.emit('reactInfoExtracted', data);
    }
  }

  /**
   * Format element data for LLM context
   */
  formatElementData(elementData) {
    const { 
      selector, 
      tagName, 
      className, 
      id,
      computedStyles, 
      boundingBox,
      reactInfo,
      attributes
    } = elementData;

    // Filter relevant styles
    const relevantStyles = this.filterRelevantStyles(computedStyles);
    
    // Build formatted context
    const formatted = {
      // Basic info
      element: {
        selector,
        tagName,
        id: id || null,
        className: className || null,
        attributes: attributes || {}
      },
      
      // Visual info
      visual: {
        position: `${boundingBox.x}, ${boundingBox.y}`,
        size: `${boundingBox.width}x${boundingBox.height}`,
        styles: relevantStyles
      },
      
      // React info (if available)
      component: reactInfo ? {
        name: reactInfo.componentName,
        props: reactInfo.props,
        filePath: reactInfo.filePath,
        parentComponents: reactInfo.parentComponents
      } : null,
      
      // Don't include promptText - will be generated when needed
      boundingBox: boundingBox
    };
    
    return formatted;
  }

  /**
   * Filter relevant styles (remove defaults and noise)
   */
  filterRelevantStyles(styles) {
    if (!styles) return {};
    
    const relevantProperties = [
      'display', 'position', 'width', 'height',
      'margin', 'padding', 'border',
      'color', 'backgroundColor', 'fontSize', 'fontWeight',
      'flexDirection', 'justifyContent', 'alignItems',
      'grid', 'gap', 'transform', 'opacity',
      'zIndex', 'overflow'
    ];
    
    const filtered = {};
    
    for (const prop of relevantProperties) {
      if (styles[prop] && !this.isDefaultValue(prop, styles[prop])) {
        filtered[prop] = styles[prop];
      }
    }
    
    return filtered;
  }

  /**
   * Check if a style value is default
   */
  isDefaultValue(property, value) {
    const defaults = {
      'display': 'block',
      'position': 'static',
      'margin': '0px',
      'padding': '0px',
      'opacity': '1',
      'transform': 'none',
      'overflow': 'visible'
    };
    
    return defaults[property] === value;
  }

  /**
   * Format element info for LLM context (called when sending message)
   */
  formatForLLM(elementInfo) {
    const data = elementInfo.element || elementInfo;
    
    const lines = [];
    lines.push(`Selected Element: ${data.tagName}${data.id ? '#' + data.id : ''}${data.className ? '.' + data.className.split(' ').join('.') : ''}`);
    lines.push(`CSS Selector: ${data.selector}`);
    
    if (elementInfo.component || data.reactInfo) {
      const comp = elementInfo.component || data.reactInfo;
      lines.push(`React Component: ${comp.name || comp.componentName || 'Unknown'}`);
      if (comp.filePath || comp.source?.fileName) {
        lines.push(`Source File: ${comp.filePath || comp.source.fileName}`);
      }
    }
    
    // Add key styles if available
    if (elementInfo.visual?.styles) {
      const styles = elementInfo.visual.styles;
      if (Object.keys(styles).length > 0) {
        lines.push('\nKey Styles:');
        for (const [prop, value] of Object.entries(styles)) {
          lines.push(`  ${prop}: ${value}`);
        }
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Legacy prompt text generator
   */
  generatePromptText(elementData) {
    const lines = [];
    
    lines.push(`Selected Element: ${elementData.tagName}${elementData.id ? '#' + elementData.id : ''}${elementData.className ? '.' + elementData.className.split(' ').join('.') : ''}`);
    lines.push(`CSS Selector: ${elementData.selector}`);
    
    if (elementData.reactInfo) {
      lines.push(`React Component: ${elementData.reactInfo.componentName}`);
      if (elementData.reactInfo.filePath) {
        lines.push(`File: ${elementData.reactInfo.filePath}`);
      }
    }
    
    // Add key styles
    const styles = this.filterRelevantStyles(elementData.computedStyles);
    if (Object.keys(styles).length > 0) {
      lines.push('\nKey Styles:');
      for (const [prop, value] of Object.entries(styles)) {
        lines.push(`  ${prop}: ${value}`);
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Capture element screenshot
   */
  async captureElementScreenshot(selector) {
    if (window.electronAPI && window.electronAPI.inspector) {
      // Use Electron's native screenshot capability
      const screenshot = await window.electronAPI.inspector.captureElement(selector);
      return screenshot;
    } else {
      // Request screenshot from iframe
      this.sendToFrame({
        type: 'CAPTURE_SCREENSHOT',
        selector
      });
    }
  }

  /**
   * Navigate DOM tree
   */
  navigateTree(direction) {
    this.sendToFrame({
      type: 'NAVIGATE_TREE',
      direction
    });
  }

  /**
   * Event emitter functionality
   */
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event).push(handler);
  }

  off(event, handler) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event);
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.messageHandlers.has(event)) {
      const handlers = this.messageHandlers.get(event);
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Get injection script code (fallback)
   */
  getInjectionScriptCode() {
    // This will be loaded from inspectorInjection.js
    return `
      console.log('Inspector injection script would be loaded here');
      // Actual implementation in separate file
    `;
  }

  /**
   * Cleanup
   */
  destroy() {
    this.deactivate();
    window.removeEventListener('message', this.handleMessage);
    this.messageHandlers.clear();
  }
}

// Export singleton instance
export const domInspectorService = new DOMInspectorService();
export default domInspectorService;
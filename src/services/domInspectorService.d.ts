export interface ElementInfo {
  tagName: string;
  id?: string;
  className?: string;
  selector: string;
  attributes: Record<string, string>;
  computedStyles: Record<string, string>;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  reactInfo?: {
    componentName?: string;
    props?: any;
    state?: any;
    source?: {
      fileName?: string;
      lineNumber?: number;
      columnNumber?: number;
      sourceUrl?: string;
      bundlerType?: string;
    };
    componentPath?: string[];
    componentType?: string;
  };
  screenshot?: string;
}

export interface DOMInspectorService {
  activate(iframe: HTMLIFrameElement): Promise<void>;
  deactivate(): void;
  on(event: 'elementSelected', callback: (data: ElementInfo) => void): void;
  off(event: string, callback?: Function): void;
  formatForLLM(elementInfo: ElementInfo): string;
  sendMessage(message: any): void;
}

declare const domInspectorService: DOMInspectorService;
export default domInspectorService;
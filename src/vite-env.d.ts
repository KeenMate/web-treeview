/// <reference types="vite/client" />

declare module "*.css?inline" {
  const content: string;
  export default content;
}

// Vendor loglevel library type declarations
declare module './vendor/loglevel/index.js' {
  export interface Logger {
    trace(...msg: any[]): void;
    debug(...msg: any[]): void;
    info(...msg: any[]): void;
    warn(...msg: any[]): void;
    error(...msg: any[]): void;
    setLevel(level: string | number, persist?: boolean): void;
    getLevel(): number;
    setDefaultLevel(level: string | number): void;
    resetLevel(): void;
    enableAll(persist?: boolean): void;
    disableAll(persist?: boolean): void;
    methodFactory: any;
    name: string;
    levels: Record<string, number>;
    getLogger(name: string): Logger;
    rebuild(): void;
  }
  const log: Logger;
  export default log;
}

declare module './vendor/loglevel/prefix.js' {
  interface PrefixPlugin {
    reg(rootLogger: any): void;
    apply(logger: any, config?: any): any;
  }
  const prefix: PrefixPlugin;
  export default prefix;
}

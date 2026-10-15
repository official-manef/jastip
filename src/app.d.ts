declare global {
  namespace App {
    interface Locals {
      token: string | undefined;
    }
  }
  interface ImportMetaEnv {
    readonly PUBLIC_CONVEX_URL?: string;
  }
}

export {};

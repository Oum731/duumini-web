/// <reference types="vite/client" />

// (facultatif mais propre) : tu peux typer les variables dont tu te sers
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_WS_BASE?: string;
  readonly VITE_PUSHY_WEB_API?: string;
  // ajoute ici d'autres variables VITE_... si besoin
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

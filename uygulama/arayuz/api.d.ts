import type { TvApi } from "../../src/servis/api.js";

declare global {
  interface Window {
    tv: TvApi;
  }
}
export {};

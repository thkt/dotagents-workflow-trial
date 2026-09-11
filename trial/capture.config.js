import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { defineConfig } from "@playwright/test";
import appConfig from "./playwright.config.js";

if (!process.env.CAPTURE_OUTPUT || !isAbsolute(process.env.CAPTURE_OUTPUT)) {
  throw new Error("CAPTURE_OUTPUT must be an absolute output directory");
}

// 通常E2EのprojectsとwebServerを再利用し、撮影だけを別実行する。
export default defineConfig({
  ...appConfig,
  testDir: ".",
  testMatch: "capture.spec.js",
  outputDir: join(tmpdir(), `product-order-capture-results-${process.pid}`),
  reporter: "list",
  use: { ...appConfig.use, trace: "off", screenshot: "off", video: "off" },
});

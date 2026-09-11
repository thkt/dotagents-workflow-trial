import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { expect, test } from "@playwright/test";

const output = process.env.CAPTURE_OUTPUT;
if (!output || !isAbsolute(output)) {
  throw new Error("CAPTURE_OUTPUT must be an absolute output directory");
}

async function fingerprint(path, location) {
  const bytes = await readFile(location);
  return { path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}

test("並び順の選択から再読み込み・復元までを撮影する", async ({ browser, baseURL, viewport, isMobile, hasTouch }, testInfo) => {
  const startedAt = new Date().toISOString();
  const sourceFiles = await Promise.all([
    "../package.json", "../bun.lock", "public/index.html", "public/search.js",
    "public/styles.css", "server.js", "playwright.config.js", "capture.spec.js",
  ].map((path) => fingerprint(path, new URL(path, import.meta.url))));
  const screenshotName = `product-order-restored-${testInfo.project.name}.png`;
  const videoName = `product-order-restore-${testInfo.project.name}.webm`;
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({
    baseURL, viewport, isMobile, hasTouch,
    recordVideo: { dir: output, size: viewport },
  });
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto("/");
    const order = page.getByLabel("並び順", { exact: true });
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    await expect(order).toHaveValue("original");
    await page.waitForTimeout(700); // 動画で操作前後を読める間隔。
    await order.selectOption("descending");
    await expect(order).toHaveValue("descending");
    await search.pressSequentially("note", { delay: 200 });
    await expect(page.getByText("全4件中2件を表示", { exact: true })).toBeVisible();
    await page.waitForTimeout(700);
    await page.reload();
    await expect(order).toHaveValue("descending");
    await expect(search).toHaveValue("");
    await expect(page.getByText("全4件中4件を表示", { exact: true })).toBeVisible();
    await expect(page.getByRole("table").getByRole("rowheader")).toHaveText([
      "白いマグ", "黒いペン", "赤いノート", "青いノート",
    ]);
    await expect(page.getByRole("table").getByRole("cell")).toHaveText([
      "MUG-001", "PEN-001", "NOTE-002", "NOTE-001",
    ]);
    await expect(page.getByText("該当する商品はありません", { exact: true })).toBeHidden();
    await page.screenshot({ path: join(output, screenshotName), fullPage: true });
    await page.waitForTimeout(1200);
  } finally {
    await context.close();
    await video.saveAs(join(output, videoName));
    await video.delete();
  }
  // 媒体・レポートをcheckoutへ書かず、ホストの撮影ログに来歴を残す。
  console.log("CAPTURE_PROVENANCE " + JSON.stringify({
    startedAt, completedAt: new Date().toISOString(), result: "passed",
    project: testInfo.project.name, baseURL, viewport, isMobile, hasTouch,
    browserVersion: browser.version(), output,
    sourcePathBase: "trial/", sourceFiles,
    media: await Promise.all([screenshotName, videoName].map((name) =>
      fingerprint(`trial/evidence/generated/${name}`, join(output, name)),
    )),
  }));
});

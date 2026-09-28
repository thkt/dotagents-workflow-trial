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

async function expectEscapeState(page, query, names, codes) {
  await expect(page.getByLabel("商品名・商品コードで検索", { exact: true })).toHaveValue(query);
  await expect(page.getByLabel("商品名・商品コードで検索", { exact: true })).toBeFocused();
  await expect(page.getByLabel("並び順", { exact: true })).toHaveValue("descending");
  const table = page.getByRole("table", { name: "商品一覧", exact: true });
  await expect(table.getByRole("row")).toHaveCount(names.length + 1);
  await expect(table.getByRole("rowheader")).toHaveText(names);
  await expect(table.getByRole("cell")).toHaveText(codes);
  await expect(page.getByText(`全4件中${names.length}件を表示`, { exact: true })).toBeVisible();
  await expect(page.getByText("該当する商品はありません", { exact: true })).toBeVisible({ visible: names.length === 0 });
}

test("全角ASCII検索と、検索結果あり・該当なし・空欄からEscと再検索を撮影する", async ({ browser, baseURL, viewport, isMobile, hasTouch }, testInfo) => {
  const startedAt = new Date().toISOString();
  const sourceFiles = await Promise.all([
    "../README.md", "../package.json", "../bun.lock", "public/index.html", "public/search.js",
    "public/styles.css", "server.js", "playwright.config.js", "capture.config.js", "capture.spec.js",
    "tests/product-search.spec.js",
  ].map((path) => fingerprint(path, new URL(path, import.meta.url))));
  const screenshotName = `product-search-escape-cleared-${testInfo.project.name}.png`;
  const videoName = `product-search-escape-${testInfo.project.name}.webm`;
  const mediaNames = [screenshotName, videoName];
  const names = ["白いマグ", "黒いペン", "赤いノート", "青いノート"];
  const codes = ["MUG-001", "PEN-001", "NOTE-002", "NOTE-001"];
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({
    baseURL, viewport, isMobile, hasTouch,
    recordVideo: { dir: output, size: viewport },
  });
  const page = await context.newPage();
  const video = page.video();
  try {
    await page.goto("/");
    await page.getByLabel("並び順", { exact: true }).selectOption("descending");
    await page.getByLabel("商品名・商品コードで検索", { exact: true }).focus();
    await expectEscapeState(page, "", names, codes);
    const search = page.getByLabel("商品名・商品コードで検索", { exact: true });
    for (const { query, expectedNames, expectedCodes, state } of [
      { query: "ＮＯＴＥ－００１", expectedNames: ["青いノート"], expectedCodes: ["NOTE-001"], state: "code" },
      { query: "ｎＯｔＥ－００１", expectedNames: ["青いノート"], expectedCodes: ["NOTE-001"] },
      { query: "　ＰＥＮ－００１　", expectedNames: ["黒いペン"], expectedCodes: ["PEN-001"] },
      { query: "ＮＯＴＥ", expectedNames: ["赤いノート", "青いノート"], expectedCodes: ["NOTE-002", "NOTE-001"], state: "filtered" },
      { query: "ＮＯＴＥ－９９９", expectedNames: [], expectedCodes: [], state: "no-results" },
      { query: "ﾉｰﾄ", expectedNames: [], expectedCodes: [] },
    ]) {
      await search.fill(query);
      await expectEscapeState(page, query, expectedNames, expectedCodes);
      if (state) {
        const name = `product-search-fullwidth-${state}-${testInfo.project.name}.png`;
        await page.screenshot({ path: join(output, name), fullPage: true });
        mediaNames.push(name);
      }
      await page.waitForTimeout(900); // 動画で全角入力と検索結果を読める間隔。
    }
    await page.keyboard.press("Escape");
    await expectEscapeState(page, "", names, codes);
    for (const { query, expectedNames, expectedCodes } of [
      { query: "note", expectedNames: names.slice(2), expectedCodes: codes.slice(2) },
      { query: "missing", expectedNames: [], expectedCodes: [] },
      { query: "", expectedNames: names, expectedCodes: codes },
    ]) {
      await page.keyboard.type(query, { delay: 180 });
      await expectEscapeState(page, query, expectedNames, expectedCodes);
      await page.waitForTimeout(900); // 動画でEsc前後の状態を読める間隔。
      await page.keyboard.press("Escape");
      await expectEscapeState(page, "", names, codes);
      if (query === "missing") {
        await page.screenshot({ path: join(output, screenshotName), fullPage: true });
      }
      await page.waitForTimeout(900);
      await page.keyboard.type("note", { delay: 180 });
      await expectEscapeState(page, "note", names.slice(2), codes.slice(2));
      await page.waitForTimeout(900);
      await page.keyboard.press("Escape");
      await expectEscapeState(page, "", names, codes);
    }
    await page.waitForTimeout(1200);
  } finally {
    await context.close();
    await video.saveAs(join(output, videoName));
    await video.delete();
  }
  console.log("CAPTURE_PROVENANCE " + JSON.stringify({
    startedAt, completedAt: new Date().toISOString(), result: "passed",
    project: testInfo.project.name, baseURL, viewport, isMobile, hasTouch,
    browserVersion: browser.version(), output,
    sourcePathBase: "trial/", sourceFiles,
    media: await Promise.all(mediaNames.map((name) =>
      fingerprint(`trial/evidence/generated/${name}`, join(output, name)),
    )),
  }));
});

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

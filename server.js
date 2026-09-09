const pages = new Map([
  ["/", Bun.file(new URL("./public/index.html", import.meta.url))],
  ["/styles.css", Bun.file(new URL("./public/styles.css", import.meta.url))],
]);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: Number(process.env.PORT ?? 3000),
  fetch(request) {
    const file = pages.get(new URL(request.url).pathname);
    return file ? new Response(file) : new Response("Not found", { status: 404 });
  },
});

console.log(`商品一覧: ${server.url}`);

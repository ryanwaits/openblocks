import { describe, it, expect, afterEach } from "bun:test";
import { LivelyServer } from "../server";

describe("Health check", () => {
  let server: LivelyServer | null = null;

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
  });

  it("GET /health returns 200 with status ok", async () => {
    server = new LivelyServer();
    await server.start(0);

    const res = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("GET /other returns 426", async () => {
    server = new LivelyServer();
    await server.start(0);

    const res = await fetch(`http://127.0.0.1:${server.port}/other`);
    expect(res.status).toBe(426);
  });

  it("respects custom healthPath", async () => {
    server = new LivelyServer({ healthPath: "/ping" });
    await server.start(0);

    const res = await fetch(`http://127.0.0.1:${server.port}/ping`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });

    // Default /health should 426
    const res2 = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(res2.status).toBe(426);
  });
});

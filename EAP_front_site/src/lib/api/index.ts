import { HttpAdapter } from "./adapters/http";
import { MockAdapter } from "./adapters/mock";
import type { DataAdapter } from "./types";

function createAdapter(): DataAdapter {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE ?? "mock";
  if (source === "http") {
    return new HttpAdapter();
  }
  return new MockAdapter();
}

export const api = createAdapter();

export * from "./types";

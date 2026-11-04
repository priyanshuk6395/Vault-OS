import type { PropsWithChildren } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UploadProvider, useUpload } from "@/context/UploadProvider";

vi.mock("browser-image-compression", () => ({
  default: vi.fn(async (file: File) => file),
}));

let activeRequests = 0;
let peakActiveRequests = 0;
let xhrAttempts = 0;
let failXhrRequests = false;
let processingPollsRemaining = 0;

class TestXMLHttpRequest {
  upload = {} as XMLHttpRequestUpload;
  status = 0;
  onload: ((event: ProgressEvent) => void) | null = null;
  onerror: ((event: ProgressEvent) => void) | null = null;

  open() {}

  setRequestHeader() {}

  send() {
    activeRequests += 1;
    xhrAttempts += 1;
    peakActiveRequests = Math.max(peakActiveRequests, activeRequests);

    setTimeout(() => {
      this.status = failXhrRequests ? 503 : 200;
      activeRequests -= 1;
      this.onload?.(new ProgressEvent("load"));
    }, 10);
  }
}

function wrapper({ children }: PropsWithChildren) {
  return <UploadProvider>{children}</UploadProvider>;
}

function mockFetch() {
  let assetNumber = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (url.endsWith("/api/upload/init")) {
      const request = JSON.parse(String(init?.body)) as { filename: string };
      assetNumber += 1;
      return {
        ok: true,
        json: async () => ({
          assetId: `asset-${assetNumber}`,
          uploadUrl: `https://storage.test/${request.filename}`,
        }),
      } as Response;
    }

    if (url.endsWith("/api/upload/complete")) {
      const stillProcessing = processingPollsRemaining > 0;
      if (stillProcessing) processingPollsRemaining -= 1;
      return { ok: true, status: stillProcessing ? 202 : 200, json: async () => ({}) } as Response;
    }

    if (url.endsWith("/api/upload/fail")) {
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }

    throw new Error(`Unexpected request: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeFiles(count: number) {
  return Array.from(
    { length: count },
    (_, index) => new File([`image-${index}`], `image-${index}.jpg`, { type: "image/jpeg" })
  );
}

describe("UploadProvider", () => {
  beforeEach(() => {
    activeRequests = 0;
    peakActiveRequests = 0;
    xhrAttempts = 0;
    failXhrRequests = false;
    processingPollsRemaining = 0;
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 4,
    });
    vi.stubGlobal(
      "XMLHttpRequest",
      TestXMLHttpRequest as unknown as typeof XMLHttpRequest
    );
  });

  afterEach(() => {
    failXhrRequests = false;
  });

  it("queues files, bounds concurrent transfers, completes tasks, and clears completed work", async () => {
    mockFetch();
    const { result } = renderHook(() => useUpload(), { wrapper });

    act(() => {
      result.current.addFilesToQueue(makeFiles(9), "event-1", "guest-1");
    });

    expect(result.current.queue).toHaveLength(9);
    await waitFor(() => {
      expect(
        result.current.queue.every((task) => task.status === "complete"),
        JSON.stringify(result.current.queue.map(({ status, statusMessage }) => ({ status, statusMessage })))
      ).toBe(true);
    }, { timeout: 15000 });

    expect(result.current.queue.every((task) => task.progress === 100)).toBe(true);
    expect(peakActiveRequests).toBe(4);

    act(() => result.current.clearCompletedTasks());
    expect(result.current.queue).toHaveLength(0);
  });

  it("moves a failed transfer back through the queue when retried", async () => {
    const fetchMock = mockFetch();
    failXhrRequests = true;
    const { result } = renderHook(() => useUpload(), { wrapper });

    act(() => {
      result.current.addFilesToQueue(makeFiles(1), "event-2");
    });

    await waitFor(
      () => expect(result.current.queue[0]?.status).toBe("error"),
      { timeout: 15000 }
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/upload/fail",
      expect.objectContaining({
        body: expect.stringContaining('"assetId":"asset-1"'),
      })
    );
    const failureCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith("/api/upload/fail"));
    expect(JSON.parse(String(failureCall?.[1]?.body))).toMatchObject({
      failureStage: "s3-put",
      errorMessage: "Storage upload failed (503)",
    });
    const attemptsBeforeRetry = xhrAttempts;
    expect(attemptsBeforeRetry).toBeGreaterThan(0);

    failXhrRequests = false;
    act(() => result.current.retryFailedTasks());

    await waitFor(() => {
      expect(result.current.queue[0]?.status).toBe("complete");
    });
    expect(xhrAttempts).toBeGreaterThan(attemptsBeforeRetry);
    expect(result.current.queue[0]?.progress).toBe(100);
  });

  it("waits for server processing instead of marking a 202 response complete", async () => {
    mockFetch();
    processingPollsRemaining = 2;
    const { result } = renderHook(() => useUpload(), { wrapper });

    act(() => result.current.addFilesToQueue(makeFiles(1), "event-3"));

    await waitFor(() => {
      expect(result.current.queue[0]?.status).toBe("complete");
    }, { timeout: 5000 });
  });
});
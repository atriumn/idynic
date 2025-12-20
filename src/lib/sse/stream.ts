import type { SSEEvent } from "./types";

export class SSEStream {
  private encoder = new TextEncoder();
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private closed = false;

  createStream(): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start: (controller) => {
        this.controller = controller;
      },
      cancel: () => {
        // Client disconnected
        this.closed = true;
        this.controller = null;
      },
    });
  }

  get isClosed(): boolean {
    return this.closed;
  }

  send(event: SSEEvent): void {
    if (this.closed || !this.controller) {
      // Silently ignore sends after close - client disconnected
      return;
    }
    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      this.controller.enqueue(this.encoder.encode(data));
    } catch {
      // Controller was closed externally
      this.closed = true;
    }
  }

  close(): void {
    if (this.closed || !this.controller) {
      return;
    }
    try {
      this.controller.close();
    } catch {
      // Already closed
    }
    this.closed = true;
  }
}

export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

// Create mocks
const mockSupabaseFrom = vi.fn();
const mockSupabaseStorage = vi.fn();
const mockValidateApiKey = vi.fn();
const mockExtractText = vi.fn();
const mockInngestSend = vi.fn();

// Mock Supabase
vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: vi.fn().mockImplementation(() => ({
    from: mockSupabaseFrom,
    storage: {
      from: mockSupabaseStorage,
    },
  })),
}));

// Mock auth
vi.mock("@/lib/api/auth", () => ({
  validateApiKey: (...args: unknown[]) => mockValidateApiKey(...args),
  isAuthError: (result: unknown) => result instanceof Response,
}));

// Mock PDF extraction
vi.mock("unpdf", () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
}));

// Mock Inngest
vi.mock("@/inngest/client", () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

// Mock response helpers
vi.mock("@/lib/api/response", () => ({
  apiSuccess: (data: unknown, meta?: Record<string, unknown>) => {
    return new Response(
      JSON.stringify({ success: true, data, ...(meta && { meta }) }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
  apiError: (code: string, message: string, status: number) => {
    return new Response(
      JSON.stringify({ success: false, error: { code, message } }),
      {
        status,
        headers: { "Content-Type": "application/json" },
      },
    );
  },
}));

function createMockFormData(file?: {
  name: string;
  type: string;
  size: number;
  content: ArrayBuffer;
}): FormData {
  const formData = new FormData();
  if (file) {
    const blob = new Blob([file.content], { type: file.type });
    formData.append("file", new File([blob], file.name, { type: file.type }));
  }
  return formData;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  return JSON.parse(text) as T;
}

describe("Resume Upload API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateApiKey.mockResolvedValue({ userId: "user-123" });
    mockExtractText.mockResolvedValue({ text: ["Sample resume text content"] });
    mockInngestSend.mockResolvedValue(undefined);

    // Default Supabase mocks
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          delete: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "evidence") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        };
      }
      if (table === "document_jobs") {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: "job-123" },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockSupabaseStorage.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  describe("POST /api/v1/documents/resume", () => {
    it("returns 401 when API key is missing", async () => {
      const authError = new Response(
        JSON.stringify({
          success: false,
          error: { code: "unauthorized", message: "Missing API key" },
        }),
        { status: 401 },
      );

      mockValidateApiKey.mockResolvedValue(authError);

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;

      expect(response.status).toBe(401);
    });

    it("returns job_id on successful upload", async () => {
      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        data: { job_id: string; status: string; message: string };
      }>(response);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.job_id).toBe("job-123");
      expect(body.data.status).toBe("processing");
    });

    it("triggers Inngest on successful upload", async () => {
      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      await POST(request);

      expect(mockInngestSend).toHaveBeenCalledWith({
        name: "resume/process",
        data: expect.objectContaining({
          jobId: "job-123",
          userId: "user-123",
          // Note: filename may be "blob" in test environment due to FormData mock
        }),
      });
      // Verify the storagePath contains the userId
      const callData = mockInngestSend.mock.calls[0][0].data;
      expect(callData.storagePath).toContain("user-123/");
    });

    it("returns 400 when file is missing", async () => {
      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = new FormData(); // Empty form data

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("No file provided");
    });

    it("returns 400 when file type is not PDF", async () => {
      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.txt",
        type: "text/plain",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("Only PDF files are supported");
    });

    it("returns 400 when file size exceeds 10MB", async () => {
      const { POST } = await import("@/app/api/v1/documents/resume/route");

      // Create a large file (11MB)
      const largeSize = 11 * 1024 * 1024;
      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: largeSize,
        content: new ArrayBuffer(largeSize),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("File size must be less than 10MB");
    });

    it("returns 409 for duplicate documents with evidence", async () => {
      // Mock duplicate detection - document exists with evidence
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "existing-doc",
                      filename: "resume.pdf",
                      created_at: "2024-01-01",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "evidence") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(409);
      expect(body.error.code).toBe("duplicate");
      expect(body.error.message).toContain("Duplicate");
    });

    it("returns 400 when PDF text extraction fails", async () => {
      mockExtractText.mockResolvedValue({ text: [""] });

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "empty.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string; message: string };
      }>(response);

      expect(response.status).toBe(400);
      expect(body.error.code).toBe("validation_error");
      expect(body.error.message).toBe("Could not extract text from PDF");
    });

    it("cleans up orphaned documents without evidence", async () => {
      const mockDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });

      // Mock duplicate detection - document exists but NO evidence
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "orphaned-doc",
                      filename: "resume.pdf",
                      created_at: "2024-01-01",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            delete: mockDelete,
          };
        }
        if (table === "evidence") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 0, error: null }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "job-123" },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockSupabaseStorage.mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
      });

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;

      // Should clean up orphaned document and proceed
      expect(mockDelete).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it("returns 500 on storage upload error", async () => {
      mockSupabaseStorage.mockReturnValue({
        upload: vi
          .fn()
          .mockResolvedValue({ error: { message: "Upload failed" } }),
      });

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });

    it("returns 500 on job creation error", async () => {
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "documents") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        if (table === "document_jobs") {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Insert failed" },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const { POST } = await import("@/app/api/v1/documents/resume/route");

      const formData = createMockFormData({
        name: "resume.pdf",
        type: "application/pdf",
        size: 1024,
        content: new ArrayBuffer(1024),
      });

      const request = new NextRequest(
        "http://localhost:3000/api/v1/documents/resume",
        {
          method: "POST",
          headers: { Authorization: "Bearer idn_test123" },
          body: formData,
        },
      );

      const response = (await POST(request)) as NextResponse;
      const body = await parseJsonResponse<{
        success: boolean;
        error: { code: string };
      }>(response);

      expect(response.status).toBe(500);
      expect(body.error.code).toBe("server_error");
    });
  });
});

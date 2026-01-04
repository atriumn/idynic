import { api } from "../../lib/api";

// Mock the shared api client
jest.mock("@idynic/shared/api", () => ({
  createApiClient: jest.fn(() => ({
    profile: {
      get: jest.fn(),
      update: jest.fn(),
    },
    opportunities: {
      list: jest.fn(),
      get: jest.fn(),
    },
  })),
}));

describe("api", () => {
  it("exports an api client", () => {
    expect(api).toBeDefined();
  });

  it("has profile methods", () => {
    expect(api.profile).toBeDefined();
    expect(api.profile.get).toBeDefined();
    expect(api.profile.update).toBeDefined();
  });

  it("has opportunities methods", () => {
    expect(api.opportunities).toBeDefined();
    expect(api.opportunities.list).toBeDefined();
    expect(api.opportunities.get).toBeDefined();
  });
});

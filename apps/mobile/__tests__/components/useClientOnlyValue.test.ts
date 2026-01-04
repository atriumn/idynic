import { useClientOnlyValue } from "../../components/useClientOnlyValue";

describe("useClientOnlyValue", () => {
  it("returns the client value on native", () => {
    const serverValue = "server";
    const clientValue = "client";

    const result = useClientOnlyValue(serverValue, clientValue);

    expect(result).toBe(clientValue);
  });

  it("works with different types", () => {
    const result = useClientOnlyValue(null, 42);

    expect(result).toBe(42);
  });

  it("works with objects", () => {
    const serverConfig = { theme: "default" };
    const clientConfig = { theme: "dark" };

    const result = useClientOnlyValue(serverConfig, clientConfig);

    expect(result).toEqual(clientConfig);
  });
});

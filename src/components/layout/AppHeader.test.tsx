import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders title correctly", () => {
    const html = renderToString(<AppHeader title="Test Screen" />);
    expect(html).toContain("Test Screen");
    expect(html).toContain("h-16");
  });

  it("renders compact size when size='compact'", () => {
    const html = renderToString(
      <AppHeader title="Compact Screen" size="compact" />,
    );
    expect(html).toContain("Compact Screen");
    expect(html).toContain("h-13");
  });

  it("renders back button when onBack is provided", () => {
    const html = renderToString(
      <AppHeader title="With Back" onBack={() => {}} />,
    );
    expect(html).toContain("<button");
    expect(html).toContain("lucide-chevron-left");
  });

  it("renders actions slot", () => {
    const html = renderToString(
      <AppHeader
        title="With Actions"
        actions={<button id="save-btn">Save</button>}
      />,
    );
    expect(html).toContain("save-btn");
  });

  it("applies uniform full-width layout with px-4 sm:px-6 and no mx-auto margins", () => {
    const html = renderToString(
      <AppHeader title="Uniform Margin" onBack={() => {}} />,
    );
    expect(html).toContain("w-full px-4 sm:px-6");
    expect(html).not.toContain("mx-auto");
  });
});

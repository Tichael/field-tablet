import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders title correctly", () => {
    const html = renderToString(<AppHeader title="Test Screen" />);
    expect(html).toContain("Test Screen");
    expect(html).toContain('title="Test Screen"');
    expect(html).toContain("h-16");
  });

  it("renders compact size when size='compact'", () => {
    const html = renderToString(
      <AppHeader title="Compact Screen" size="compact" />,
    );
    expect(html).toContain("Compact Screen");
    expect(html).toContain("h-13");
  });

  it("renders subtitle when provided", () => {
    const html = renderToString(
      <AppHeader title="Main Title" subtitle="Subtitle description" />,
    );
    expect(html).toContain("Main Title");
    expect(html).toContain("Subtitle description");
  });

  it("renders back button when onBack is provided", () => {
    const html = renderToString(
      <AppHeader title="With Back" onBack={() => {}} />,
    );
    expect(html).toContain("<button");
    expect(html).toContain("lucide-chevron-left");
  });

  it("renders custom backLabel in title and aria-label", () => {
    const html = renderToString(
      <AppHeader
        title="Custom Back"
        onBack={() => {}}
        backLabel="Return to Dashboard"
      />,
    );
    expect(html).toContain('aria-label="Return to Dashboard"');
    expect(html).toContain('title="Return to Dashboard"');
  });

  it("renders start slot", () => {
    const html = renderToString(
      <AppHeader start={<span id="custom-logo">AppLogo</span>} />,
    );
    expect(html).toContain("custom-logo");
    expect(html).toContain("AppLogo");
  });

  it("renders center slot with absolute centering classes", () => {
    const html = renderToString(
      <AppHeader
        title="With Center"
        center={<div id="center-switcher">Mode Switcher</div>}
      />,
    );
    expect(html).toContain("center-switcher");
    expect(html).toContain(
      "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
    );
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

  it("renders children sub-bar", () => {
    const html = renderToString(
      <AppHeader title="With Sub-bar">
        <div id="sub-bar-content">Section Navigation</div>
      </AppHeader>,
    );
    expect(html).toContain("sub-bar-content");
    expect(html).toContain("Section Navigation");
  });

  it("applies uniform full-width layout with px-4 sm:px-6 and relative positioning", () => {
    const html = renderToString(
      <AppHeader title="Uniform Margin" onBack={() => {}} />,
    );
    expect(html).toContain("w-full px-4 sm:px-6");
    expect(html).toContain("relative");
    expect(html).not.toContain("mx-auto");
  });
});

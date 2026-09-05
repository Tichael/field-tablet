import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { AppDialog } from "./app-dialog";

describe("AppDialog", () => {
  it("returns null when isOpen is false", () => {
    const html = renderToString(
      <AppDialog isOpen={false} onClose={() => {}} title="Test Dialog">
        <div>Content</div>
      </AppDialog>,
    );
    expect(html).toBe("");
  });

  it("renders title, children, and close button when isOpen is true", () => {
    const html = renderToString(
      <AppDialog isOpen={true} onClose={() => {}} title="Test Dialog">
        <div id="dialog-content">Modal Content Here</div>
      </AppDialog>,
    );
    expect(html).toContain("Test Dialog");
    expect(html).toContain("dialog-content");
    expect(html).toContain("Modal Content Here");
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("<button");
    expect(html).toContain("lucide-x");
  });

  it("renders subtitle and aria-describedby when provided", () => {
    const html = renderToString(
      <AppDialog
        isOpen={true}
        onClose={() => {}}
        title="Test Title"
        subtitle="Test Subtitle Description"
      >
        <div>Body</div>
      </AppDialog>,
    );
    expect(html).toContain("Test Subtitle Description");
    expect(html).toContain("aria-describedby=");
  });

  it("renders footer when provided", () => {
    const html = renderToString(
      <AppDialog
        isOpen={true}
        onClose={() => {}}
        title="With Footer"
        footer={<button id="confirm-btn">Confirm</button>}
      >
        <div>Content</div>
      </AppDialog>,
    );
    expect(html).toContain("confirm-btn");
    expect(html).toContain("Confirm");
  });

  it("applies custom maxWidth class", () => {
    const html = renderToString(
      <AppDialog
        isOpen={true}
        onClose={() => {}}
        title="Custom Width"
        maxWidth="2xl"
      >
        <div>Content</div>
      </AppDialog>,
    );
    expect(html).toContain("max-w-2xl");
  });
});

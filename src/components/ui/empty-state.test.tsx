import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { EmptyState } from "./empty-state";
import { FileText } from "lucide-react";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    const html = renderToString(
      <EmptyState
        icon={FileText}
        title="No Documents Found"
        description="Try searching in a different folder."
      />,
    );
    expect(html).toContain("No Documents Found");
    expect(html).toContain("Try searching in a different folder.");
    expect(html).toContain("lucide-file-text");
    expect(html).toContain("border-dashed");
  });

  it("renders action button when provided", () => {
    const html = renderToString(
      <EmptyState
        icon={FileText}
        title="Empty List"
        action={{
          label: "Create First Item",
          onClick: () => {},
        }}
      />,
    );
    expect(html).toContain("Create First Item");
    expect(html).toContain("<button");
  });

  it("applies solid border when dashed={false}", () => {
    const html = renderToString(
      <EmptyState icon={FileText} title="Solid Border" dashed={false} />,
    );
    expect(html).not.toContain("border-dashed");
    expect(html).toContain("border");
  });
});

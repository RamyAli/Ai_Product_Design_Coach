// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown, UserText } from "@/components/ui/markdown";
import { Progress, ScoreRing } from "@/components/ui/misc";
import { Field, Input } from "@/components/ui/form";

describe("UI components", () => {
  it("score ring exposes an accessible label and the numeric score", () => {
    render(<ScoreRing score={84} label="Score 84 out of 100" />);
    expect(screen.getByRole("img", { name: "Score 84 out of 100" })).toHaveTextContent("84");
  });

  it("progress bar reports its value", () => {
    render(<Progress value={37.6} label="Progress" />);
    expect(screen.getByRole("progressbar", { name: "Progress" })).toHaveAttribute("aria-valuenow", "38");
  });

  it("markdown never renders raw HTML or javascript links", () => {
    const { container } = render(<Markdown>{"# Title\n<script>alert(1)</script><img src=x onerror=alert(1)>\n[bad](javascript:alert(1)) [ok](https://example.com)"}</Markdown>);
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    const links = container.querySelectorAll("a");
    expect(links[0]!.getAttribute("href")).toBeNull();
    expect(links[1]!.getAttribute("href")).toBe("https://example.com");
    expect(links[1]!.getAttribute("rel")).toContain("noopener");
  });

  it("user text follows the content's direction", () => {
    render(<UserText text="هذا نص عربي" />);
    expect(screen.getByText("هذا نص عربي")).toHaveAttribute("dir", "rtl");
  });

  it("fields wire labels, hints and errors for assistive technology", () => {
    render(
      <Field id="f1" label="Name" hint="Your full name" error="Required">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBe("f1-hint f1-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

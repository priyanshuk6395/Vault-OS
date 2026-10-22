import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTheme } from "next-themes";
import ThemeToggle from "@/components/theme/ThemeToggle";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const setTheme = vi.fn();

function getModeControl(mode: "light" | "dark" | "system") {
  const name = new RegExp(mode, "i");
  return (
    screen.queryByRole("button", { name }) ??
    screen.getByRole("radio", { name })
  );
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
    vi.mocked(useTheme).mockReturnValue({
      theme: "system",
      setTheme,
    } as unknown as ReturnType<typeof useTheme>);
  });

  it("renders three accessibly named theme choices with a selected state", () => {
    render(<ThemeToggle />);

    const controls = (["button", "radio"] as const).flatMap((role) =>
      screen.queryAllByRole(role, { name: /light|dark|system/i })
    );

    expect(controls).toHaveLength(3);
    expect(getModeControl("light")).toBeInTheDocument();
    expect(getModeControl("dark")).toBeInTheDocument();

    const selected = getModeControl("system");
    expect(
      selected.getAttribute("aria-pressed") === "true" ||
        selected.getAttribute("aria-checked") === "true"
    ).toBe(true);
  });

  it.each(["light", "dark", "system"] as const)(
    "selecting %s delegates to next-themes",
    async (mode) => {
      const user = userEvent.setup();
      render(<ThemeToggle />);

      await user.click(getModeControl(mode));

      expect(setTheme).toHaveBeenCalledWith(mode);
    }
  );
});
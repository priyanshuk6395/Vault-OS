import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    const alt = typeof props.alt === "string" ? props.alt : "";
    return <span role="img" aria-label={alt} />;
  },
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href as string} {...props}>{children}</a>
  ),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe("AdminDashboardClient", () => {
  const fetchMock = vi.fn();
  const events = [
    { id: "event-1", title: "Autumn Reception", themeImageUrl: null, _count: { assets: 3 } },
  ];

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/events/event-1/assets/approved")) {
        return {
          ok: true,
          json: async () => [{ id: "asset-1", storageKey: "events/event-1/theme.webp" }],
        };
      }
      if (url.endsWith("/api/events/event-1/settings") && init?.method === "PATCH") {
        return { ok: true, json: async () => ({}) };
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("renders vaults and saves updated settings with a selected theme asset", async () => {
    const user = userEvent.setup();
    render(<AdminDashboardClient events={events} />);

    expect(screen.getByRole("heading", { name: "Command Center" })).toBeInTheDocument();
    expect(screen.getByText("Autumn Reception")).toBeInTheDocument();

    const eventLink = screen.getByRole("link", { name: /autumn reception/i });
    const eventControls = within(eventLink.parentElement as HTMLElement);
    await user.click(eventControls.getByRole("button"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Edit Vault Settings" })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/events/event-1/assets/approved"));

    await user.clear(within(dialog).getByRole("textbox"));
    await user.type(within(dialog).getByRole("textbox"), "Evening Reception");
    await user.click(await within(dialog).findByRole("button", { name: /select theme image asset-1/i }));
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/events/event-1/settings",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            title: "Evening Reception",
            themeImageUrl: "events/event-1/theme.webp",
          }),
        })
      );
    });
    expect(await screen.findByText("Evening Reception")).toBeInTheDocument();
  });

  it("shows archive totals and filters vaults with an explicit empty state", async () => {
    const user = userEvent.setup();
    render(<AdminDashboardClient events={events} />);

    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Media assets")).toBeInTheDocument();
    expect(screen.getByText("People indexed")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: /search event vaults/i }), "missing");
    expect(screen.getByRole("status")).toHaveTextContent("No matching vaults");
    expect(screen.queryByRole("link", { name: /autumn reception/i })).not.toBeInTheDocument();
  });
});
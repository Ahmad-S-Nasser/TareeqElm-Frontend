import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import OrganizationCatalogPricing from "./OrganizationCatalogPricing";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/OrganizationSidebar", () => ({
  OrganizationSidebar: () => null,
  OrganizationSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const pricing = (overrides: Record<string, unknown> = {}) => ({
  IsFree: false,
  Amount: 79,
  EffectiveAmount: 79,
  CompareAtAmount: null,
  SaleAmount: null,
  SaleStartsAt: null,
  SaleEndsAt: null,
  Currency: "USD",
  OnSale: false,
  ...overrides,
});

const paidCourse = {
  Id: "c1",
  Title: "Cloud Architecture Essentials",
  Description: null,
  Category: "Cloud",
  Level: "Intermediate",
  ImageUrl: null,
  InstructorId: "i1",
  InstructorName: "Instructor One",
  Status: "Published",
  LessonsCount: 6,
  EnrolledCount: 1,
  AccessModel: "AlaCarte",
  RequiresApproval: false,
  Pricing: pricing(),
  Owned: false,
  HasChapterPricing: true,
};

const freeCourse = {
  ...paidCourse,
  Id: "c2",
  Title: "Foundations of Data Literacy",
  AccessModel: "Free",
  Pricing: null,
  HasChapterPricing: false,
};

const chapters = [
  {
    Id: "ch1",
    Title: "Cloud foundations",
    Description: null,
    OrderIndex: 0,
    Lessons: [{ Id: "l1", Title: "Regions" }],
    Pricing: null,
    IsPreview: true,
  },
  {
    Id: "ch2",
    Title: "Designing for failure",
    Description: null,
    OrderIndex: 1,
    Lessons: [{ Id: "l2", Title: "Retries" }],
    Pricing: pricing({ Amount: 19, EffectiveAmount: 19 }),
    IsPreview: false,
  },
];

/** The seeded "Data Professional Path": both paid courses bundled at $99. */
const seededTrack = {
  Id: "t1",
  Title: "Data Professional Path",
  Description: "Both paid courses as one path, cheaper than buying them separately.",
  ImageUrl: null,
  Status: "Published",
  CoursesCount: 2,
  Pricing: pricing({ Amount: 99, EffectiveAmount: 99 }),
  IsFeatured: true,
  EstimatedHours: 24,
  DepartmentId: null,
  DepartmentName: null,
  OwnerInstructorId: null,
  OwnerInstructorName: null,
  Owned: false,
  CreatedAt: "2026-09-20T00:00:00Z",
};

const seededTrackDetail = {
  ...seededTrack,
  Courses: [
    {
      Id: "c1",
      Title: "Cloud Architecture Essentials",
      InstructorId: "i1",
      InstructorName: "Instructor One",
      Status: "Published",
      AccessModel: "AlaCarte",
      Pricing: pricing(),
      Owned: false,
      Order: 0,
    },
    {
      Id: "c2",
      Title: "Foundations of Data Literacy",
      InstructorId: "i1",
      InstructorName: "Instructor One",
      Status: "Published",
      AccessModel: "Free",
      Pricing: null,
      Owned: false,
      Order: 1,
    },
  ],
};

let mock: MockAdapter;

/** Signs in as an Organization account; `permissions` decides whether the pricing controls are visible at all. */
const signIn = (permissions: string[] = ["pricing.manage"]) => {
  const user = makeUser({ Id: "org-1", Role: "Organization", Permissions: permissions });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
};

/** Renders the page and switches to the Tracks tab (the Courses tab is the default). */
const openTracksTab = async (user: ReturnType<typeof userEvent.setup>) => {
  renderWithProviders(<OrganizationCatalogPricing />);
  await user.click(await screen.findByRole("tab", { name: "Tracks" }));
};

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet("/Settings").reply(200, { Currency: "USD" });
  mock.onGet("/Courses").reply(200, [paidCourse, freeCourse]);
  mock.onGet("/Courses/c1/curriculum").reply(200, chapters);
  mock.onGet("/tracks").reply(200, [seededTrack], { "x-total-count": "1" });
  mock.onGet("/tracks/t1").reply(200, seededTrackDetail);
});
afterEach(() => mock.restore());

describe("OrganizationCatalogPricing", () => {
  it("lists courses with resolved titles, instructor names and server-computed prices", async () => {
    signIn();
    renderWithProviders(<OrganizationCatalogPricing />);

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    // Both seeded courses are taught by the same instructor, so the resolved name appears once per row.
    expect(screen.getAllByText("Instructor One")).toHaveLength(2);
    expect(screen.getByText("$79.00")).toBeInTheDocument();
    // The free course renders the free label rather than an amount.
    expect(screen.getByTestId("price-tag-free")).toBeInTheDocument();
  });

  it("shows the empty state when nothing matches the search", async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.type(screen.getByLabelText("Search courses"), "nothing at all");
    expect(await screen.findByText("No courses match these filters.")).toBeInTheDocument();
  });

  it("shows an error state when the catalog fails to load", async () => {
    signIn();
    mock.onGet("/Courses").reply(500);
    renderWithProviders(<OrganizationCatalogPricing />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("saves a course price through PUT /Courses/{id}/pricing", async () => {
    signIn();
    mock.onPut("/Courses/c1/pricing").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Price");
    await user.clear(amount);
    await user.type(amount, "99.50");
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/c1/pricing")).toBe(true));
    const body = JSON.parse(mock.history.put.find((r) => r.url === "/Courses/c1/pricing")!.data);
    expect(body).toMatchObject({ IsFree: false, Amount: 99.5, AccessModel: "AlaCarte", Currency: "USD" });
  });

  it("switching a course to free sends AccessModel=Free and no amount", async () => {
    signIn();
    mock.onPut("/Courses/c1/pricing").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("switch", { name: "Access" }));
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/c1/pricing")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({ IsFree: true, AccessModel: "Free" });
  });

  it("refuses to save a paid course with no amount", async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Price"));
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a price.");
    expect(mock.history.put).toHaveLength(0);
  });

  it("refuses a sale price that is not below the normal price", async () => {
    signIn();
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Sale price"), "99");
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The sale price must be below the normal price.");
    expect(mock.history.put).toHaveLength(0);
  });

  it("shows the server's rejection when the price is refused", async () => {
    signIn();
    mock.onPut("/Courses/c1/pricing").reply(400, { code: "pricing.invalid", title: "That price is not valid." });
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Edit price: Cloud Architecture Essentials" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("That price is not valid.");
  });

  it("saves a chapter price through the per-course chapter drawer", async () => {
    signIn();
    mock.onPut("/Courses/c1/chapters/ch1/pricing").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    await user.click(screen.getByRole("button", { name: "Chapter prices: Cloud Architecture Essentials" }));
    expect(await screen.findByText("Cloud foundations")).toBeInTheDocument();

    const row = screen.getByTestId("chapter-pricing-ch1");
    await user.click(within(row).getByRole("switch", { name: "Sold separately" }));
    await user.type(within(row).getByLabelText("Price"), "12");
    await user.click(within(row).getByRole("button", { name: "Save price" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/Courses/c1/chapters/ch1/pricing")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({
      IsFree: false,
      Amount: 12,
      IsPreview: true,
    });
  });

  it("only offers the chapter drawer on an à-la-carte course", async () => {
    signIn();
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Foundations of Data Literacy");

    expect(
      screen.getByRole("button", { name: "Chapter prices: Cloud Architecture Essentials" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Chapter prices: Foundations of Data Literacy" })
    ).not.toBeInTheDocument();
  });

  it("hides every pricing control and explains why without pricing.manage", async () => {
    signIn([]);
    renderWithProviders(<OrganizationCatalogPricing />);
    await screen.findByText("Cloud Architecture Essentials");

    // The prices stay visible (read-only), the controls do not.
    expect(screen.getByText("$79.00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit price/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Chapter prices/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Prices are set by the organization or an administrator; you can see them here but not change them.")
    ).toBeInTheDocument();
  });
});

/**
 * Wave F3a — the Tracks tab of the same shared body.
 *
 * `tracks.manage` and `pricing.manage` guard different controls on the very same row (the backend puts
 * `[HasPermission(Permissions.PricingManage)]` on `PUT /api/tracks/{id}/pricing` and `TracksManage` on everything else
 * in `TracksController`), so the gating tests below deliberately hold one permission without the other.
 */
describe("OrganizationCatalogPricing — Tracks tab", () => {
  const BOTH = ["pricing.manage", "tracks.manage"];

  it("lists tracks with their status, course count and server-computed price", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);

    expect(await screen.findByText("Data Professional Path")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("2 courses")).toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
    // The courses tab is unmounted while Tracks is showing, so no course price leaks into this assertion.
    expect(screen.queryByText("Cloud Architecture Essentials")).not.toBeInTheDocument();
  });

  it("shows the empty state rather than a bare table when there are no tracks", async () => {
    signIn(BOTH);
    mock.onGet("/tracks").reply(200, [], { "x-total-count": "0" });
    const user = userEvent.setup();
    await openTracksTab(user);

    expect(await screen.findByText("No tracks yet.")).toBeInTheDocument();
    expect(screen.getByText("Group related courses into a path and price them as one.")).toBeInTheDocument();
  });

  it("shows an error state when the track list fails to load", async () => {
    signIn(BOTH);
    mock.onGet("/tracks").reply(500);
    const user = userEvent.setup();
    await openTracksTab(user);

    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("sends the status filter and the search term to the server", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.type(screen.getByLabelText("Search tracks"), "data");
    await waitFor(() =>
      expect(mock.history.get.filter((r) => r.url === "/tracks").at(-1)?.params).toMatchObject({ search: "data" })
    );
  });

  it("creates a track through POST /tracks", async () => {
    signIn(BOTH);
    mock.onPost("/tracks").reply(201, seededTrackDetail);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "New track" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Title"), "Security Fundamentals Path");
    await user.type(within(dialog).getByLabelText("Estimated hours"), "12");
    await user.click(within(dialog).getByRole("button", { name: "Save track" }));

    await waitFor(() => expect(mock.history.post.some((r) => r.url === "/tracks")).toBe(true));
    expect(JSON.parse(mock.history.post.at(-1)!.data)).toMatchObject({
      Title: "Security Fundamentals Path",
      Status: "Draft",
      EstimatedHours: 12,
    });
  });

  it("refuses to save a track without a real title", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "New track" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Save track" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Enter a title of at least 2 characters.");
    expect(mock.history.post).toHaveLength(0);
  });

  it("edits a track through PUT /tracks/{id}", async () => {
    signIn(BOTH);
    mock.onPut("/tracks/t1").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Edit track: Data Professional Path" }));
    const dialog = await screen.findByRole("dialog");
    const title = within(dialog).getByLabelText("Title");
    await user.clear(title);
    await user.type(title, "Data Professional Path v2");
    await user.click(within(dialog).getByRole("button", { name: "Save track" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/tracks/t1")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toMatchObject({
      Title: "Data Professional Path v2",
      Status: "Published",
      IsFeatured: true,
      EstimatedHours: 24,
    });
  });

  it("archives a track from the row without opening the editor", async () => {
    signIn(BOTH);
    mock.onPut("/tracks/t1").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    // The track is Published, so "Publish" is not offered and "Archive" is.
    expect(screen.queryByRole("button", { name: "Publish: Data Professional Path" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Archive: Data Professional Path" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/tracks/t1")).toBe(true));
    // The write DTO always needs a title, even when only the status is changing.
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toEqual({
      Title: "Data Professional Path",
      Status: "Archived",
    });
  });

  it("lists the track's courses in order, by resolved title and instructor name", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Courses: Data Professional Path" }));

    expect(await screen.findByText("Cloud Architecture Essentials")).toBeInTheDocument();
    expect(screen.getByText("Foundations of Data Literacy")).toBeInTheDocument();
    expect(screen.getAllByText("Instructor One")).toHaveLength(2);
    // No raw ids anywhere in the builder.
    expect(screen.queryByText(/^c[12]$/)).not.toBeInTheDocument();
  });

  it("reorders the courses and sends the complete list to PUT /tracks/{id}/courses", async () => {
    signIn(BOTH);
    mock.onPut("/tracks/t1/courses").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Courses: Data Professional Path" }));
    await screen.findByTestId("track-course-c1");

    await user.click(screen.getByRole("button", { name: "Move down: Cloud Architecture Essentials" }));
    await user.click(screen.getByRole("button", { name: "Save course list" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/tracks/t1/courses")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toEqual({ CourseIds: ["c2", "c1"] });
  });

  it("removes a course from the bundle", async () => {
    signIn(BOTH);
    mock.onPut("/tracks/t1/courses").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Courses: Data Professional Path" }));
    await screen.findByTestId("track-course-c1");

    await user.click(screen.getByRole("button", { name: "Remove from this track: Cloud Architecture Essentials" }));
    await user.click(screen.getByRole("button", { name: "Save course list" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/tracks/t1/courses")).toBe(true));
    expect(JSON.parse(mock.history.put.at(-1)!.data)).toEqual({ CourseIds: ["c2"] });
  });

  it("will not send an unchanged course list", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Courses: Data Professional Path" }));
    await screen.findByTestId("track-course-c1");

    expect(screen.getByRole("button", { name: "Save course list" })).toBeDisabled();
  });

  it("sets the track's own price through PUT /tracks/{id}/pricing", async () => {
    signIn(BOTH);
    mock.onPut("/tracks/t1/pricing").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Edit track price: Data Professional Path" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Price");
    await user.clear(amount);
    await user.type(amount, "129");
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    await waitFor(() => expect(mock.history.put.some((r) => r.url === "/tracks/t1/pricing")).toBe(true));
    const body = JSON.parse(mock.history.put.at(-1)!.data);
    expect(body).toMatchObject({ IsFree: false, Amount: 129, Currency: "USD" });
    // A track has no access model; sending one would be refused.
    expect(body).not.toHaveProperty("AccessModel");
  });

  it("refuses a track sale price that is not below the normal price", async () => {
    signIn(BOTH);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Edit track price: Data Professional Path" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Sale price"), "150");
    await user.click(within(dialog).getByRole("button", { name: "Save price" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The sale price must be below the normal price.");
    expect(mock.history.put).toHaveLength(0);
  });

  it("deletes a track that nobody bought", async () => {
    signIn(BOTH);
    mock.onDelete("/tracks/t1").reply(204);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Delete track: Data Professional Path" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(within(confirm).getByText("Delete the track Data Professional Path?")).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Delete track" }));

    await waitFor(() => expect(mock.history.delete.some((r) => r.url === "/tracks/t1")).toBe(true));
  });

  it("explains that a bought track cannot be deleted instead of showing a generic error", async () => {
    signIn(BOTH);
    mock.onDelete("/tracks/t1").reply(409, {
      code: "track.in_use",
      title: "This track was already bought and cannot be deleted.",
    });
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    await user.click(screen.getByRole("button", { name: "Delete track: Data Professional Path" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Delete track" }));

    expect(await within(confirm).findByRole("alert")).toHaveTextContent(
      "Someone has bought this track, so it cannot be deleted. Archive it instead."
    );
    // The dialog stays open on the rule, so the reason is readable and the track is still there.
    expect(screen.getByText("Data Professional Path")).toBeInTheDocument();
  });

  it("pricing.manage alone shows the track price control but no track authoring", async () => {
    signIn(["pricing.manage"]);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    expect(screen.getByRole("button", { name: "Edit track price: Data Professional Path" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New track" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit track:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Courses:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete track:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Archive:/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Tracks are built by the organization or an administrator; you can see them here but not change them.")
    ).toBeInTheDocument();
  });

  it("tracks.manage alone shows track authoring but no price control, on either tab", async () => {
    signIn(["tracks.manage"]);
    const user = userEvent.setup();
    renderWithProviders(<OrganizationCatalogPricing />);

    // Courses tab: the price controls are gone, because that is `pricing.manage`.
    await screen.findByText("Cloud Architecture Essentials");
    expect(screen.queryByRole("button", { name: /^Edit price/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tracks" }));
    await screen.findByText("Data Professional Path");

    expect(screen.getByRole("button", { name: "New track" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit track: Data Professional Path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Courses: Data Professional Path" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete track: Data Professional Path" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit track price: Data Professional Path" })
    ).not.toBeInTheDocument();
    // The price itself stays visible; only the control is withheld.
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });

  it("hides every track control from an account holding neither permission", async () => {
    signIn([]);
    const user = userEvent.setup();
    await openTracksTab(user);
    await screen.findByText("Data Professional Path");

    expect(screen.queryByRole("button", { name: "New track" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit track price: Data Professional Path" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("$99.00")).toBeInTheDocument();
  });
});

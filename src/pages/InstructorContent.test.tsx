import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import InstructorContent from "./InstructorContent";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

const courses = [
  { Id: "c1", Title: "Intro to Testing", InstructorId: "u1", Status: "Published", LessonsCount: 4, CreatedAt: "", UpdatedAt: "" },
];

const item = (id: string, name: string) => ({
  Id: id,
  Name: name,
  FileType: "pdf",
  Department: "General",
  CourseName: null,
  CourseId: "c1",
  CourseTitle: "Intro to Testing",
  FilePath: "/library/x.pdf",
  DownloadUrl: `/content-library/${id}/download`,
  FileSizeBytes: 2048,
  UploadedById: "u1",
  UploadedByName: "Me",
  CreatedAt: new Date().toISOString(),
});

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor", Permissions: ["content.view", "content.manage"] });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
  mock.onGet("/Courses/mine").reply(200, courses);
});
afterEach(() => mock.restore());

describe("InstructorContent", () => {
  it("lists content items from the library", async () => {
    mock.onGet("/content-library").reply(200, [item("f1", "Slides.pdf")]);
    renderWithProviders(<InstructorContent />);
    expect(await screen.findByText("Slides.pdf")).toBeInTheDocument();
    expect(screen.getByText("Intro to Testing")).toBeInTheDocument();
  });

  it("shows the empty state when there are no files", async () => {
    mock.onGet("/content-library").reply(200, []);
    renderWithProviders(<InstructorContent />);
    expect(await screen.findByText(/no files match/i)).toBeInTheDocument();
  });

  it("shows an error state when the list fails", async () => {
    mock.onGet("/content-library").reply(500);
    renderWithProviders(<InstructorContent />);
    expect(await screen.findByText(/server ran into a problem/i)).toBeInTheDocument();
  });

  it("uploads a file with the selected course", async () => {
    mock.onGet("/content-library").reply(200, []);
    mock.onPost("/content-library").reply(200, item("f2", "Notes.pdf"));
    const user = userEvent.setup();
    renderWithProviders(<InstructorContent />);

    await user.click(await screen.findByRole("button", { name: /upload new/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByText("Intro to Testing"));

    const file = new File(["hello"], "Notes.pdf", { type: "application/pdf" });
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);

    await user.click(within(dialog).getByRole("button", { name: /^upload$/i }));

    await waitFor(() => expect(mock.history.post.filter((r) => r.url === "/content-library")).toHaveLength(1));
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ title: "File uploaded" }));
  });

  it("surfaces a validation error when the upload fails", async () => {
    mock.onGet("/content-library").reply(200, []);
    mock.onPost("/content-library").reply(400, { code: "content.invalid", title: "Only PDF, images and video are allowed" });
    const user = userEvent.setup();
    renderWithProviders(<InstructorContent />);

    await user.click(await screen.findByRole("button", { name: /upload new/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(await screen.findByText("Intro to Testing"));

    const file = new File(["hello"], "Bad.pdf", { type: "application/pdf" });
    const fileInput = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(within(dialog).getByRole("button", { name: /^upload$/i }));

    expect(await screen.findByText("Only PDF, images and video are allowed")).toBeInTheDocument();
  });

  it("deletes an item after confirmation", async () => {
    mock.onGet("/content-library").reply(200, [item("f1", "Slides.pdf")]);
    mock.onDelete("/content-library/f1").reply(204);
    const user = userEvent.setup();
    renderWithProviders(<InstructorContent />);

    await screen.findByText("Slides.pdf");
    await user.click(screen.getByRole("button", { name: /more actions/i }));
    await user.click(await screen.findByText(/^delete$/i));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(mock.history.delete.filter((r) => r.url === "/content-library/f1")).toHaveLength(1));
  });
});

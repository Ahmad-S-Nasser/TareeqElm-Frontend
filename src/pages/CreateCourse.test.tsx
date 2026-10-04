import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MockAdapter from "axios-mock-adapter";
import api from "@/lib/api";
import CreateCourse from "./CreateCourse";
import { makeUser, renderWithProviders, seedSession } from "@/test/renderWithProviders";

vi.mock("@/components/layout/InstructorSidebar", () => ({
  InstructorSidebar: () => null,
  InstructorSidebarContent: () => null,
}));
vi.mock("@/components/layout/Header", () => ({ Header: () => null }));

const toastMock = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: toastMock }) }));

let mock: MockAdapter;
beforeEach(() => {
  toastMock.mockClear();
  mock = new MockAdapter(api);
  const user = makeUser({ Id: "u1", Role: "Instructor" });
  seedSession(user);
  mock.onGet("/Auth/me").reply(200, user);
});
afterEach(() => mock.restore());

describe("CreateCourse - cover image", () => {
  it("uploads and previews a cover image, then includes its URL when creating the course", async () => {
    mock.onPost("/Courses/upload").reply(200, { Url: "https://api.test/uploads/cover-abc.png", FileType: "image", SizeBytes: 1234, Name: "cover.png" });
    mock.onPost("/Courses").reply(201, { Id: "course-1", Title: "My Course", Status: "Draft" });
    const user = userEvent.setup();
    renderWithProviders(<CreateCourse />);

    await user.type(screen.getByPlaceholderText(/introduction to machine learning/i), "My Course");

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    const file = new File(["fake-bytes"], "cover.png", { type: "image/png" });
    await user.upload(fileInput, file);

    // The uploaded image now shows as a preview and the upload button switches to "Change Image".
    expect(await screen.findByRole("button", { name: /change image/i })).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://api.test/uploads/cover-abc.png");

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    expect(mock.history.post.some((r) => r.url === "/Courses")).toBe(true);
    const createBody = JSON.parse(mock.history.post.find((r) => r.url === "/Courses")!.data);
    expect(createBody.ImageUrl).toBe("https://api.test/uploads/cover-abc.png");
  });

  it("sends tags (Enter to add, click to remove, deduplicated) and non-blank outcomes when creating the course", async () => {
    mock.onPost("/Courses").reply(201, { Id: "course-1", Title: "My Course", Status: "Draft" });
    const user = userEvent.setup();
    renderWithProviders(<CreateCourse />);

    await user.type(screen.getByPlaceholderText(/introduction to machine learning/i), "My Course");

    const tagInput = screen.getByLabelText("Tags");
    await user.type(tagInput, "Excel{Enter}");
    await user.type(tagInput, "excel{Enter}"); // case-insensitive duplicate: ignored
    await user.type(tagInput, "Data{Enter}");
    await user.type(tagInput, "Temp{Enter}");
    expect(screen.getByTestId("course-tags")).toHaveTextContent("Temp");
    await user.click(screen.getByRole("button", { name: "Remove tag Temp" }));
    expect(screen.getByTestId("course-tags")).not.toHaveTextContent("Temp");

    await user.click(screen.getByRole("button", { name: /add outcome/i }));
    await user.type(screen.getByLabelText("Outcome 1"), "Read a chart");
    await user.click(screen.getByRole("button", { name: /add outcome/i }));
    await user.click(screen.getByRole("button", { name: /add outcome/i }));
    await user.type(screen.getByLabelText("Outcome 3"), "Clean data");
    await user.click(screen.getByRole("button", { name: /add outcome/i }));
    await user.click(screen.getByRole("button", { name: "Remove outcome 4" }));
    expect(screen.queryByLabelText("Outcome 4")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const createBody = JSON.parse(mock.history.post.find((r) => r.url === "/Courses")!.data);
    expect(createBody.Tags).toEqual(["Excel", "Data"]);
    expect(createBody.Outcomes).toEqual(["Read a chart", "Clean data"]); // the blank row is dropped
  });

  it("removing the preview clears the image before creating the course", async () => {
    mock.onPost("/Courses/upload").reply(200, { Url: "https://api.test/uploads/cover-abc.png", FileType: "image", SizeBytes: 1234, Name: "cover.png" });
    mock.onPost("/Courses").reply(201, { Id: "course-1", Title: "My Course", Status: "Draft" });
    const user = userEvent.setup();
    renderWithProviders(<CreateCourse />);

    await user.type(screen.getByPlaceholderText(/introduction to machine learning/i), "My Course");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(["fake-bytes"], "cover.png", { type: "image/png" }));
    await screen.findByRole("button", { name: /change image/i });

    await user.click(screen.getByRole("button", { name: /remove image/i }));
    expect(screen.getByRole("button", { name: /upload image/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^next$/i }));
    const createBody = JSON.parse(mock.history.post.find((r) => r.url === "/Courses")!.data);
    expect(createBody.ImageUrl).toBeNull();
  });
});

describe("CreateCourse - department", () => {
  it("offers the organization's departments and sends the chosen one when creating the course", async () => {
    mock.onGet("/Courses/departments").reply(200, [{ Id: "d-sci", Name: "Science" }, { Id: "d-art", Name: "Arts" }]);
    mock.onPost("/Courses").reply(201, { Id: "course-1", Title: "My Course", Status: "Draft" });
    const user = userEvent.setup();
    renderWithProviders(<CreateCourse />);

    await user.type(screen.getByPlaceholderText(/introduction to machine learning/i), "My Course");
    const picker = screen.getByRole("combobox", { name: "Department" });
    expect(picker).toHaveTextContent("No department");
    await user.click(picker);
    await user.click(await screen.findByRole("option", { name: "Science" }));

    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const createBody = JSON.parse(mock.history.post.find((r) => r.url === "/Courses")!.data);
    expect(createBody.DepartmentId).toBe("d-sci");
  });

  it("omits DepartmentId when no department is picked", async () => {
    mock.onGet("/Courses/departments").reply(200, [{ Id: "d-sci", Name: "Science" }]);
    mock.onPost("/Courses").reply(201, { Id: "course-1", Title: "My Course", Status: "Draft" });
    const user = userEvent.setup();
    renderWithProviders(<CreateCourse />);

    await user.type(screen.getByPlaceholderText(/introduction to machine learning/i), "My Course");
    await user.click(screen.getByRole("button", { name: /^next$/i }));

    const createBody = JSON.parse(mock.history.post.find((r) => r.url === "/Courses")!.data);
    expect(createBody).not.toHaveProperty("DepartmentId");
  });
});

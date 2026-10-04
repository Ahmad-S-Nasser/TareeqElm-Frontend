import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChapterList } from "./ChapterList";
import type { Chapter, Lesson } from "@/hooks/useCourseEditor";

const chapter = (over: Partial<Chapter> = {}): Chapter => ({
  Id: "ch1",
  Title: "Chapter 1",
  Lessons: [],
  ...over,
});

const lesson = (over: Partial<Lesson> = {}): Lesson => ({
  Id: "l1",
  Title: "Existing lesson",
  LessonType: "Reading",
  Content: "Existing content",
  ...over,
});

/** Expands the chapter's accordion item so its lessons and the "Add Lesson" trigger are queryable. */
const expandChapter = async (user: ReturnType<typeof userEvent.setup>, title = "Chapter 1") => {
  await user.click(screen.getByRole("button", { name: new RegExp(title, "i") }));
};

describe("ChapterList", () => {
  it("blocks saving a new lesson that has neither content nor a video and shows an inline message", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList chapters={[chapter()]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Add Lesson" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Lesson Title"), "New Lesson");
    // Default type is Video but no video was uploaded/pasted, and content is empty.
    await user.click(within(dialog).getByRole("button", { name: "Add Lesson" }));

    expect(await within(dialog).findByText("Add lesson content or a video before saving.")).toBeInTheDocument();
    expect(onUpdateChapters).not.toHaveBeenCalled();
  });

  it("adds a lesson once content is provided", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList chapters={[chapter()]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Add Lesson" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Lesson Title"), "New Lesson");
    await user.type(within(dialog).getByLabelText("Content / Description"), "Some lesson text");
    await user.click(within(dialog).getByRole("button", { name: "Add Lesson" }));

    expect(onUpdateChapters).toHaveBeenCalledTimes(1);
    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons).toHaveLength(1);
    expect(saved.Lessons[0]).toMatchObject({ Title: "New Lesson", Content: "Some lesson text" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the edit button pre-fills the dialog with the lesson's current values and saves an update in place", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    const existing = lesson({ Id: "l1", Title: "Existing lesson", Content: "Existing content", LessonType: "Reading" });
    render(<ChapterList chapters={[chapter({ Lessons: [existing] })]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Edit lesson" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Lesson Title")).toHaveValue("Existing lesson");
    expect(within(dialog).getByLabelText("Content / Description")).toHaveValue("Existing content");
    expect(within(dialog).getByRole("button", { name: "Save Changes" })).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Lesson Title"));
    await user.type(within(dialog).getByLabelText("Lesson Title"), "Renamed lesson");
    await user.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(onUpdateChapters).toHaveBeenCalledTimes(1);
    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons).toHaveLength(1); // updated in place, not appended
    expect(saved.Lessons[0]).toMatchObject({ Id: "l1", Title: "Renamed lesson", Content: "Existing content" });
  });

  it("blocks saving an edited lesson if content and video are both cleared", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    const existing = lesson({ Id: "l1", Content: "Existing content" });
    render(<ChapterList chapters={[chapter({ Lessons: [existing] })]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Edit lesson" }));
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Content / Description"));
    await user.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    expect(await within(dialog).findByText("Add lesson content or a video before saving.")).toBeInTheDocument();
    expect(onUpdateChapters).not.toHaveBeenCalled();
  });

  it("a new lesson defaults to PreRecorded delivery mode, which the save payload carries", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList chapters={[chapter()]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Add Lesson" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Lesson Title"), "New Lesson");
    await user.type(within(dialog).getByLabelText("Content / Description"), "Some lesson text");
    await user.click(within(dialog).getByRole("button", { name: "Add Lesson" }));

    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons[0]).toMatchObject({ DeliveryMode: "PreRecorded" });
  });

  it("selecting a Live-online delivery mode carries through to the saved lesson", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    render(<ChapterList chapters={[chapter()]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Add Lesson" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Lesson Title"), "New Lesson");
    await user.type(within(dialog).getByLabelText("Content / Description"), "Some lesson text");
    // Two comboboxes are present (lesson type, delivery mode); the delivery mode one is second.
    await user.click(within(dialog).getAllByRole("combobox")[1]);
    await user.click(await screen.findByText("Live online"));
    expect(within(dialog).getByText("Manage scheduled occurrences of this lesson from the organization calendar after saving.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add Lesson" }));

    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons[0]).toMatchObject({ DeliveryMode: "LiveOnline" });
  });

  it("the edit dialog pre-fills the lesson's current delivery mode and preserves it if untouched", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    const existing = lesson({ Id: "l1", DeliveryMode: "Offline" });
    render(<ChapterList chapters={[chapter({ Lessons: [existing] })]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Edit lesson" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("combobox")[1]).toHaveTextContent("In-person");

    await user.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons[0]).toMatchObject({ DeliveryMode: "Offline" });
  });

  it("deletes a lesson", async () => {
    const onUpdateChapters = vi.fn();
    const user = userEvent.setup();
    const existing = lesson({ Id: "l1" });
    render(<ChapterList chapters={[chapter({ Lessons: [existing] })]} onUpdateChapters={onUpdateChapters} onUploadMedia={vi.fn()} />);

    await expandChapter(user);
    await user.click(screen.getByRole("button", { name: "Delete lesson" }));

    expect(onUpdateChapters).toHaveBeenCalledTimes(1);
    const [saved] = onUpdateChapters.mock.calls[0][0] as Chapter[];
    expect(saved.Lessons).toHaveLength(0);
  });
});

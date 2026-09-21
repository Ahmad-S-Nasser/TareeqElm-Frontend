import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileText, Sparkles, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { InstructorSidebar, InstructorSidebarContent } from "@/components/layout/InstructorSidebar";
import { Header } from "@/components/layout/Header";
import { FileDropzone } from "@/components/syllabus/FileDropzone";
import { ParsingProgress } from "@/components/syllabus/ParsingProgress";
import { CourseOutlinePreview } from "@/components/syllabus/CourseOutlinePreview";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type UploadState = "idle" | "parsing" | "preview";

const SyllabusUpload = () => {
  const { t } = useTranslation("instructor");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  // Mock course outline data
  const mockCourseOutline = {
    courseName: t("syllabus.mock.courseName"),
    chapters: [
      {
        id: "ch1",
        title: "Fundamentals of Testing",
        estimatedMinutes: 180,
        topics: [
          { id: "t1", title: "What is Testing?", durationMinutes: 25, hasQuiz: true, hasFlashcards: true },
          { id: "t2", title: "Why is Testing Necessary?", durationMinutes: 30, hasQuiz: true, hasFlashcards: true },
          { id: "t3", title: "Testing Principles", durationMinutes: 35, hasQuiz: true, hasFlashcards: true },
          { id: "t4", title: "Test Process", durationMinutes: 40, hasQuiz: true, hasFlashcards: false },
          { id: "t5", title: "Psychology of Testing", durationMinutes: 20, hasQuiz: false, hasFlashcards: true },
        ],
      },
      {
        id: "ch2",
        title: "Testing Throughout the Software Lifecycle",
        estimatedMinutes: 240,
        topics: [
          { id: "t6", title: "Software Development Models", durationMinutes: 45, hasQuiz: true, hasFlashcards: true },
          { id: "t7", title: "Test Levels", durationMinutes: 50, hasQuiz: true, hasFlashcards: true },
          { id: "t8", title: "Test Types", durationMinutes: 40, hasQuiz: true, hasFlashcards: true },
          { id: "t9", title: "Maintenance Testing", durationMinutes: 25, hasQuiz: true, hasFlashcards: false },
        ],
      },
      {
        id: "ch3",
        title: "Static Testing",
        estimatedMinutes: 150,
        topics: [
          { id: "t10", title: "Static Testing Basics", durationMinutes: 30, hasQuiz: true, hasFlashcards: true },
          { id: "t11", title: "Review Process", durationMinutes: 45, hasQuiz: true, hasFlashcards: true },
          { id: "t12", title: "Review Types", durationMinutes: 35, hasQuiz: true, hasFlashcards: false },
        ],
      },
      {
        id: "ch4",
        title: "Test Design Techniques",
        estimatedMinutes: 300,
        topics: [
          { id: "t13", title: "Categories of Test Techniques", durationMinutes: 20, hasQuiz: false, hasFlashcards: true },
          { id: "t14", title: "Black-box Test Techniques", durationMinutes: 60, hasQuiz: true, hasFlashcards: true },
          { id: "t15", title: "White-box Test Techniques", durationMinutes: 45, hasQuiz: true, hasFlashcards: true },
          { id: "t16", title: "Experience-based Techniques", durationMinutes: 30, hasQuiz: true, hasFlashcards: true },
        ],
      },
      {
        id: "ch5",
        title: "Test Management",
        estimatedMinutes: 240,
        topics: [
          { id: "t17", title: "Test Organization", durationMinutes: 35, hasQuiz: true, hasFlashcards: true },
          { id: "t18", title: "Test Planning and Estimation", durationMinutes: 50, hasQuiz: true, hasFlashcards: true },
          { id: "t19", title: "Test Monitoring and Control", durationMinutes: 40, hasQuiz: true, hasFlashcards: false },
          { id: "t20", title: "Configuration Management", durationMinutes: 25, hasQuiz: false, hasFlashcards: true },
          { id: "t21", title: "Risk and Testing", durationMinutes: 45, hasQuiz: true, hasFlashcards: true },
        ],
      },
    ],
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setUploadState("parsing");
  };

  const handleParsingComplete = () => {
    setUploadState("preview");
  };

  const handleConfirm = () => {
    toast({
      title: t("syllabus.courseCreated"),
      description: t("syllabus.courseCreatedDesc"),
    });
  };

  const handleEdit = () => {
    toast({
      title: t("syllabus.editMode"),
      description: t("syllabus.editModeDesc"),
    });
  };

  const handleReset = () => {
    setUploadState("idle");
    setSelectedFile(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <InstructorSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        userRole="Instructor"
        mobileSidebar={<InstructorSidebarContent />}
      />

      <main className={cn(
        "pt-20 pb-12 px-4 sm:px-6 transition-all duration-300",
        sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
        "ms-0"
      )}>
        <div className="max-w-4xl mx-auto">
          {/* Back Button */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
            {t("syllabus.backToDashboard")}
          </Link>

          {/* Page Header */}
          <div className="mb-8 animate-slide-up">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow-primary">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{t("syllabus.title")}</h1>
                <p className="text-muted-foreground">
                  {t("syllabus.subtitle")}
                </p>
              </div>
            </div>
          </div>

          {/* Content based on state */}
          <div className="space-y-6">
            {uploadState === "idle" && (
              <>
                {/* Upload Area */}
                <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
                  <FileDropzone onFileSelect={handleFileSelect} />
                </div>

                {/* Info Cards */}
                <div className="grid md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: "200ms" }}>
                  <div className="rounded-2xl bg-card border border-border/50 shadow-card p-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-accent/10">
                        <Sparkles className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">{t("syllabus.aiAnalysis")}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("syllabus.aiAnalysisDesc")}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-card border border-border/50 shadow-card p-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <HelpCircle className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium mb-1">{t("syllabus.formats")}</h3>
                        <p className="text-sm text-muted-foreground">
                          {t("syllabus.formatsDesc")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {uploadState === "parsing" && (
              <ParsingProgress
                isActive={true}
                onComplete={handleParsingComplete}
              />
            )}

            {uploadState === "preview" && (
              <>
                <CourseOutlinePreview
                  courseName={mockCourseOutline.courseName}
                  chapters={mockCourseOutline.chapters}
                  onConfirm={handleConfirm}
                  onEdit={handleEdit}
                />

                {/* Reset Button */}
                <div className="flex justify-center">
                  <Button
                    variant="ghost"
                    onClick={handleReset}
                    className="text-muted-foreground"
                  >
                    {t("syllabus.uploadDifferent")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SyllabusUpload;

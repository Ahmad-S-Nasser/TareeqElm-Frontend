import { useState, useEffect } from "react";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { useCourses, CourseWithEnrollment } from "@/hooks/useCourses";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Clock,
  Users,
  Search,
  CheckCircle2,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useFormatters } from "@/lib/format";
import { PriceTag } from "@/components/billing";
import { isPaidCourse } from "@/components/courses";
import { checkoutHref } from "@/lib/checkoutLink";
import { useCourseDepartmentOptions, ALL_DEPARTMENTS } from "@/hooks/useDepartments";

const CourseCatalog = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS);
  const { data: departments = [] } = useCourseDepartmentOptions();
  const [activeTab, setActiveTab] = useState("browse");
  const navigate = useNavigate();
  const { t } = useTranslation("courses");
  const { t: tBilling } = useTranslation("billing");
  const { formatNumber, formatPercent } = useFormatters();

  const {
    courses,
    loading,
    fetchPublishedCourses,
    fetchEnrolledCourses,
    enrollInCourse,
  } = useCourses();

  const [enrollingId, setEnrollingId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === "browse") {
      fetchPublishedCourses();
    } else {
      fetchEnrolledCourses();
    }
  }, [activeTab, fetchPublishedCourses, fetchEnrolledCourses]);

  const handleEnroll = async (courseId: string) => {
    setEnrollingId(courseId);
    await enrollInCourse(courseId, courses.find((c) => c.Id === courseId)?.Title);
    setEnrollingId(null);

    // If successful, the hook's 'courses' state will be refreshed automatically
    // by fetchPublishedCourses call inside enrollInCourse.
  };

  const currentCourses = courses;

  const filteredCourses = currentCourses.filter((course) => {
    const matchesSearch =
      course.Title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.Description && course.Description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesLevel = levelFilter === "all" || course.Level?.toLowerCase() === levelFilter.toLowerCase();
    // Both tabs' lists (the published catalog and "my courses") come from useCourses and carry DepartmentId, so this
    // filters in place like Level does.
    const matchesDepartment = departmentFilter === ALL_DEPARTMENTS || course.DepartmentId === departmentFilter;
    return matchesSearch && matchesLevel && matchesDepartment;
  });

  const renderCourseCard = (course: CourseWithEnrollment) => {
    const isEnrolled = !!course.Enrollment;
    // A paid course the trainer does not own is never enrolled from here — POST /api/Enrollments answers
    // 403 enrollment.purchase_required by design. It sends them to checkout instead.
    const isPaid = isPaidCourse(course.AccessModel, course.Pricing);
    const mustBuy = isPaid && !course.Owned && !isEnrolled;

    return (
      <Card
        key={course.Id}
        className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
        onClick={() => isEnrolled && navigate(`/courses/${course.Id}`)}
      >
        <div className="h-36 bg-gradient-to-br from-primary/20 to-accent/20 relative overflow-hidden">
          {course.ImageUrl && (
            <img
              src={course.ImageUrl}
              alt={course.Title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          )}
          {isEnrolled && (
            <div className="absolute top-3 end-3">
              <Badge className="bg-success text-white">
                <CheckCircle2 className="w-3 h-3 me-1" />
                {t("catalog.enrolled")}
              </Badge>
            </div>
          )}
        </div>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {course.Title}
            </CardTitle>
          </div>
          {course.Category && (
            <Badge variant="outline" className="w-fit">
              {course.Category}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground line-clamp-2">
            {course.Description || t("catalog.noDescription")}
          </p>

          {isEnrolled && course.Enrollment && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("catalog.progress")}</span>
                <span className="font-medium">{formatPercent(course.Enrollment.ProgressPercentage)}</span>
              </div>
              <Progress value={course.Enrollment.ProgressPercentage} className="h-2" />
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{t("hoursShort", { value: formatNumber(course.DurationHours || 0) })}</span>
              </div>
              <Badge variant="secondary">
                {course.Level ? t(`level.${course.Level.toLowerCase()}`, { defaultValue: course.Level }) : ""}
              </Badge>
              {isPaid && (
                <PriceTag pricing={course.Pricing} owned={course.Owned} size="sm" showFree={false} hideSaleBadge />
              )}
            </div>

            {mustBuy ? (
              <Button size="sm" asChild onClick={(e) => e.stopPropagation()}>
                <Link to={checkoutHref("Course", course.Id)}>{tBilling("price.buyNow")}</Link>
              </Button>
            ) : !isEnrolled ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEnroll(course.Id);
                }}
                disabled={enrollingId === course.Id}
              >
                {enrollingId === course.Id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t("catalog.enroll")
                )}
              </Button>
            ) : null}

            {isEnrolled && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/courses/${course.Id}`);
                }}
              >
                {t("catalog.continue")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <ApplicantSidebar onCollapse={setSidebarCollapsed} />
      <Header
        sidebarCollapsed={sidebarCollapsed}
        mobileSidebar={<ApplicantSidebarContent onItemClick={() => console.log('Mobile sidebar clicked')} />}
      />

      <main
        className={cn(
          "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64",
          "ms-0"
        )}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-2xl font-bold">{t("catalog.title")}</h1>
              </div>
              <p className="text-muted-foreground">
                {t("catalog.subtitle")}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <TabsList>
                <TabsTrigger value="browse">
                  <BookOpen className="w-4 h-4 me-2" />
                  {t("catalog.browseTab")}
                </TabsTrigger>
                <TabsTrigger value="enrolled">
                  <CheckCircle2 className="w-4 h-4 me-2" />
                  {t("catalog.myCoursesTab")}
                </TabsTrigger>
              </TabsList>

              {/* Filters */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="ps-9 w-64"
                  />
                </div>
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder={t("list.level")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("catalog.allLevels")}</SelectItem>
                    <SelectItem value="beginner">{t("level.beginner")}</SelectItem>
                    <SelectItem value="intermediate">{t("level.intermediate")}</SelectItem>
                    <SelectItem value="advanced">{t("level.advanced")}</SelectItem>
                  </SelectContent>
                </Select>
                {departments.length > 0 && (
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-44" aria-label={t("list.department")}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_DEPARTMENTS}>{t("list.allDepartments")}</SelectItem>
                      {departments.map((d) => <SelectItem key={d.Id} value={d.Id}>{d.Name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <TabsContent value="browse" className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredCourses.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t("list.noneFound")}</h3>
                    <p className="text-muted-foreground">
                      {t("list.adjustFilters")}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map(renderCourseCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="enrolled" className="mt-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : filteredCourses.length === 0 ? (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center text-center">
                    <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">{t("catalog.noEnrolled")}</h3>
                    <p className="text-muted-foreground mb-4">
                      {t("catalog.noEnrolledHint")}
                    </p>
                    <Button onClick={() => setActiveTab("browse")}>
                      {t("catalog.browseTab")}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredCourses.map(renderCourseCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default CourseCatalog;

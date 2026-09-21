import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApplicantSidebar, ApplicantSidebarContent } from "@/components/layout/ApplicantSidebar";
import { Header } from "@/components/layout/Header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Trophy, BookOpen, Award, TrendingUp, Flame, Loader2, AlertCircle } from "lucide-react";
import { useTrainerStats } from "@/hooks/useTrainerStats";
import { useAchievements } from "@/hooks/useAchievements";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, AreaChart, Area, CartesianGrid } from "recharts";

const TrainerProgress = () => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    const navigate = useNavigate();
    const { stats, loading: statsLoading, error: statsError } = useTrainerStats();
    const { earned, totalXP, loading: achievementsLoading } = useAchievements();
    const loading = statsLoading || achievementsLoading;
    const recentAchievements = earned.slice(0, 4);

    return (
        <div className="min-h-screen bg-background">
            <ApplicantSidebar onCollapse={setSidebarCollapsed} />
            <Header
                sidebarCollapsed={sidebarCollapsed}
                userRole="Trainer"
                mobileSidebar={<ApplicantSidebarContent />}
            />

            <main className={cn(
                "pt-20 pb-8 px-4 sm:px-6 transition-all duration-300",
                sidebarCollapsed ? "lg:ml-20" : "lg:ml-64",
                "ml-0"
            )}>
                <div className="max-w-7xl mx-auto space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold">My Progress</h1>
                        <p className="text-muted-foreground mt-1">Track your learning journey and achievements</p>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                            <p className="text-muted-foreground">Loading your progress...</p>
                        </div>
                    ) : statsError || !stats ? (
                        <div className="text-center py-24">
                            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                            <p className="font-medium mb-1">Could not load your progress</p>
                            <p className="text-sm text-muted-foreground">{statsError}</p>
                        </div>
                    ) : (<>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                        <Clock className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Study Time</p>
                                        <h3 className="text-2xl font-bold">{Math.floor(stats.totalStudyTime / 60)}h {stats.totalStudyTime % 60}m</h3>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                        <BookOpen className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Lessons Completed</p>
                                        <h3 className="text-2xl font-bold">{stats.lessonsCompleted}</h3>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                        <Flame className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Current Streak</p>
                                        <h3 className="text-2xl font-bold">{stats.currentStreak} Days</h3>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                        <Trophy className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Total Points</p>
                                        <h3 className="text-2xl font-bold">{totalXP}</h3>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Weekly Activity Chart */}
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-primary" />
                                    Weekly Activity
                                </CardTitle>
                                <CardDescription>Your study time over the last 7 days (minutes)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={stats.weeklyActivity}>
                                            <defs>
                                                <linearGradient id="colorMinutes" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                            <XAxis dataKey="day" axisLine={false} tickLine={false} />
                                            <YAxis axisLine={false} tickLine={false} />
                                            <Tooltip
                                                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1 }}
                                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="minutes"
                                                stroke="hsl(var(--primary))"
                                                fillOpacity={1}
                                                fill="url(#colorMinutes)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Recent Achievements */}
                        <Card className="lg:col-span-1">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-yellow-500" />
                                    Recent Achievements
                                </CardTitle>
                                <CardDescription>Badges you've earned recently</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {recentAchievements.length === 0 && (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        No badges earned yet. Keep studying to unlock your first one!
                                    </p>
                                )}
                                {recentAchievements.map(achievement => (
                                    <div key={achievement.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                                        <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0 shadow-sm text-yellow-500 text-lg">
                                            {achievement.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{achievement.title}</p>
                                            <p className="text-xs text-muted-foreground truncate">{achievement.description}</p>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full text-xs" onClick={() => navigate("/achievements")}>View All Achievements</Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Course Progress List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Course Progress Details</CardTitle>
                            <CardDescription>Detailed breakdown of your enrolled courses</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {stats.courses.length === 0 && (
                                    <div className="text-center py-6">
                                        <p className="text-sm text-muted-foreground mb-3">You are not enrolled in any courses yet.</p>
                                        <Button variant="outline" size="sm" onClick={() => navigate("/courses")}>Browse courses</Button>
                                    </div>
                                )}
                                {stats.courses.map(course => (
                                    <div key={course.id} className="space-y-3">
                                        <div className="flex justify-between items-center sm:flex-row flex-col sm:gap-0 gap-2">
                                            <div>
                                                <h4 className="font-semibold">{course.title}</h4>
                                                <p className="text-xs text-muted-foreground">Enrolled {new Date(course.enrolledAt).toLocaleDateString()}</p>
                                            </div>
                                            <span className="font-mono font-medium bg-secondary px-2 py-1 rounded text-xs">
                                                {course.progress}% Completed
                                            </span>
                                        </div>
                                        <div className="space-y-1">
                                            <Progress value={course.progress} className="h-2" />
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>{course.completedLessons} of {course.totalLessons} lessons completed</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    </>)}
                </div>
            </main>
        </div>
    );
};

export default TrainerProgress;

import { BookOpen, Clock, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface CourseCardProps {
  Title: string;
  Description: string;
  Progress: number;
  Duration: string;
  Lessons: number;
  Image?: string;
  variant?: "default" | "featured";
  onClick?: () => void;
}

export const CourseCard = ({
  Title,
  Description,
  Progress: progressValue,
  Duration,
  Lessons,
  Image,
  variant = "default",
  onClick,
}: CourseCardProps) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl bg-card border border-border/50 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-1",
        variant === "featured" && "md:col-span-2",
        onClick && "cursor-pointer"
      )}
    >
      {/* Image/Gradient Header */}
      <div className={cn(
        "relative h-32 overflow-hidden",
        variant === "featured" && "h-40"
      )}>
        {Image ? (
          <img 
            src={Image} 
            alt={Title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full gradient-primary" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
        
        {/* Progress Badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full glass text-xs font-medium">
          <BarChart3 className="w-3.5 h-3.5" />
          {progressValue}%
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-semibold text-lg text-foreground mb-1 line-clamp-1">
          {Title}
        </h3>
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {Description}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{Lessons} lessons</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{Duration}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

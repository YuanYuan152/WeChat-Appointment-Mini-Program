import { Progress } from "@/components/ui/progress";

interface QuizProgressProps {
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  const percent = total > 0 ? ((current + 1) / total) * 100 : 0;

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">答题进度</span>
        <span className="font-medium">
          {current + 1} / {total}
        </span>
      </div>
      <Progress value={percent} />
    </div>
  );
}

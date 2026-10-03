import { useTheme } from "@/context/ThemeContext";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Moon, Sun } from "lucide-react";

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="relative h-9 w-9 p-0 flex items-center justify-center transition-colors hover:bg-accent"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform duration-300 dark:-rotate-90 dark:scale-0 text-amber-500" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform duration-300 dark:rotate-0 dark:scale-100 text-slate-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{isDark ? "Switch to light mode" : "Switch to dark mode"}</p>
      </TooltipContent>
    </Tooltip>
  );
};

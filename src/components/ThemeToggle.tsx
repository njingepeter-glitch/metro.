import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
  variant?: "default" | "nav";
}

export const ThemeToggle = ({ variant = "default" }: ThemeToggleProps) => {
  const { theme, setTheme } = useTheme();

  if (variant === "nav") {
    return (
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-muted transition-all group"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted group-hover:bg-primary transition-colors">
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground" />
            )}
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground group-hover:text-foreground">
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-full h-10 w-10 flex items-center justify-center transition-colors bg-muted hover:bg-muted/80 group relative"
    >
      <Sun className="h-5 w-5 text-foreground rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 text-foreground rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </button>
  );
};

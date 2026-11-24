import {
  Sword,
  Swords,
  Skull,
  ChefHat,
  Sparkles,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";

const ICON_MAP: Record<string, LucideIcon> = {
  Sword,
  Swords,
  Skull,
  ChefHat,
  Sparkles,
  MoreHorizontal,
};

export function getIcon(name: string | null): LucideIcon {
  return (name && ICON_MAP[name]) || MoreHorizontal;
}

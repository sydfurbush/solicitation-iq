import { ReactNode, Children } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
}

/**
 * Lightweight staggered list using CSS animation tokens. No framer-motion dep.
 */
export function AnimatedList({ children, className, itemClassName }: Props) {
  return (
    <ul className={className}>
      {Children.map(children, (child, i) => (
        <li
          className={cn("animate-fade-in", itemClassName)}
          style={{ animationDelay: `${Math.min(i * 40, 400)}ms`, animationFillMode: "backwards" }}
        >
          {child}
        </li>
      ))}
    </ul>
  );
}

export default AnimatedList;

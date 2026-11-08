import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        secondary: "bg-surface text-foreground border border-input shadow-card hover:bg-accent",
        outline: "border border-input bg-transparent hover:bg-accent",
        ghost: "hover:bg-accent text-foreground",
        subtle: "bg-accent text-foreground hover:bg-border/70",
        danger: "bg-danger text-white shadow-sm hover:bg-danger/90",
        "danger-ghost": "text-danger-text hover:bg-danger-soft",
        link: "text-primary underline-offset-4 hover:underline h-auto px-0",
      },
      size: {
        default: "h-8 px-3",
        sm: "h-7 px-2.5 text-xs [&_svg]:size-3.5",
        lg: "h-10 px-4 text-sm",
        xl: "h-14 px-6 text-base [&_svg]:size-5",
        icon: "h-8 w-8",
        "icon-sm": "h-7 w-7 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...(asChild ? {} : { type })}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

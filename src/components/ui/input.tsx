import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "w-full min-w-0 py-1 transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "rounded-lg border border-input bg-transparent px-2.5 focus-visible:border-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 disabled:bg-input/50 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        underline:
          "rounded-t-sm border-0 border-b border-input bg-muted/30 px-2.5 focus-visible:border-b-2 focus-visible:border-primary focus-visible:bg-muted/40 disabled:border-dashed disabled:bg-muted/20 aria-invalid:border-b-2 aria-invalid:border-destructive",
        "l-border":
          "rounded-none border-0 border-b border-primary/50 bg-transparent px-2 focus-visible:border-b-2 focus-visible:border-primary focus-visible:outline-none disabled:opacity-50 aria-invalid:border-b-2 aria-invalid:border-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Input({
  className,
  variant = "default",
  type,
  style,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      style={{ height: 'var(--ui-field-height)', fontSize: 'var(--ui-input)', ...style }}
      className={cn(
        inputVariants({ variant }),
        type === 'number' && '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
        className,
      )}
      {...props}
    />
  )
}

export { Input, inputVariants }

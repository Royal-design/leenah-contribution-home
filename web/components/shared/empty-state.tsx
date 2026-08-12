import { Inbox } from "lucide-react"

import { Button } from "@/components/ui/button"

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: {
    label: string
    onAction: () => void
  }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" aria-hidden="true" />
      </div>
      <h3 className="mt-2 text-sm font-medium">{title}</h3>
      {description && (
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button variant="outline" size="sm" className="mt-3" onClick={action.onAction}>
          {action.label}
        </Button>
      )}
    </div>
  )
}
"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { useBulkCreateUsers } from "@/hooks/queries/use-admin"
import type { Role } from "@/types"

export function BulkUploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const bulkCreate = useBulkCreateUsers()
  const [raw, setRaw] = React.useState("")
  const [parseError, setParseError] = React.useState<string | null>(null)

  function onOpenChangeSafe(open: boolean) {
    if (!open) {
      setRaw("")
      setParseError(null)
    }
    onOpenChange(open)
  }

  function parse(entry: string) {
    const cells = entry
      .split(",")
      .map((cell) => cell.trim())
      .filter(Boolean)

    const [first, ...rest] = cells
    if (!first || rest.length < 1) {
      throw new Error(`Missing fields in "${entry}".`)
    }

    return {
      firstName: first,
      lastName: rest[0],
      email: rest[1],
      role: (rest[2] as Role | undefined) ?? "user",
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setParseError(null)

    const entries = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (entries.length === 0) {
      setParseError("Paste at least one user line to continue.")
      return
    }

    const parsed: Array<{ firstName: string; lastName: string; email: string; role: Role }> = []
    for (const entry of entries) {
      try {
        parsed.push(parse(entry))
      } catch (error) {
        setParseError(error instanceof Error ? error.message : "Invalid row.")
        return
      }
    }

    bulkCreate.mutate(parsed, {
      onSuccess: (created) => {
        onOpenChangeSafe(false)
        if (created.length === 0) {
          toast.info("No new users added — all emails already existed.")
        }
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChangeSafe}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk upload users</DialogTitle>
          <DialogDescription>
            Paste one user per line in the format{" "}
            <span className="font-medium text-foreground">
              First name, Last name, email, role
            </span>
            . Role is optional and defaults to user.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="bulk-users">Users</FieldLabel>
              <Textarea
                id="bulk-users"
                rows={10}
                placeholder={
                  "Ngozi, Eze, ngozi.eze@gmail.com, user\nTunde, Balogun, tunde@example.com, admin"
                }
                value={raw}
                onChange={(event) => setRaw(event.target.value)}
                aria-invalid={!!parseError}
                className="font-mono text-xs"
              />
              <FieldError errors={parseError ? [{ message: parseError }] : []} />
              <FieldDescription>
                Duplicate emails are skipped automatically.
              </FieldDescription>
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            size="lg"
            disabled={bulkCreate.isPending}
          >
            {bulkCreate.isPending ? "Uploading…" : "Upload users"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
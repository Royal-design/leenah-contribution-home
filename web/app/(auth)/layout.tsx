import Image from "next/image"

import { Brand } from "@/components/shared/brand"

export const metadata = {
  title: "Welcome",
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <Image
          src="/images/auth/auth-cover.svg"
          alt="LCH contribution and savings illustration"
          fill
          priority
          sizes="(max-width: 1024px) 0vw, 50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/25 to-transparent p-12">
          <p className="max-w-md text-2xl font-semibold leading-snug text-white">
            Build better financial habits, together.
          </p>
          <p className="mt-3 max-w-md text-sm text-white/80">
            Contribute in circles, grow your savings, and track every naira —
            all in one place.
          </p>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex h-16 items-center px-6 sm:px-10">
          <Brand href="/" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  )
}
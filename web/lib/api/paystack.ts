const PAYSTACK_SCRIPT_URL = "https://js.paystack.co/v1/inline.js"

let scriptLoaded = false

export function loadPaystackScript(): Promise<void> {
  if (scriptLoaded || typeof window === "undefined") {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${PAYSTACK_SCRIPT_URL}"]`)) {
      scriptLoaded = true
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = PAYSTACK_SCRIPT_URL
    script.async = true
    script.onload = () => {
      scriptLoaded = true
      resolve()
    }
    script.onerror = () => reject(new Error("Failed to load Paystack script"))
    document.head.appendChild(script)
  })
}

interface PaystackHandler {
  open: (config: PaystackConfig) => void
}

interface PaystackConfig {
  key: string
  email: string
  amount: number
  currency?: string
  ref?: string
  callback?: (response: PaystackCallback) => void
  onClose?: () => void
  metadata?: Record<string, unknown>
}

interface PaystackCallback {
  reference: string
  trans: string
  status: string
  message: string
  transaction: string
  trxref: string
}

declare global {
  interface Window {
    PaystackPop?: {
      new (): PaystackHandler
    }
  }
}

export interface InitializeCheckoutOptions {
  publicKey: string
  email: string
  amount: number
  currency?: string
  reference: string
  metadata?: Record<string, unknown>
  onSuccess?: (reference: string) => void
  onClose?: () => void
}

export async function openPaystackCheckout(options: InitializeCheckoutOptions): Promise<void> {
  await loadPaystackScript()

  if (!window.PaystackPop) {
    throw new Error("Paystack script not loaded")
  }

  const handler = new window.PaystackPop()

  handler.open({
    key: options.publicKey,
    email: options.email,
    amount: options.amount * 100, // kobo
    currency: options.currency ?? "NGN",
    ref: options.reference,
    metadata: options.metadata,
    callback: (response) => {
      options.onSuccess?.(response.reference)
    },
    onClose: () => {
      options.onClose?.()
    },
  })
}

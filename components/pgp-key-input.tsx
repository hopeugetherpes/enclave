"use client"

import { useEffect, useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { inspectPGPKey, MAX_PGP_KEY_LENGTH } from "@/lib/crypto"

interface PGPKeyInputProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  keyKind: "public" | "private"
}

export function PGPKeyInput({ value, onChange, disabled, placeholder, keyKind }: PGPKeyInputProps) {
  const [keyInfo, setKeyInfo] = useState<{ fingerprint: string; identity: string } | null>(null)
  const [isInvalid, setIsInvalid] = useState(false)

  useEffect(() => {
    setKeyInfo(null)
    setIsInvalid(false)
    if (!value.trim()) return

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const info = await inspectPGPKey(value, keyKind)
        if (!cancelled) setKeyInfo(info)
      } catch {
        if (!cancelled) setIsInvalid(true)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [keyKind, value])

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={MAX_PGP_KEY_LENGTH}
        aria-invalid={isInvalid}
        className="font-mono text-sm min-h-[200px]"
      />
      <div className="text-xs text-muted-foreground" aria-live="polite">
        {isInvalid && (
          <p className="text-red-500">
            This {keyKind} PGP key is invalid{keyKind === "public" ? ", expired, revoked, or cannot encrypt" : ""}.
          </p>
        )}
        {keyInfo && (
          <div className="space-y-1 break-words">
            <p>Identity: {keyInfo.identity}</p>
            <p className="font-mono">Fingerprint: {keyInfo.fingerprint}</p>
            {keyKind === "public" && (
              <p className="text-amber-700 dark:text-amber-400">
                Verify this fingerprint with the recipient through a trusted channel before encrypting.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

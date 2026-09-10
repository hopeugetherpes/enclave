"use client"

import { useState } from "react"
import { Shield, Lock, Key, Info, Mail } from "lucide-react"
import { EncryptionTab } from "@/components/encryption-tab"
import { DecryptionTab } from "@/components/decryption-tab"
import { AboutDialog } from "@/components/about-dialog"

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"encrypt" | "decrypt">("encrypt")
  const [showAbout, setShowAbout] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <a
        href="https://sfrwbkt.anatole.co"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full bg-neutral-600 px-4 py-2 text-center text-sm font-medium leading-5 text-white transition-colors hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        Safari and browsers used on iPhone have a limited experience (single file, 1 GB) due to Apple&apos;s restrictions.
      </a>

      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-bold text-xl">🔒 Enclave</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://pgp.anatole.co"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="PGP email"
              aria-label="Open PGP email"
            >
              <Mail width={16} height={16} aria-hidden="true" />
            </a>
            <button
              type="button"
              onClick={() => setShowAbout(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Info className="w-4 h-4" />
              About
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold mb-3 text-balance">Secure File Encryption</h2>
          <div className="text-muted-foreground text-lg space-y-1">
            <p>Encrypt and decrypt any file locally</p>
            <p>No application-imposed file limit. Your files and passwords never leave your device</p>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-8 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground mb-1">100% Client-Side Processing</p>
            <p className="text-muted-foreground">
              Encryption and decryption happen in your browser with Libsodium. Files and passwords are never uploaded,
              stored, or transmitted to a server.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-muted rounded-lg p-1 flex gap-1 mb-8">
          <button
            onClick={() => setActiveTab("encrypt")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              activeTab === "encrypt"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Lock className="w-4 h-4 inline mr-2" />
            Encryption
          </button>
          <button
            onClick={() => setActiveTab("decrypt")}
            className={`flex-1 py-3 px-4 rounded-md font-medium transition-all ${
              activeTab === "decrypt"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Key className="w-4 h-4 inline mr-2" />
            Decryption
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-card border border-border rounded-lg p-8">
          {activeTab === "encrypt" ? <EncryptionTab /> : <DecryptionTab />}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-muted-foreground">
          <div>
            <p>
              <a
                href="https://github.com/hopeugetherpes/enclave/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-80 transition-opacity"
                style={{ color: "#36b3fd" }}
              >
                CC0
              </a>{" "}
              Public Domain - No Copyright Required
            </p>
            <p className="mt-1 text-xs" data-offline-download>
              <a
                href="/enclave.html"
                download="Enclave.html"
                className="hover:opacity-80 transition-opacity underline underline-offset-2"
                style={{ color: "#36b3fd" }}
                aria-label="Download Enclave as a standalone offline HTML file"
              >
                Save offline .html
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* About Dialog */}
      <AboutDialog open={showAbout} onOpenChange={setShowAbout} />
    </div>
  )
}

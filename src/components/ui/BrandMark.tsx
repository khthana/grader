import Image from "next/image"

/**
 * The CE-CodeClass mark — the department's CE logo (ce.kmitl.ac.th/CE.ico,
 * its 256 px image) on a white tile, so it reads on the dark navbar.
 * `src/app/icon.png` is the same image for the browser tab.
 */
export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white p-0.5 ${className}`}>
      <Image src="/ce-logo.png" alt="CE" width={256} height={256} className="h-full w-full" priority />
    </span>
  )
}

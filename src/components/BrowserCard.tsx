import Image from "next/image";

export default function BrowserCard() {
  return (
    <div className="border border-neutral-300 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF5F57]" />
          <span className="h-2 w-2 rounded-full bg-[#FEBB2E]" />
          <span className="h-2 w-2 rounded-full bg-[#28C840]" />
        </div>
        <span className="mono text-[10px] text-neutral-400 tracking-wider">pricevault.app</span>
      </div>
      <div className="relative aspect-[4/3] md:aspect-[8/5] w-full overflow-hidden">
        <Image src="/hero-demo.png" alt="Overlay preview" fill priority className="object-cover" />
      </div>
    </div>
  );
}

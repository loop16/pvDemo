import Image from "next/image";

export default function BrowserCard() {
  return (
    <div className="rounded-card border border-neutral-200 bg-white p-2 md:p-3 shadow-[0_16px_40px_rgba(0,0,0,0.08),_0_4px_12px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center gap-2 pl-1">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBB2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
      </div>
      <div className="h-px w-full bg-neutral-200/80" />
      <div className="relative mt-2 md:mt-3 aspect-[4/3] md:aspect-[3/2] w-full overflow-hidden rounded-none">
        <Image src="/hero-demo.png" alt="Overlay preview" fill priority className="object-cover" />
      </div>
    </div>
  );
}


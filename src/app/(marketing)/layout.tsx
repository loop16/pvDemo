import HalftoneCanvas from "@/components/HalftoneCanvasV1";
import GridLines from "@/components/GridLines";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-0">
        <HalftoneCanvas />
      </div>
      <GridLines />
      {children}
    </>
  );
}










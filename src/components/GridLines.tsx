export default function GridLines() {
  return (
    <>
      {/* Vertical lines — fixed, always visible, clipped to viewport */}
      <div className="fixed inset-0 z-10 pointer-events-none overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-6 h-full relative">
          <div className="absolute top-0 bottom-0 -left-[20px] border-r border-neutral-200/50" />
          <div className="absolute top-0 bottom-0 -right-[20px] border-l border-neutral-200/50" />
        </div>
      </div>
      {/* Horizontal line — scrolls with content */}
      <div className="absolute left-0 right-0 top-[110px] z-10 pointer-events-none border-b border-neutral-200/50" />
    </>
  );
}

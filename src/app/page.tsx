import Handover from "./handover";

export default function Home() {
  return (
    <div className="min-h-full bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <span className="font-semibold">
            Tavling <span className="font-normal text-zinc-500">· trusted client handover</span>
          </span>
          <span className="text-xs text-zinc-500">Demo data · all names are fictional</span>
        </div>
      </header>
      <Handover />
    </div>
  );
}

type NavProps = { activePage?: 'home' | 'docs' };

export default function Nav({ activePage }: NavProps) {
  return (
    <nav className="fixed top-0 left-0 right-0 h-16 z-[100] flex items-center justify-center px-8 bg-[rgba(14,11,9,0.72)] backdrop-blur-[14px] saturate-[1.3] border-b border-line-1">
      <div className="w-full max-w-[var(--maxw)] flex items-center gap-7">
        <a className="inline-flex items-center gap-2.5 font-mono font-bold text-[12px] tracking-[0.18em] uppercase" href="/">
          <span className="w-6 h-6 bg-acc grid place-items-center font-sans font-extrabold text-[14px] text-[#1a0d05]">O</span>
          <span>Agent Office</span>
          <span className="text-txt-4 font-normal tracking-[0.12em] ml-0.5">v0.1</span>
        </a>
        <div className="flex gap-7 ml-7 font-mono text-[12px] tracking-[0.14em] uppercase text-txt-3 max-[768px]:hidden">
          <a className={`transition-colors duration-[0.12s] hover:text-txt ${activePage !== 'docs' ? '' : ''}`} href="/#how">How it works</a>
          <a className="transition-colors duration-[0.12s] hover:text-txt" href="/#features">Features</a>
          <a className="transition-colors duration-[0.12s] hover:text-txt" href="/#specs">Specs</a>
          <a className="transition-colors duration-[0.12s] hover:text-txt" href="/#faq">FAQ</a>
          <a className={`transition-colors duration-[0.12s] hover:text-txt ${activePage === 'docs' ? 'text-txt' : ''}`} href="/docs">Docs</a>
        </div>
        <div className="ml-auto flex items-center gap-3.5">
          <span className="inline-flex items-center gap-2 px-3 py-[5px] border border-acc-tint rounded-full bg-acc-faint text-acc font-mono text-[11px] tracking-[0.16em] uppercase font-bold max-[768px]:hidden">
            <span className="w-1.5 h-1.5 rounded-full bg-acc shadow-[0_0_8px_var(--acc)] animate-pulse-led"></span>
            Closed Beta
          </span>
          <span className="tooltip-disabled" data-tooltip="Temporarily disabled">
            <a href="/#beta" className="px-[18px] py-[9px] bg-acc text-[#1a0d05] rounded-lg font-mono text-[12px] font-bold tracking-[0.14em] uppercase hover:bg-[color-mix(in_oklab,var(--acc)_88%,white)] max-[768px]:px-3 max-[768px]:py-[7px] max-[768px]:text-[11px]">Request Access</a>
          </span>
        </div>
      </div>
    </nav>
  );
}

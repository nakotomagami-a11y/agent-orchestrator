import type React from "react";

type PageHeaderProps = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PageHeader({ title, sub, actions }: PageHeaderProps) {
  return (
    <header className="border-b border-line shrink-0 flex items-center gap-[16px] px-[28px] pt-[18px] pb-[14px]">
      <h1 className="font-bold flex items-baseline gap-[10px] m-0 text-[22px] tracking-[-0.01em]">
        {title}
        {sub && (
          <span className="text-txt-3 font-normal font-[var(--font-mono)] text-[12.5px] tracking-normal">
            {sub}
          </span>
        )}
      </h1>
      {actions && (
        <div className="ml-auto flex items-center gap-[8px]">
          {actions}
        </div>
      )}
    </header>
  );
}

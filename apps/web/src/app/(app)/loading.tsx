import { Skeleton } from "@/components/ui/skeleton";

export default function OfficeLoading() {
  return (
    <>
      <div className="toolbar">
        <Skeleton width={140} height={20} />
        <span className="ml-2">
          <Skeleton width={180} height={12} />
        </span>
      </div>
      <div className="office p-6">
        <Skeleton width={420} height={480} />
      </div>
    </>
  );
}

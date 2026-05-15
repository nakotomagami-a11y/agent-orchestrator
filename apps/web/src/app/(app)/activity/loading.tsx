import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <>
      <div className="toolbar">
        <Skeleton width={120} height={20} />
      </div>
      <div className="tab-pane flex flex-col gap-3">
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
      </div>
    </>
  );
}

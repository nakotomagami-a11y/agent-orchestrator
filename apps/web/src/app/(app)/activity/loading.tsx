import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <>
      <div className="toolbar">
        <Skeleton width={120} height={20} />
      </div>
      <div className="tab-pane" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
        <Skeleton width="100%" height={56} />
      </div>
    </>
  );
}

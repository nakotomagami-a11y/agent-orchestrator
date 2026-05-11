import { Skeleton } from "@/components/ui/skeleton";

export default function OfficeLoading() {
  return (
    <>
      <div className="toolbar">
        <Skeleton width={140} height={20} />
        <span style={{ marginLeft: 8 }}>
          <Skeleton width={180} height={12} />
        </span>
      </div>
      <div className="office" style={{ padding: 24 }}>
        <Skeleton width={420} height={480} />
      </div>
    </>
  );
}

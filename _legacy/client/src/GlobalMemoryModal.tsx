import { I } from "./Avatars";
import { MemoryEditor } from "./MemoryEditor";

interface Props {
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function GlobalMemoryModal({ onClose, onDirtyChange }: Props) {
  return (
    <div className="wizard-scrim" onClick={onClose}>
      <div
        className="wizard"
        onClick={e => e.stopPropagation()}
        style={{ gridTemplateRows: "auto 1fr", maxHeight: "80vh" }}
      >
        <div className="wizard-head">
          <h2>Global memory</h2>
          <span className="mono" style={{ fontSize: 11, color: "var(--txt-3)", marginLeft: 8 }}>
            ~/.claude/agents/_global.memory.md
          </span>
          <button className="x" style={{ marginLeft: "auto" }} onClick={onClose}>×</button>
        </div>
        <div style={{ padding: 20, minHeight: 0, display: "flex" }}>
          <MemoryEditor
            endpoint="/api/memory/global"
            title="Global memory"
            subtitle="applied to every agent on summon"
            onDirtyChange={onDirtyChange}
            hint={
              <>
                <I.Sparkles style={{ verticalAlign: "middle", marginRight: 6, color: "var(--acc)" }} />
                Auto-appended to every agent's system prompt via <code style={{ color: "var(--txt-1)" }}>--append-system-prompt</code> at summon time.
                Kept separate from your existing <code style={{ color: "var(--txt-1)" }}>~/.claude/CLAUDE.md</code> so this dashboard doesn't touch your global Claude Code config.
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}

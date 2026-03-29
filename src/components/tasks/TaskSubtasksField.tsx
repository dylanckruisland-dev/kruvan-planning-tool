import { Plus, Trash2 } from "lucide-react";
import {
  createSubtaskId,
  type TaskSubtaskForm,
} from "@/lib/task-form";
import { cn } from "@/lib/cn";

type Props = {
  subtasks: TaskSubtaskForm[];
  onChange: (next: TaskSubtaskForm[]) => void;
  inputClass: string;
};

export function TaskSubtasksField({ subtasks, onChange, inputClass }: Props) {
  function add() {
    onChange([
      ...subtasks,
      { id: createSubtaskId(), title: "", done: false },
    ]);
  }

  function updateAt(index: number, patch: Partial<TaskSubtaskForm>) {
    onChange(
      subtasks.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function removeAt(index: number) {
    onChange(subtasks.filter((_, i) => i !== index));
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-slate-600">Subtasks</label>
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-accent transition hover:bg-accent-soft"
        >
          <Plus className="h-3.5 w-3.5" />
          Add step
        </button>
      </div>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Break the work into checkable steps (optional).
      </p>
      {subtasks.length === 0 ? (
        <p className="mt-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-3 text-center text-xs text-slate-500">
          No subtasks yet. Use “Add step” to list what needs to happen.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {subtasks.map((s, index) => (
            <li
              key={s.id}
              className="flex items-start gap-2 rounded-xl border border-slate-200/90 bg-slate-50/50 p-2"
            >
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) =>
                  updateAt(index, { done: e.target.checked })
                }
                className="accent-[var(--workspace-accent)] mt-2 h-4 w-4 shrink-0 rounded border-slate-300 focus:ring-[rgba(var(--workspace-accent-rgb),0.35)]"
                aria-label={`Subtask ${index + 1} done`}
              />
              <input
                value={s.title}
                onChange={(e) => updateAt(index, { title: e.target.value })}
                placeholder="Describe this step…"
                className={cn(inputClass, "mt-0 flex-1")}
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                className="mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                aria-label="Remove subtask"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

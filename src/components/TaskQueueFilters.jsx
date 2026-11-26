import { matchesTaskQueue, TASK_QUEUE_FILTERS } from "../lib/taskUi.js";
import "./TaskQueue.css";

export default function TaskQueueFilters({ tasks, value, onChange, today, viewerId }) {
  return (
    <div className="task-queue-filters" aria-label="Быстрые отборы задач" role="group">
      {TASK_QUEUE_FILTERS.map(filter => {
        const count = tasks.filter(task => matchesTaskQueue(task, filter.id, today, viewerId)).length;
        return (
          <button key={filter.id} type="button" aria-pressed={value === filter.id} onClick={() => onChange(filter.id)}>
            {filter.label} <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

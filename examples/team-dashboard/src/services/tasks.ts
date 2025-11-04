// ✅ MIGRATED to Effect patterns with Schema validation
import { Context, Effect, Layer, Schema } from "effect"

export const TaskSchema = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  assignedTo: Schema.Number,
  status: Schema.Literal("todo", "in-progress", "done"),
  createdAt: Schema.Date
})

export type Task = typeof TaskSchema.Type

export class TaskValidationError {
  readonly _tag = "TaskValidationError"
  constructor(readonly message: string) {}
}

export class TaskService extends Context.Tag("TaskService")<
  TaskService,
  {
    readonly getTasksByUser: (userId: number) => Effect.Effect<readonly Task[]>
    readonly createTask: (title: string, assignedTo: number) => Effect.Effect<Task, TaskValidationError>
    readonly updateTaskStatus: (id: number, status: "todo" | "in-progress" | "done") => Effect.Effect<Task>
  }
>() {}

export const TaskServiceLive = Layer.succeed(TaskService, {
  getTasksByUser: (userId: number) =>
    Effect.succeed([
      {
        id: 1,
        title: "Complete migration to Effect",
        assignedTo: userId,
        status: "in-progress" as const,
        createdAt: new Date()
      }
    ]),
  
  createTask: (title: string, assignedTo: number) =>
    Effect.gen(function* () {
      if (title.length === 0) {
        return yield* Effect.fail(new TaskValidationError("Title cannot be empty"))
      }
      
      return {
        id: Math.floor(Math.random() * 1000),
        title,
        assignedTo,
        status: "todo" as const,
        createdAt: new Date()
      }
    }),
  
  updateTaskStatus: (id: number, status: "todo" | "in-progress" | "done") =>
    Effect.succeed({
      id,
      title: "Sample task",
      assignedTo: 1,
      status,
      createdAt: new Date()
    })
})

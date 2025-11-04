// ✅ MIGRATED controller using Effect properly through services
import { Effect } from "effect"
import { UserService } from "../services/users"
import { TaskService } from "../services/tasks"

export const getUserDashboard = (userId: number) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const taskService = yield* TaskService
    
    const user = yield* userService.getUser(userId)
    const tasks = yield* taskService.getTasksByUser(userId)
    
    return {
      user,
      tasks,
      taskSummary: {
        total: tasks.length,
        inProgress: tasks.filter(t => t.status === "in-progress").length,
        completed: tasks.filter(t => t.status === "done").length
      }
    }
  })

export const createUserTask = (userId: number, title: string) =>
  Effect.gen(function* () {
    const userService = yield* UserService
    const taskService = yield* TaskService
    
    // Verify user exists first
    yield* userService.getUser(userId)
    
    // Create task
    const task = yield* taskService.createTask(title, userId)
    
    return { success: true, task }
  })

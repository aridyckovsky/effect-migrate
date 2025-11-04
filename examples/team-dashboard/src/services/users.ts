// ✅ MIGRATED to Effect patterns
import { Context, Effect, Layer } from "effect"

export interface User {
  readonly id: number
  readonly username: string
  readonly email: string
}

export class UserNotFoundError {
  readonly _tag = "UserNotFoundError"
  constructor(readonly userId: number) {}
}

export class UserService extends Context.Tag("UserService")<
  UserService,
  {
    readonly getUser: (id: number) => Effect.Effect<User, UserNotFoundError>
    readonly listUsers: () => Effect.Effect<readonly User[]>
    readonly createUser: (username: string, email: string) => Effect.Effect<User>
  }
>() {}

export const UserServiceLive = Layer.succeed(UserService, {
  getUser: (id: number) =>
    Effect.gen(function* () {
      // Simulate database lookup
      if (id === 999) {
        return yield* Effect.fail(new UserNotFoundError(id))
      }
      
      return {
        id,
        username: `user${id}`,
        email: `user${id}@example.com`
      }
    }),
  
  listUsers: () =>
    Effect.succeed([
      { id: 1, username: "alice", email: "alice@example.com" },
      { id: 2, username: "bob", email: "bob@example.com" }
    ]),
  
  createUser: (username: string, email: string) =>
    Effect.succeed({
      id: Math.floor(Math.random() * 1000),
      username,
      email
    })
})

---
name: Zod codegen compatibility
description: OpenAPI-generated Zod helpers must match the Zod major version installed in the workspace.
---

When the workspace uses Zod 3, avoid OpenAPI shapes that make Orval emit Zod 4-only top-level helpers such as `z.int()` or `z.email()`. Prefer compatible primitive schemas and keep stricter checks in the route layer when needed.

**Why:** The generator can complete successfully while the chained library typecheck fails on unsupported helpers.

**How to apply:** After every OpenAPI change, run codegen and the library typecheck before wiring new generated schemas into server routes.
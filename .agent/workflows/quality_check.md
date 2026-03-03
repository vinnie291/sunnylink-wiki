---
description: Run code quality checks step-by-step
---

This workflow should be run before finalizing major changes or deploying to verify there are no compilation or type errors.

// turbo-all

1. **Lint code**
   Run the Next.js standard linter to catch basic React issues.
   ```bash
   npm run lint
   ```

2. **Type Check & Production Build**
   Run the build script to compile the application and check for strict Type errors. This catches many issues that `npm run dev` might miss.
   ```bash
   npm run build
   ```

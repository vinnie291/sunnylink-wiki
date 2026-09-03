---
description: Start the local development server and test the application
---

This workflow helps you quickly start the local development environment and verify changes.

// turbo
1. **Install dependencies**
   Run the following command to ensure all packages are up to date:
   ```bash
   npm install
   ```

// turbo
2. **Start development server**
   Launch the Next.js development server in the background:
   ```bash
   npm run dev
   ```

3. **Verify in browser**
   Wait for the server to start (usually a few seconds) and then open the local site:
   - URL: [http://localhost:3000](http://localhost:3000)
   - Use the `open_browser_url` tool to verify the landing page loads correctly.

4. **Quality Check (Optional)**
   You can also run `/quality_check` to ensure there are no linting or build errors before testing.

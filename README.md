# Goal Tally

Set an optional **Target** when adding or editing a goal. Open the goal to compare its progress with the expected pace. **Tracking Period** on the goals page lets you change the dates for all active goals. The default is the current calendar year.

## Archives

Choose **Archive** at the bottom of your goals page to see past results and open any archived goal’s tally history. Choose **Archive Goals** to save your current goals. The name defaults to the current year, and you can edit or reuse it. The app saves each goal’s final tally count and clears the active list. Choose **Back to Goals** to start fresh.

Choose **Restore** next to an archive or backup to make those goals active again. Restoring replaces the entire active list. Any displaced goals and their tallies go into a separate, restorable backup in Archives.

### Supabase setup

If you haven't applied any of the five feature migrations, run the entire [combined upgrade script](supabase/upgrade_goal_tally_archives_and_targets.sql) once in the Supabase **SQL Editor**. It applies all five in one transaction.

If you've already applied some of the migrations, run only the remaining files from [the migrations folder](supabase/migrations) in filename order. Existing yearly archives without a creation date are ordered by year beneath dated entries.

Test the migration on a staging copy first if available. It expects the existing `public.goals` and `public.tallies` tables, with UUID goal IDs and goal owners. Older app versions can still display archived goals in their active list, so reload or update any installed copies after deploying.

## Development

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

# Axon Ivy Process Viewer

A browser-based viewer for Axon Ivy `.p.json` process files. It renders the process diagram (elements, connectors, lanes) the way Designer would, lets you inspect every element's configuration, and - its main feature - **diffs two versions of a process side-by-side**, so you can review what a merge, refactor, or colleague's change actually did without opening Designer.

Everything runs locally in your browser: files never leave your machine, there is no backend, and it works entirely offline once loaded.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173). The app starts with a bundled demo process already loaded, so you can explore both views immediately without opening any files.

## Single view

Use **Single view** to explore one process file at a time.

- **Open .p.json** loads a single file from disk.
- **Open folder…** recursively registers every `.p.json`/`.json` file in a folder so that `SubProcessCall` references can be resolved by name.
- Click any element to open its **detail panel** on the right, showing its type, id, and a Designer-like breakdown of its configuration (dialog signatures, call/output mappings, embedded code, parameter tables, etc.), plus the raw JSON as a fallback.
- Press **J** with an element selected to jump into it: into a collapsed BPMN activity's embedded content, or into the target process of a `SubProcessCall` (if it has been registered via "Open folder…"). A breadcrumb bar lets you jump back out again.
- The diagram supports panning, zooming, and a minimap (bottom-right) via the standard canvas controls (bottom-left).

![Single view: process diagram with the detail panel showing a Designer-style "Call" mapping table](docs/screenshots/single-view.png)

## Diff view

Use **Diff view** to compare two versions of a process - for example the base and incoming side of a merge conflict, or two exported snapshots of the same process taken at different times.

- **Open left .p.json** / **Open right .p.json** each load independently, so you can freely mix any two files (or keep the bundled before/after demo).
- Both diagrams are laid out and rendered side-by-side, and every element and connector is colored by its diff status:

  | Color | Status | Meaning |
  | --- | --- | --- |
  | Gray | `unchanged` | Present, identical on both sides |
  | Green | `added` | Only present on the right |
  | Red, dashed | `removed` | Only present on the left |
  | Amber | `modified` | Present on both sides, but its configuration differs |
  | Blue | `moved` | Present on both sides with identical configuration, only its canvas position changed |

- Selecting an element shows a diff-aware detail panel: a **"Config changed in"** summary chip lists which sections changed and how many fields, and every changed value is shown old-over-new (strikethrough red for the removed value, green for the new one) - right down to nested config, so a one-field change deep inside a REST call body is just as visible as a top-level rename.

![Diff view overview: split canvases colored by status (added/removed/modified/moved), with a scalar field diff in the detail panel](docs/screenshots/diff-view-overview.png)

*In this example: "log audit trail" was removed, "post-process document" was added, "RestClientCall"'s target path changed (`/v1/` → `/v2/`), and "TaskEnd" only moved.*

### Mapping table diffs

Call/output/result mappings (Designer's "Attribute | Expression" tables) are diffed entry-by-entry, not just as a blob of text. Each row is matched by its dotted path and tinted individually:

![Mapping table diff: changed, added, removed, and unchanged rows are individually highlighted in a tree-indented table](docs/screenshots/diff-view-mapping-table.png)

*Here, `upload.maxSizeMb` changed value, `upload.targetFolder` was removed, and `upload.compressionLevel` / `notify.sms` were added - while `upload.allowedTypes` and `notify.email` stayed unchanged, all within the same nested mapping tree.*

### Code diffs

Embedded script code (e.g. a `Script` element's output code, or any inline expression list) is diffed line-by-line with a compact LCS-based `+`/`-` view, similar to a unified text diff:

![Code diff: added and removed lines highlighted with +/- markers inside the embedded script](docs/screenshots/diff-view-code-diff.png)

Other config shapes get the same tailored treatment: parameter lists (`params`) are diffed row-by-row by parameter name, and everything else falls back to a recursive structural diff that only expands/tints the parts that actually changed.

## Resizing the detail sidebar

The detail sidebar's width can be adjusted by dragging the thin handle between the canvas and the sidebar (cursor turns into a resize arrow). The chosen width is remembered (via `localStorage`) and shared between Single view and Diff view.

## Development

```bash
npm run test    # run the unit test suite (vitest)
npm run lint    # run oxlint
npm run build   # type-check (tsc -b) and produce a production build
npm run preview # preview the production build locally
```


export {
  useLivelyExtension,
  yjsUndo,
  yjsRedo,
  type UseLivelyExtensionOptions,
} from "./use-lively-extension.js";

export { Toolbar, ToolbarButton, ToolbarDivider } from "./toolbar.js";
export type { ToolbarProps, ToolbarButtonProps } from "./toolbar.js";

export { FloatingToolbar } from "./floating-toolbar.js";
export type { FloatingToolbarProps } from "./floating-toolbar.js";

export { createSlashCommandExtension } from "./slash-command.js";
export type { SlashMenuItem } from "./slash-command.js";

export { Callout } from "./callout.js";
export type { CalloutType, CalloutOptions } from "./callout.js";

export { ImagePlaceholder } from "./image-placeholder.js";

export { createCodeBlockExtension } from "./code-block-language.js";

export { BlockHandle } from "./block-handle.js";
export type { BlockHandleProps } from "./block-handle.js";

/**
 * Cursor CSS — add these styles to your `globals.css` for collaborative cursors:
 *
 * ```css
 * .collaboration-cursor__caret {
 *   border-left: 2px solid;
 *   border-color: inherit;
 *   margin-left: -1px;
 *   margin-right: -1px;
 *   pointer-events: none;
 *   position: relative;
 *   word-break: normal;
 * }
 *
 * .collaboration-cursor__label {
 *   border-radius: 6px;
 *   color: #fff;
 *   font-size: 12px;
 *   font-weight: 500;
 *   left: -1px;
 *   line-height: 1;
 *   padding: 2px 6px;
 *   position: absolute;
 *   top: -1.4em;
 *   user-select: none;
 *   white-space: nowrap;
 * }
 * ```
 */

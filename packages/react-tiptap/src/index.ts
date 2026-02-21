export {
  useOpenBlocksExtension,
  yjsUndo,
  yjsRedo,
  type UseOpenBlocksExtensionOptions,
} from "./use-openblocks-extension.js";

export { Toolbar, ToolbarButton, ToolbarDivider } from "./toolbar.js";
export type { ToolbarProps, ToolbarButtonProps } from "./toolbar.js";

export { FloatingToolbar } from "./floating-toolbar.js";
export type { FloatingToolbarProps } from "./floating-toolbar.js";

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

// Canonical implementation lives with the served aftersign runtime.
// Keep this compatibility entry point implementation-free so web imports
// cannot drift from the runtime feedback behavior.
export {
  IO_RETURN_LINE_FEEDBACK,
  playIoReturnLineFeedback,
} from "../../../../aftersign/src/ioReturnLineFeedback.js";

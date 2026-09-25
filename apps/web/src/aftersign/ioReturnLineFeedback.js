/**
 * Web-target compatibility entry point for the canonical aftersign feedback.
 * Keep the implementation in `aftersign/src` so both surfaces share one
 * `playIoReturnLineFeedback` body.
 */
export {
  IO_RETURN_LINE_FEEDBACK,
  playIoReturnLineFeedback,
} from "../../../../aftersign/src/ioReturnLineFeedback.js";

// DOM presentation for AFTERSIGN's return-recognition siblings.
// Copy and state are resolved by the runtime; this module owns only the
// idempotent DOM lifecycle and preserves the served sibling contract.

const removeSibling = (document, id) => {
  if (!document) return;
  const node = document.getElementById(id);
  if (node?.parentNode) node.parentNode.removeChild(node);
};

const ensureParagraphAfter = (document, anchor, id) => {
  let paragraph = document.getElementById(id);
  if (!paragraph) {
    paragraph = document.createElement("p");
    paragraph.id = id;
    if (typeof anchor.insertAdjacentElement === "function") {
      anchor.insertAdjacentElement("afterend", paragraph);
    } else {
      anchor.parentNode.insertBefore(paragraph, anchor.nextSibling);
    }
  }
  return paragraph;
};

const setAttributeIfChanged = (node, name, value) => {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
};

const setTextIfChanged = (node, text) => {
  if (node.textContent !== text) node.textContent = text;
};

export const renderReturnRecognition = ({
  document,
  line,
  isReturnRecognitionBeat,
  returnOutcome,
  returnLineText,
  skippedRouteLine,
  routeReturnLine,
}) => {
  if (!isReturnRecognitionBeat || !line?.parentNode || !document) {
    removeSibling(document, "ioReturnLine");
    removeSibling(document, "ioSkippedRouteLine");
    removeSibling(document, "ioRouteReturnLine");
    return null;
  }

  const returnPara = ensureParagraphAfter(document, line, "ioReturnLine");
  setAttributeIfChanged(returnPara, "data-aftersign-io-return-line", returnOutcome);
  setTextIfChanged(returnPara, returnLineText);

  if (!skippedRouteLine) {
    removeSibling(document, "ioSkippedRouteLine");
    removeSibling(document, "ioRouteReturnLine");
    return returnPara;
  }

  const skippedRoutePara = ensureParagraphAfter(
    document,
    returnPara,
    "ioSkippedRouteLine",
  );
  setAttributeIfChanged(
    skippedRoutePara,
    "data-aftersign-io-route-memory",
    "skipped",
  );
  setTextIfChanged(skippedRoutePara, skippedRouteLine.text);

  const routeReturnPara = ensureParagraphAfter(
    document,
    skippedRoutePara,
    "ioRouteReturnLine",
  );
  routeReturnPara.style.margin = "0";
  routeReturnPara.style.padding = "0";
  routeReturnPara.style.fontSize = "0.85em";
  routeReturnPara.style.lineHeight = "1.1";
  skippedRoutePara.style.marginTop = "0";
  skippedRoutePara.style.marginBottom = "0";
  setAttributeIfChanged(
    routeReturnPara,
    "data-aftersign-io-route-return-line",
    routeReturnLine.id,
  );
  setAttributeIfChanged(
    routeReturnPara,
    "data-aftersign-io-route-memory-key",
    String(routeReturnLine.memoryKey ?? ""),
  );
  setTextIfChanged(routeReturnPara, routeReturnLine.text);
  return returnPara;
};

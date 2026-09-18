/*
 * Single-owner lookup for the target-loss prompt.
 *
 * The served kiosk needs exactly one mounted prompt node: duplicate ids make
 * `document.getElementById()` ambiguous and cause CSS/renderer ownership to
 * depend on DOM order. `main.js` should import this seam when the target-loss
 * feedback render path is next touched.
 */
export function getTargetLostPrompt(root = document) {
  const prompts = root.querySelectorAll('#targetLostPrompt');
  if (prompts.length !== 1) {
    throw new Error(`Expected one #targetLostPrompt surface, found ${prompts.length}`);
  }
  return prompts[0];
}

# Reticle placeholder removal

Tracked by #2146.

The served target-loss feedback is owned by `#aimReticle` and `#targetLossPrompt`. The legacy `#reticle` placeholder in `aftersign/index.html` should be removed with its associated CSS and explanatory comments, without changing the live target-loss feedback behavior.

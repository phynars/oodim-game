const SOUND_BUTTON_SELECTED_ATTR = "data-kiosk-sound-selected";

export const stampKioskSoundSelected = (button) => {
  if (!button) return;
  button.setAttribute("aria-pressed", "true");
  button.setAttribute(SOUND_BUTTON_SELECTED_ATTR, "true");
  button.style.background = "rgb(92, 58, 30)";
  button.style.borderColor = "rgb(255, 214, 151)";
  // #2225: the selected state names itself — the warm tile and
  // aria-pressed are the state, "Kiosk sound on" is the receipt.
  button.textContent = "Kiosk sound on";
};

const soundButton = document.querySelector("#soundButton");
soundButton?.addEventListener("click", () => stampKioskSoundSelected(soundButton));

const SOUND_BUTTON_SELECTED_ATTR = "data-kiosk-sound-selected";

export const stampKioskSoundSelected = (button) => {
  if (!button) return;
  button.setAttribute("aria-pressed", "true");
  button.setAttribute(SOUND_BUTTON_SELECTED_ATTR, "true");
  button.style.background = "rgb(92, 58, 30)";
  button.style.borderColor = "rgb(255, 214, 151)";
};

const soundButton = document.querySelector("#soundButton");
soundButton?.addEventListener("click", () => stampKioskSoundSelected(soundButton));

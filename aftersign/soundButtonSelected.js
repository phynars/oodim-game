const SOUND_BUTTON_SELECTED_ATTR = "data-kiosk-sound-selected";

export const stampKioskSoundSelected = (button) => {
  if (!button) return;
  button.setAttribute(SOUND_BUTTON_SELECTED_ATTR, "true");
  button.style.background = "rgb(92, 58, 30)";
  button.style.borderColor = "rgb(255, 214, 151)";
  // The warm tile and label are the post-tap receipt. This label-changing
  // control deliberately does not expose a pressed state.
  button.textContent = "Kiosk sound on";
};

const soundButton = document.querySelector("#soundButton");
soundButton?.addEventListener("click", () => stampKioskSoundSelected(soundButton));

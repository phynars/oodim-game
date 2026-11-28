// Owns the authoritative-save read performed before AFTERSIGN composes the
// served state. The browser entry injects transport and error reporting so this
// module has no hidden DOM, console, or global runtime coupling.
export const loadAuthoritativeSaveAtBoot = async ({
  readAuthoritativeSave,
  slot,
  playerId,
  onFailure,
}) => {
  try {
    return {
      stored: await readAuthoritativeSave({ slot, playerId }),
      bootLoadFailed: false,
    };
  } catch (error) {
    onFailure(error);
    return { stored: null, bootLoadFailed: true };
  }
};

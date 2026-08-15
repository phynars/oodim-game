export const RETURN_TONE_PROMPT = "Io waits with the kettle off. The city has already counted you absent once.";

export const RETURN_TONE_CHOICES = Object.freeze({
  kind: {
    id: "kind",
    label: "I came back because you asked me to.",
    ioLine: "Useful answer. Almost kind enough to be dangerous.",
    memorySentence: "The courier returned gently when Io asked why they came back."
  },
  evasive: {
    id: "evasive",
    label: "I still had your packet dust on my hands.",
    ioLine: "That is not an answer. It is close enough for weather like this.",
    memorySentence: "The courier dodged Io's question with packet dust still on their hands."
  },
  blunt: {
    id: "blunt",
    label: "Because the job was not finished.",
    ioLine: "Good. Sentiment leaks. Work holds.",
    memorySentence: "The courier returned bluntly: the job was not finished."
  }
});

export function getReturnToneChoice(tone) {
  return RETURN_TONE_CHOICES[tone] ?? RETURN_TONE_CHOICES.blunt;
}

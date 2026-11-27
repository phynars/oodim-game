// #3095 — Night Post DOM composition extracted from main.js. Run by vitest
// (jsdom) through `npm run test:unit:aftersign`.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderNightPost } from "./nightPostRenderer.js";

const job = { id: "door-job", doorChoice: "keep-official-record", deliveryId: "delivery-2", name: "Archive Run", brief: "Carry it home." };

const render = (overrides = {}) => {
  const host = document.createElement("div");
  document.body.append(host);
  const onAcceptJob = vi.fn(async () => {});
  const onChooseShortcut = vi.fn(async () => {});
  renderNightPost({
    doc: document,
    host,
    doorChoice: job.doorChoice,
    doorLabel: "Keep the official record",
    job,
    acceptedJobId: undefined,
    nikoShortcutAnswer: undefined,
    routeRisk: {},
    routeRiskDeliveryId: undefined,
    onAcceptJob,
    onChooseShortcut,
    ...overrides,
  });
  return { host, onAcceptJob, onChooseShortcut };
};

describe("renderNightPost", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("renders an offer and accepts it through a visible button", async () => {
    const { host, onAcceptJob } = render();
    const accept = host.querySelector("#acceptEpisodeTwoJob");
    expect(accept?.textContent).toBe("Accept Archive Run");
    accept.click();
    await Promise.resolve();
    expect(onAcceptJob).toHaveBeenCalledWith(job);
    expect(host.querySelector("[data-niko-greeting='night-post']")).not.toBeNull();
  });

  it("restores an accepted job and its selected shortcut", () => {
    const { host } = render({ acceptedJobId: job.id, nikoShortcutAnswer: "take" });
    expect(host.querySelector("#acceptEpisodeTwoJob")?.textContent).toBe("Accepted");
    expect(host.querySelector("#episodeTwoJob")?.getAttribute("data-episode-two-accepted-job-id")).toBe(job.id);
    expect(host.querySelector("[data-niko-shortcut-selected='true']")?.getAttribute("data-niko-shortcut-choice")).toBe("take");
  });

  it("sends both visible shortcut choices through the callback", async () => {
    const { host, onChooseShortcut } = render({ acceptedJobId: job.id });
    const choices = [...host.querySelectorAll("[data-niko-shortcut-choice]")];
    expect(choices.map((choice) => choice.textContent)).toEqual(["Take the shortcut", "Refuse the shortcut"]);
    choices[1].click();
    await Promise.resolve();
    expect(onChooseShortcut).toHaveBeenCalledWith(choices[1].getAttribute("data-niko-shortcut-choice"));
  });
});

import { describe, expect, it } from 'vitest';
import {
  RECOGNITION_FEEDBACK_TOTAL_MS,
  recognitionFeedbackAt,
} from './recognitionFeedback';

describe('recognitionFeedbackAt', () => {
  it('opens with a 140ms catch beat: tiny shake, camera push, and subtitle pop', () => {
    const start = recognitionFeedbackAt(0);
    const peak = recognitionFeedbackAt(140);

    expect(start.phase).toBe('catch');
    expect(start.screenShakePx).toBeCloseTo(1.5, 2);
    expect(start.cameraPushDegrees).toBeCloseTo(0, 2);
    expect(start.subtitleScale).toBeCloseTo(1, 2);

    expect(peak.phase).toBe('remember');
    expect(peak.audioCue).toBe('memory-chime');
  });

  it('holds recognition through the remember bloom before easing back to room tone', () => {
    const bloom = recognitionFeedbackAt(320);
    const done = recognitionFeedbackAt(RECOGNITION_FEEDBACK_TOTAL_MS);

    expect(bloom.phase).toBe('remember');
    expect(bloom.cameraPushDegrees).toBeGreaterThan(0.8);
    expect(bloom.vignetteOpacity).toBeGreaterThan(0.1);
    expect(bloom.subtitleScale).toBeGreaterThan(1.04);

    expect(done.phase).toBe('settle');
    expect(done.cameraPushDegrees).toBeCloseTo(0, 2);
    expect(done.vignetteOpacity).toBeCloseTo(0, 2);
    expect(done.audioCue).toBe('room-tone');
  });
});

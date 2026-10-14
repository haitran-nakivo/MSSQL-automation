// Options every Discovery Scope spec applies with `test.use(RUN_OPTIONS)`, so a run records its video and the browser follows the
// screen: the page follows the window (`viewport: null`), the window opens maximized, a headless window gets a large size (the
// Director's dialogs do not show in a small one), and the video is recorded at 1920x1080 and kept for PASS, FAIL and ABORTED.
// (tests/DBs_Services_Apps product/.../OS_Platform support/Discovery/NJM-187289.spec.ts sets the same values inline.)
export const RUN_OPTIONS = {
  viewport: null,
  launchOptions: { args: ['--start-maximized', '--window-size=1920,1080'] },
  video: { mode: 'on' as const, size: { width: 1920, height: 1080 } },
};

// Pause after every test.step finishes, so the recorded video and a watcher can follow each step (owner request, 2026-10-12/13).
// The one place to change it; 0 turns it off. fixtures/index.ts applies it to every spec and adds it to the test timeout.
export const STEP_DELAY_MS = 2000;

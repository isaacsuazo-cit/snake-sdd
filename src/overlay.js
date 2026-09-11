// Dumb overlay panel over the board: fills copy and toggles visibility. Owns no game rules.
// `root` is the #overlay element; the caller composes every string it shows.

export function createOverlay(root) {
  const title = root.querySelector('#overlay-title');
  const score = root.querySelector('#overlay-score');
  const hint = root.querySelector('#overlay-hint');

  function show({ kind, title: titleText, score: scoreText, hint: hintText }) {
    root.dataset.kind = kind;
    title.textContent = titleText;
    score.textContent = scoreText;
    hint.textContent = hintText;
    root.hidden = false;
  }

  function hide() {
    root.hidden = true;
  }

  return { show, hide };
}

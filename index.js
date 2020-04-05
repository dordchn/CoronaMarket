import level1 from './levels/level1.js';
import level2 from './levels/level2.js';
import level3 from './levels/level3.js';
import level4 from './levels/level4.js';
import level5 from './levels/level5.js';
import level6 from './levels/level6.js';
import sounds from './utils/sounds.js';

let loadingMessage = document.querySelector('#loading');
let mainScreen = document.querySelector('#main_screen');
let startButton = document.querySelector('#start_button');
let howtoButton = document.querySelector('#howto_button');
let instructions = document.querySelector('#instructions');
let topRow = document.querySelector('#top_row');
let livesContainer = document.querySelector('#lives');
let levelLabel = document.querySelector('#level_label');
let signs = document.querySelector('.signs-container');

let levels = [level1, level2, level3, level4, level5, level6];
let levelIndex = 0;

let game = document.querySelector('x-game');
game.init().then(() => {
  mainScreen.style.display = '';
  loadingMessage.style.display = 'none';
});

game.addEventListener('point', async () => {
  await sounds.play('res/sounds/point.mp3', 0.7);
});

game.addEventListener('win', async () => {
  gtag('event', 'win', { 'event_category': 'Level', 'event_label': 'Level' + (levelIndex + 1) });
  sounds.stopBackground();
  await sounds.play('res/sounds/win.mp3', 0.7);
  levelIndex = (levelIndex + 1) % levels.length;
  if (levelIndex == 0) { // Completed game
    gtag('event', 'win', { 'event_category': 'Game' });
    loadMenu();
  } else {
    loadLevel(levelIndex);
  }
});

game.addEventListener('loss', async evt => {
  gtag('event', 'loss', { 'event_category': 'Level', 'event_label': 'Level' + (levelIndex + 1) });
  let lives = livesContainer.querySelectorAll('img:not(.used)');
  sounds.stopBackground();
  if (evt.detail.cough && lives.length > 0) {
    await sounds.play('res/sounds/cough-boy9.mp3');
  }
  if (lives.length > 0) {
    await sounds.play('res/sounds/life.mp3', 0.7);
    lives[0].classList.add('used');
    loadLevel(levelIndex);
  } else {
    gtag('event', 'loss', { 'event_category': 'Game', 'event_label': 'Level' + (levelIndex + 1) });
    await sounds.play('res/sounds/loss.mp3', 0.7);
    loadMenu();
    levelIndex = 0;
  }
});

function loadMenu() {
  game.reset();
  signs.style.visibility = 'hidden';
  topRow.style.visibility = 'hidden';
  mainScreen.style.display = '';
  Array.from(livesContainer.children).forEach(life => life.classList.add('used'));
}

startButton.addEventListener('click', async () => {
  if (game.ready) {
    gtag('event', 'start', { 'event_category': 'Game' });
    Array.from(livesContainer.children).forEach(life => life.classList.remove('used'));
    mainScreen.style.display = 'none';
    loadLevel(levelIndex);
    topRow.style.visibility = 'visible';
  }
});

howtoButton.addEventListener('click', () => {
  instructions.classList.toggle('open');
});

const muteButton = document.querySelector('#mute_button');
const unmuteButton = document.querySelector('#unmute_button');

muteButton.addEventListener('click', function () {
  sounds.mute();
  muteButton.style.display = 'none';
  unmuteButton.style.display = '';
});

unmuteButton.addEventListener('click', function () {
  sounds.unmute();
  unmuteButton.style.display = 'none';
  muteButton.style.display = '';
});

function loadLevel(levelIndex) {
  levelLabel.innerText = `Level ${levelIndex + 1}`;
  signs.style.visibility = 'visible';
  game.loadLevel(levels[levelIndex]);
  sounds.playBackground();
}

const backButton = document.querySelector('#back_button');
backButton.addEventListener('click', () => {
  sounds.stopBackground();
  gtag('event', 'left', { 'event_category': 'Level', 'event_label': 'Level' + (levelIndex + 1) });
  gtag('event', 'left', { 'event_category': 'Game', 'event_label': 'Level' + (levelIndex + 1) });
  loadMenu();
  levelIndex = 0;
});
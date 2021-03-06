import resources from './utils/resources.js';
import sounds from './utils/sounds.js';
import { boxCollides, boxContains, arcCollides } from './utils/collision.js';

const delay = t => new Promise(res => setTimeout(res, t));

class Game extends HTMLElement {
  constructor() {
    super();
    this.shadowDOM = this.attachShadow({ mode: "open" });
    this.shadowDOM.innerHTML = `
      <style>
        .container {
          display: inline-block;
          width: 1024px;
        }
        canvas {
          border: 1px solid black;
        }
        .signs-container {
          visibility: hidden;
          margin-top: 4px;
          font-size: 22px;
        }
        .entrance {
          float: left;
          margin-left: 94px;
        }
        .exit {
          float: right;
          margin-right: 102px;
        }
      </style>
      <div class="container">
        <canvas width="1024" height="576"></canvas>
        <div class="signs-container">
          <span class="entrance">Entrance</span>
          <span class="exit">Exit</span>
        </div>
      </div>
    `
      ;

    this.canvas = this.shadowDOM.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.ready = false;
    this.active = false;
    this.level = null;
    this.floorPattern = null;
    this.prevLoopTime = null;

    this.requestId = null;
    this.signs = this.shadowDOM.querySelector('.signs-container');
  }

  async init() {
    // Load background
    await resources.loadImage('res/imgs/floor.png');
    this.floorPattern = this.ctx.createPattern(resources.get('res/imgs/floor.png'), 'repeat');
    this.reset();

    // Load game resources
    await resources.loadImages([
      'res/imgs/freezer.png',
      'res/imgs/freezer-90.png',
      'res/imgs/vegetables.png',
      'res/imgs/vegetables-90.png',
      'res/imgs/vegetables-180.png',
      'res/imgs/virus.svg',
      'res/imgs/closed.png',

      // Player
      'res/imgs/player.svg',
      'res/imgs/player-left.svg',
      'res/imgs/player-right.svg',

      // Seller
      'res/imgs/seller.svg',
      'res/imgs/seller-forget.png',
      'res/imgs/seller-goodbye.png',

      // Buyers
      'res/imgs/buyer1-left.svg', 'res/imgs/buyer1-right.svg',
      'res/imgs/buyer2-left.svg', 'res/imgs/buyer2-right.svg',
      'res/imgs/buyer3-left.svg', 'res/imgs/buyer3-right.svg',
      'res/imgs/buyer4-left.svg', 'res/imgs/buyer4-right.svg',

      // Items
      'res/imgs/items/apple.svg',
      'res/imgs/items/avocado.svg',
      'res/imgs/items/bread.svg',
      'res/imgs/items/broccoli.svg',
      'res/imgs/items/cabbage.svg',
      'res/imgs/items/carrot.svg',
      'res/imgs/items/cereal.svg',
      'res/imgs/items/honey.svg',
      'res/imgs/items/juice.svg',
      'res/imgs/items/milk.svg',
      'res/imgs/items/paper.svg',
      'res/imgs/items/tomato.svg',
    ]);

    document.addEventListener('keydown', evt => {
      if (!this.level) return;
      let playerBB = this.level.player.getBoundingBox();
      if (evt.key == ' ' && !evt.repeat) {
        let itemsBefore = this.level.items.length;
        this.level.items = this.level.items.filter(item => {
          return !boxCollides(playerBB, item.getBoundingBox());
        });
        if (this.level.items.length < itemsBefore) {
          this.dispatchEvent(new CustomEvent('point'));
        } else {
          sounds.play('res/sounds/illegal.mp3', 0.7);
        }
      }
    });

    this.ready = true;
  }

  reset() {
    this.active = false;
    this.ctx.fillStyle = this.floorPattern;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.signs.style.visibility = 'hidden';
  }

  loadLevel(levelBuilder) {
    this.level = levelBuilder();
    this.active = true;
    this.signs.style.visibility = 'visible';

    this.prevLoopTime = Date.now();
    this.mainLoop();
  }

  // The main this.level loop
  mainLoop() {
    if (!this.active) {
      return;
    }
    let now = Date.now();
    let dt = (now - this.prevLoopTime) / 1000.0;
    this.update(dt);
    this.render();

    this.prevLoopTime = now;
    this.requestId = window.requestAnimationFrame(() => this.mainLoop());
  };

  update(dt) {
    // Update entities
    this.level.player.update(dt, (boundingBox) => { // validator
      let collides = false;
      for (let obstacle of this.level.obstacles) {
        if (boxCollides(boundingBox, obstacle.getBoundingBox())) {
          collides = true;
          break;
        }
      }
      let inStore = boxContains({ x: 0, y: 0, width: this.canvas.width, height: this.canvas.height }, boundingBox);
      return !collides && inStore;
    });
    for (let customer of this.level.customers) {
      customer.update(dt);
    }

    // Test loss
    for (let customer of this.level.customers) {
      if (arcCollides(this.level.player.getBoundingArc(), customer.getInfectingArea())) {
        this.stop();
        this.dispatchEvent(new CustomEvent('loss', { detail: { cough: true } }));
        this.playerBlinkSick();
        break;
      }
    }
    for (let virus of this.level.viruses) {
      if (arcCollides(this.level.player.getBoundingArc(), virus.getBoundingArc())) {
        this.stop();
        this.dispatchEvent(new CustomEvent('loss', { detail: { cough: false } }));
        this.playerBlinkSick();
        break;
      }
    }

    // Test win
    if (boxCollides(this.level.player.getBoundingBox(), this.level.exit.getBoundingBox())) {
      if (this.level.items.length == 0) {
        this.stop();
        this.dispatchEvent(new CustomEvent('win'));
        delay(200).then(() => {
          this.level.seller.showPopup('res/imgs/seller-goodbye.png', -10);
          this.render();
        });
      } else if (!this.level.exit.touching) {
        sounds.play('res/sounds/illegal.mp3');
        this.level.seller.showPopup('res/imgs/seller-forget.png', 30);
        this.level.exit.touching = true;
      }
    } else if (this.level.exit.touching) {
      this.level.exit.touching = null;
      this.level.seller.hidePopup();
    }
  }

  render() {
    this.ctx.fillStyle = this.floorPattern;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw entities
    if (this.level.fluffs) {
      for (let fluff of this.level.fluffs) {
        fluff.render(this.ctx);
      }
    }

    for (let customer of this.level.customers) {
      customer.render(this.ctx);
    }

    this.level.player.render(this.ctx);

    for (let virus of this.level.viruses) {
      virus.render(this.ctx);
    }

    for (let obstacle of this.level.obstacles) {
      obstacle.render(this.ctx);
    }
    this.level.exit.render(this.ctx);

    for (let item of this.level.items) {
      item.render(this.ctx);
    }

    this.level.seller.render(this.ctx);
  }

  stop() {
    this.active = false;
  }

  async playerBlinkSick() {
    for (let i = 0; i < 3; i++) {
      await delay(300);
      this.level.player.toggleSick();
      this.render();
    }
  }
}

customElements.define('x-game', Game);
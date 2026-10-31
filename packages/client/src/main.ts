import Phaser from 'phaser';
import { render, h } from 'preact';
import { MatchScene } from './scenes/MatchScene';
import { App } from './ui/App';
import { getLocale, setLocale } from './i18n';

setLocale(getLocale());

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#c9a27e',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [MatchScene],
});

const uiRoot = document.getElementById('ui');
if (uiRoot) render(h(App, {}), uiRoot);

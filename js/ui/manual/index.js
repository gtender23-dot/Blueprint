import { chapter3 } from './anatomy-of-a-play.js';
import { chapter12 } from './building-a-player.js';
import { chapter8 } from './calling-a-game.js';
import { chapter9 } from './defending-a-game.js';
import { chapter } from './reading-a-player.js';
import { chapter13 } from './recruiting.js';
import { chapter11 } from './special-teams.js';
import { chapter10 } from './the-depth-chart.js';
import { chapter6 } from './the-pocket.js';
import { chapter14 } from './the-portal.js';
import { chapter16 } from './the-position-room.js';
import { chapter4 } from './the-pre-snap-read.js';
import { chapter5 } from './the-route-duel.js';
import { chapter7 } from './the-run-fit.js';
import { chapter2 } from './the-year.js';
import { chapter15 } from './your-career.js';
import { chapter17 } from './the-coaching-tree.js';

var MANUAL_CHAPTERS = [
  chapter,
  chapter2,
  chapter3,
  chapter4,
  chapter5,
  chapter6,
  chapter7,
  chapter8,
  chapter9,
  chapter10,
  chapter11,
  chapter12,
  chapter13,
  chapter14,
  chapter15,
  // the coaching tree reads straight off Your Career — the seat and the
  // carousel are its vocabulary.
  chapter17,
  chapter16
  // reference lookup — read start-to-finish it's the last stop; also reachable from card tooltips
];
var chapterById = (id) => MANUAL_CHAPTERS.find((c) => c.id === id) || null;

export { MANUAL_CHAPTERS, chapterById };

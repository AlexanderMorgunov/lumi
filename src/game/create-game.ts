import Phaser from 'phaser';
import type { Direction, Position } from '../domain/puzzle';
import { episodes } from '../domain/episodes';
import { boardGeometry, cellCenter } from './board-geometry';
import type { GameSession } from './session';
import { lumiBaselines } from './lumi-atlas';
import emoteAtlas from './emote-atlas.json';
import { frameFeedback } from './frame-feedback';
import { stationFrame } from './station-animation';
import type { CatMouth } from './cat-mouth';
import {
  stationArt,
  stationIllustrations,
  childFrame,
} from './station-illustrations';
import childAtlas from './station-child-atlas.json';

export type SceneLoadState = 'loading' | 'ready' | 'error';
export type WordTarget = {
  id: string;
  word: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
const backgroundAssets = ['forest', 'room', 'foreground'] as const;
const closingAssets = ['book', 'orange', 'robot', 'umbrella'] as const;
const propTextures: Record<string, string> = {
  key: 'brass-key',
  apple: 'apple',
  apples: 'apple',
  eggs: 'egg',
  book: 'book',
  orange: 'orange',
  robot: 'robot',
  robots: 'robot',
  books: 'book',
  keys: 'brass-key',
  umbrella: 'umbrella',
};
const rows: Record<Direction, number> = { down: 0, left: 1, right: 2, up: 3 };

export function createGame(
  parent: HTMLElement,
  session: GameSession,
  onLoadState: (state: SceneLoadState) => void,
  onWordTargets: (targets: WordTarget[]) => void = () => {},
  getMouth: () => CatMouth = () => 'rest',
) {
  class WorkshopScene extends Phaser.Scene {
    constructor() {
      super('workshop');
    }
    preload() {
      for (const name of stationArt)
        this.load.image(
          name,
          `${import.meta.env.BASE_URL}art/station/review-v1/${name}.webp`,
        );
      this.load.image(
        'station',
        `${import.meta.env.BASE_URL}art/station/station-v1.png`,
      );
      for (const character of ['marta', 'tik'])
        this.load.image(
          `${character}-emotes`,
          `${import.meta.env.BASE_URL}art/station/${character}-emotes-v1.png`,
        );
      for (const name of ['lumi-emotes', 'cat-emotes'])
        this.load.image(
          name,
          `${import.meta.env.BASE_URL}art/lumi/${name}-v1.png`,
        );
      for (const name of closingAssets)
        this.load.image(
          name,
          `${import.meta.env.BASE_URL}art/props/${name}-v1.png`,
        );
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, () =>
        onLoadState('error'),
      );
      for (const name of backgroundAssets)
        this.load.image(
          name,
          `${import.meta.env.BASE_URL}art/lantern-and-moss/${name}-v1.png`,
        );
      this.load.image(
        'lumi',
        `${import.meta.env.BASE_URL}art/lumi/lumi-v1.png`,
      );
      this.load.image(
        'cat-picture',
        `${import.meta.env.BASE_URL}art/lumi/cat-v1.png`,
      );
      this.load.image(
        'brass-key',
        `${import.meta.env.BASE_URL}art/lantern-and-moss/key-v1.png`,
      );
      this.load.image(
        'travel-bag',
        `${import.meta.env.BASE_URL}art/props/travel-bag-v1.png`,
      );
      this.load.image(
        'apple',
        `${import.meta.env.BASE_URL}art/props/apple-v1.png`,
      );
      this.load.image('egg', `${import.meta.env.BASE_URL}art/props/egg-v1.png`);
      this.load.image(
        'apple-green',
        `${import.meta.env.BASE_URL}art/props/apple-green-v1.png`,
      );
    }
    create() {
      if (
        [
          ...backgroundAssets,
          ...stationArt,
          'station',
          'marta-emotes',
          'tik-emotes',
          ...closingAssets,
          'lumi',
          'cat-picture',
          'brass-key',
          'travel-bag',
          'apple',
          'apple-green',
          'egg',
          'lumi-emotes',
          'cat-emotes',
        ].some((name) => !this.textures.exists(name))
      ) {
        onLoadState('error');
        return;
      }
      let level = session.getSnapshot().room.definition;
      for (const character of ['marta', 'tik']) {
        const sheet = this.textures.get(`${character}-emotes`);
        const source = sheet.getSourceImage();
        for (let i = 0; i < 4; i++) {
          const x = Math.floor(((i % 2) * source.width) / 2);
          const y = Math.floor((Math.floor(i / 2) * source.height) / 2);
          sheet.add(
            String(i),
            0,
            x,
            y,
            Math.floor((((i % 2) + 1) * source.width) / 2) - x,
            Math.floor(((Math.floor(i / 2) + 1) * source.height) / 2) - y,
          );
        }
      }
      for (const name of ['nora', 'younger'] as const)
        childAtlas[name].forEach((frame, i) =>
          this.textures
            .get(name)
            .add(String(i), 0, frame.x, frame.y, frame.width, frame.height),
        );
      let field = boardGeometry(level);
      const world = (position: Position) => cellCenter(field, position);
      const texture = this.textures.get('lumi');
      const source = texture.getSourceImage();
      // The provider returned 1254px, not the requested 1024px. Boundaries are
      // computed from the decoded image; no resampling or destructive slicing.
      for (let row = 0; row < 4; row++)
        for (let col = 0; col < 4; col++) {
          const x = Math.floor((col * source.width) / 4);
          const y = Math.floor((row * source.height) / 4);
          texture.add(
            `${row}-${col}`,
            0,
            x,
            y,
            Math.floor(((col + 1) * source.width) / 4) - x,
            Math.floor(((row + 1) * source.height) / 4) - y,
          );
        }
      const backdrop = this.add
        .image(600, 400, 'forest')
        .setDisplaySize(1200, 800)
        .setDepth(0);
      const scenery = this.add
        .image(600, 400, 'room')
        .setDisplaySize(1200, 800)
        .setDepth(10);
      for (const name of ['lumi-emotes', 'cat-emotes'] as const) {
        emoteAtlas[name].frames.forEach((frame, i) =>
          this.textures
            .get(name)
            .add(String(i), 0, frame.x, frame.y, frame.width, frame.height),
        );
      }
      const cat = this.add.image(830, 337, 'cat-emotes', '0').setDepth(31);
      const setEmote = (
        image: Phaser.GameObjects.Image,
        name: keyof typeof emoteAtlas,
        index: number,
        height: number,
      ) => {
        const frame = emoteAtlas[name].frames[index]!;
        image
          .setTexture(name, String(index))
          .setOrigin(frame.originX, frame.originY)
          .setDisplaySize((height * frame.width) / frame.height, height);
      };
      setEmote(cat, 'cat-emotes', 0, 220);
      const layout = () => {
        const width = this.scale.width,
          height = this.scale.height;
        const portrait = width < 600 && height > width;
        const short = height <= 520 && !portrait;
        const talking = parent.dataset.conversation === 'true';
        const left = talking ? 12 : short ? 150 : 12;
        const right =
          talking && !portrait
            ? Math.min(400, Math.max(270, width * 0.32)) + 24
            : short
              ? 150
              : 12;
        const top = level.message
          ? portrait
            ? 174
            : 112
          : portrait
            ? 116
            : talking
              ? 68
              : short
                ? 12
                : 64;
        const bottom =
          talking && portrait
            ? Math.min(height * 0.44, 360) + 24
            : talking
              ? 12
              : portrait
                ? 196
                : short
                  ? 12
                  : 90;
        const zoom = Math.max(
          0.1,
          Math.min(
            (width - left - right) / (talking ? 1200 : 1000),
            (height - top - bottom) /
              (talking ? 800 : level.message ? 560 : 640),
          ),
        );
        const centerX = 600 + (right - left) / (2 * zoom);
        let centerY = (talking ? 400 : 480) + (bottom - top) / (2 * zoom);
        // Seat the room lower instead of centering its cut-out above the forest.
        // Move the camera, so scenery, pieces and DOM listening targets agree.
        const floorBottom = (800 - centerY) * zoom + height / 2;
        let drop = Math.max(
          0,
          (portrait ? height - bottom : height + 8) - floorBottom,
        );
        const hud = parent.closest('.workshop')?.querySelector('.hud-bottom');
        if (!talking && !short && hud) {
          const hudTop =
            hud.getBoundingClientRect().top -
            parent.getBoundingClientRect().top;
          const lastRowBottom =
            (field.top +
              (level.rows - 0.5) * field.height +
              61 * field.scale -
              centerY) *
              zoom +
            height / 2;
          drop = Math.min(drop, Math.max(0, hudTop - 12 - lastRowBottom));
        }
        // Listening replaces part of the free floor with a variable-height
        // status panel; retain its original clearance while it is open.
        if (parent.dataset.listening === 'true') drop = 0;
        centerY -= drop / zoom;
        this.cameras.main.setZoom(zoom).centerOn(centerX, centerY);
        const bgWidth = Math.max(width / zoom, (height / zoom) * 1.5);
        backdrop
          .setPosition(centerX, centerY)
          .setDisplaySize(bgWidth, bgWidth / 1.5);
        onWordTargets(
          session.getSnapshot().room.pieces.flatMap((piece) => {
            if (piece.kind !== 'word') return [];
            const p = world(piece);
            return [
              {
                id: piece.id,
                word: piece.word,
                x: (p.x - centerX) * zoom + width / 2,
                y: (p.y - centerY) * zoom + height / 2,
                width: field.width * zoom * 0.88,
                height: field.height * zoom * 0.76,
              },
            ];
          }),
        );
      };
      this.scale.on(Phaser.Scale.Events.RESIZE, layout);
      this.game.events.on('room-layout', layout);
      layout();
      const grid = this.add.graphics().setDepth(15);
      const frame = this.add.graphics().setDepth(16);
      const frameGlow = this.add.graphics().setDepth(18);
      const frameLabel = this.add
        .text(0, 0, '', {
          fontFamily: 'system-ui',
          fontSize: '21px',
          color: '#f9e4b0',
          backgroundColor: '#203f34',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5, 1)
        .setDepth(100)
        .setVisible(false);
      const beaconPosition = world({ x: 3, y: 2 });
      const beacon = this.add.graphics().setDepth(17);
      beacon
        .fillStyle(0xffd785, 0.2)
        .fillRoundedRect(
          beaconPosition.x - 88,
          beaconPosition.y - 56,
          176,
          112,
          18,
        );
      beacon
        .lineStyle(4, 0xffe2a1, 0.9)
        .strokeRoundedRect(
          beaconPosition.x - 88,
          beaconPosition.y - 56,
          176,
          112,
          18,
        );
      beacon
        .fillStyle(0xffe2a1, 1)
        .fillCircle(beaconPosition.x, beaconPosition.y, 12);
      const wallObjects: Phaser.GameObjects.Container[] = [];
      const rebuildBoard = () => {
        level = session.getSnapshot().room.definition;
        field = boardGeometry(level);
        parent.dataset.columns = String(level.columns);
        parent.dataset.rows = String(level.rows);
        grid.clear().lineStyle(2, 0xffe8b5, 0.35);
        for (let x = 0; x <= level.columns; x++)
          grid.lineBetween(
            field.left + x * field.width,
            field.top,
            field.left + x * field.width,
            field.top + level.rows * field.height,
          );
        for (let y = 0; y <= level.rows; y++)
          grid.lineBetween(
            field.left,
            field.top + y * field.height,
            field.left + level.columns * field.width,
            field.top + y * field.height,
          );
        frame.clear();
        for (const slot of level.slots) {
          const p = world(slot);
          frame
            .fillStyle(0x173e36, 0.82)
            .fillRoundedRect(
              p.x - field.width / 2,
              p.y - field.height / 2 + 2,
              field.width,
              field.height - 4,
              12,
            );
          frame
            .lineStyle(4, 0xf5d58c, 1)
            .strokeRoundedRect(
              p.x - field.width / 2,
              p.y - field.height / 2 + 2,
              field.width,
              field.height - 4,
              12,
            );
        }
        for (const object of wallObjects) object.destroy(true);
        wallObjects.length = 0;
        for (const wall of level.walls) {
          const p = world(wall);
          wallObjects.push(
            this.add
              .container(p.x, p.y, [
                this.add
                  .rectangle(0, 0, 176, 112, 0x45534b)
                  .setStrokeStyle(4, 0x27372f),
                this.add
                  .text(0, 0, '×', {
                    fontFamily: 'system-ui',
                    fontSize: '64px',
                    color: '#c4c7b6',
                  })
                  .setOrigin(0.5),
              ])
              .setScale(field.scale)
              .setDepth(18),
          );
        }
      };
      rebuildBoard();
      const pieceObjects = new Map<string, Phaser.GameObjects.Container>();
      const rebuildPieces = () => {
        for (const object of pieceObjects.values()) object.destroy(true);
        pieceObjects.clear();
        for (const piece of session.getSnapshot().room.pieces) {
          const body = this.add
            .rectangle(
              0,
              0,
              piece.kind === 'word' ? (field.width * 0.94) / field.scale : 170,
              100,
              piece.kind === 'word' ? 0xf6e4ba : 0x765333,
            )
            .setStrokeStyle(4, piece.kind === 'word' ? 0xb7894a : 0x3c3020);
          const children: Phaser.GameObjects.GameObject[] = [
            this.add.ellipse(0, 48, 160, 26, 0x302316, 0.23),
            body,
          ];
          if (piece.kind === 'word') {
            const label = this.add
              .text(0, -4, piece.word, {
                fontFamily: 'system-ui',
                fontSize: '72px',
                fontStyle: '600',
                color: '#302b20',
              })
              .setOrigin(0.5);
            const maxLabelWidth = (field.width * 0.86) / field.scale;
            if (label.width > maxLabelWidth)
              label.setFontSize(Math.floor((72 * maxLabelWidth) / label.width));
            children.push(label);
          } else {
            const cross = this.add.graphics();
            cross
              .lineStyle(9, 0xc29a5d)
              .lineBetween(-65, -33, 65, 33)
              .lineBetween(-65, 33, 65, -33);
            children.push(cross);
          }
          pieceObjects.set(
            piece.id,
            this.add.container(0, 0, children).setScale(field.scale),
          );
        }
      };
      rebuildPieces();
      const shadow = this.add
        .ellipse(0, 0, 88, 23, 0x34271b, 0.28)
        .setDepth(19);
      const actor = this.add
        .image(0, 0, 'lumi', '3-0')
        .setOrigin(0.5, 0.96)
        .setDisplaySize(152 * field.scale, 152 * field.scale);
      const supplyCards = [0, 1, 2].map((index) =>
        this.add
          .container(470 + index * 22, 255 - index * 5, [
            this.add
              .rectangle(0, 0, 60, 64, 0xfff0ce)
              .setStrokeStyle(2, 0xaa7941),
            this.add.image(0, 0, 'cat-picture').setDisplaySize(54, 54),
          ])
          .setDepth(28 + index),
      );
      const delivered = this.add
        .container(625, 235, [
          this.add
            .rectangle(0, 0, 96, 104, 0xfff0ce)
            .setStrokeStyle(5, 0xaa7941),
          this.add.image(0, 0, 'cat-picture').setDisplaySize(88, 88),
        ])
        .setDepth(30)
        .setVisible(false);
      const foreground = this.add
        .image(600, 400, 'foreground')
        .setDisplaySize(1200, 800)
        .setDepth(1000);
      const keySupplies = [0, 1, 2].map((i) =>
        this.add
          .image(360 + i * 90, 250, 'brass-key')
          .setDisplaySize(74, 74)
          .setAngle(-40)
          .setDepth(32),
      );
      const bag = this.add
        .image(655, 280, 'travel-bag')
        .setOrigin(0.5, 1)
        .setDisplaySize(148, 148)
        .setDepth(30);
      const appleSupplies = [0, 1, 2].map((i) =>
        this.add
          .image(360 + i * 90, 250, 'apple')
          .setDisplaySize(72, 72)
          .setDepth(32),
      );
      const deliveredApple = this.add
        .image(680, 234, 'apple')
        .setDisplaySize(56, 56)
        .setDepth(33);
      const eggSupplies = [0, 1, 2].map((i) =>
        this.add
          .image(360 + i * 90, 250, 'egg')
          .setDisplaySize(62, 62)
          .setDepth(32),
      );
      const deliveredEgg = this.add
        .image(625, 250, 'egg')
        .setDisplaySize(48, 48)
        .setDepth(33);
      const deliveredKey = this.add
        .image(655, 238, 'brass-key')
        .setDisplaySize(44, 44)
        .setAngle(-12)
        .setDepth(32);
      // The marker identifies the object, never the correct word tile.
      const referenceRing = this.add
        .ellipse(0, 0, 92, 42)
        .setStrokeStyle(4, 0xffe0a0);
      const referenceLabel = this.add
        .text(0, -76, 'Ключ от двери', {
          fontFamily: 'Georgia, serif',
          fontSize: '28px',
          color: '#fff1d5',
          backgroundColor: '#203f34',
          padding: { x: 10, y: 5 },
        })
        .setOrigin(0.5);
      const referenceArrow = this.add.triangle(
        0,
        -31,
        0,
        0,
        20,
        0,
        10,
        15,
        0xffe0a0,
      );
      const referenceMarker = this.add
        .container(450, 250, [referenceRing, referenceLabel, referenceArrow])
        .setDepth(35)
        .setVisible(false);
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let lastRevision = -1;
      let lastDefinition = session.getSnapshot().room.definition;
      const contextSprites = Array.from({ length: 6 }, () =>
        this.add.image(0, 0, 'brass-key').setDepth(34).setVisible(false),
      );
      const childSprites: {
        sprite: Phaser.GameObjects.Image;
        name: 'nora' | 'younger';
        height: number;
      }[] = [];
      const contextCards = Array.from({ length: 3 }, () =>
        this.add
          .rectangle(0, 0, 116, 100, 0xe7d19e)
          .setStrokeStyle(3, 0x765339)
          .setDepth(33)
          .setVisible(false),
      );
      const contextCaptions = Array.from({ length: 3 }, () =>
        this.add
          .text(0, 0, '', {
            fontFamily: 'Arial, sans-serif',
            fontSize: '21px',
            color: '#fff0ce',
            stroke: '#182b29',
            strokeThickness: 4,
            align: 'center',
            wordWrap: { width: 176 },
          })
          .setOrigin(0.5)
          .setDepth(34)
          .setVisible(false),
      );
      const waitingRobot = this.add
        .image(1000, 260, 'robot')
        .setDisplaySize(118, 118)
        .setDepth(34)
        .setVisible(false);
      const marta = this.add
        .image(830, 418, 'marta-emotes', '0')
        .setOrigin(0.5, 0.97)
        .setDisplaySize(230, 230)
        .setDepth(34)
        .setVisible(false);
      const nameTags = this.add
        .text(420, 304, '', {
          fontFamily: 'Georgia',
          fontSize: '26px',
          color: '#fff0cc',
          backgroundColor: '#213d37',
          padding: { x: 14, y: 8 },
        })
        .setDepth(35)
        .setOrigin(0.5)
        .setVisible(false);
      const stationLight = this.add
        .circle(1007, 176, 45, 0xffca65, 0.22)
        .setDepth(11)
        .setVisible(false);
      const stationFlame = this.add
        .ellipse(1007, 176, 12, 23, 0xffedab, 0.95)
        .setDepth(12)
        .setVisible(false);
      let animation: Phaser.Tweens.Tween | undefined;
      let clock = 0,
        quietSince = 0,
        celebrateUntil = 0,
        thinkUntil = 0,
        glowSince = -10000;
      let previousFrame: ReturnType<typeof frameFeedback> = 'empty';
      const setPose = (direction: Direction, pose: number) => {
        const row = rows[direction];
        actor
          .setTexture('lumi', `${row}-${pose}`)
          .setOrigin(0.5, lumiBaselines[row]?.[pose] ?? 0.94)
          .setDisplaySize(152 * field.scale, 152 * field.scale);
      };
      const settle = () => {
        animation?.stop();
        animation = undefined;
        const state = session.getSnapshot().room;
        const pos = world(state);
        setPose(state.facing, 0);
        actor
          .setPosition(pos.x, pos.y + 43 * field.scale)
          .setDepth(pos.y + 43 * field.scale);
        shadow
          .setPosition(pos.x, pos.y + 38 * field.scale)
          .setScale(field.scale);
        for (const piece of state.pieces) {
          const p = world(piece);
          pieceObjects
            .get(piece.id)
            ?.setPosition(p.x, p.y)
            .setDepth(p.y + 5);
        }
      };
      const onMotion = () => {
        if (motion.matches) {
          celebrateUntil = 0;
          thinkUntil = 0;
          settle();
        }
      };
      motion.addEventListener('change', onMotion);
      const render = () => {
        const snapshot = session.getSnapshot();
        const state = snapshot.room;
        const station = Boolean(state.definition.message);
        marta.setVisible(station);

        parent.dataset.martaVisible = String(marta.visible);
        backdrop.setTint(station ? 0x244250 : 0xffffff);
        waitingRobot.setPosition(1000, station ? 365 : 260);
        const descriptions =
          state.definition.message?.intent === 'describe-self' ||
          Boolean(state.definition.message?.subject) ||
          Boolean(state.definition.message?.intent.endsWith('-recipient'));
        const tags =
          descriptions && state.definition.message
            ? Object.entries(state.definition.message.people).map(
                ([id, person]) => {
                  const message = state.messages.find(
                    (item) =>
                      (item.subject ??
                        (/^You(?: |'re )/.test(item.text)
                          ? item.recipient
                          : item.speaker)) === id,
                  );
                  const description = message?.text.replace(
                    /^(I am|You are|He is|She is|I'm|You're|He's|She's) /,
                    '',
                  );
                  return description && description !== person.name
                    ? `${person.name}: ${description}`
                    : person.name;
                },
              )
            : state.messages.map((message) =>
                message.text.replace(/^(I am|I'm) /, ''),
              );
        nameTags
          .setFontSize(descriptions ? 20 : 26)
          .setText(tags.join(descriptions ? '\n' : '   ·   '))
          .setVisible(
            station &&
              state.definition.message?.intent !== 'describe-object' &&
              state.definition.message?.intent !== 'label-group' &&
              state.definition.message?.intent !== 'exchange' &&
              (descriptions || state.messages.length > 0),
          );
        const stationLit =
          station &&
          (state.messages.length >= 2 ||
            snapshot.completedEpisodes.includes('chapter-02-01'));
        stationLight.setVisible(stationLit);
        stationFlame.setVisible(stationLit);
        scenery
          .setTexture(station ? 'station' : 'room')
          .setDisplaySize(1200, 800);
        cat.setVisible(!station);
        if (state.definition !== lastDefinition) {
          animation?.stop();
          animation = undefined;
          lastDefinition = state.definition;
          lastRevision = -1;
          rebuildBoard();
          rebuildPieces();
          layout();
        }
        grid.setVisible(snapshot.view.grid);
        parent.dataset.levelId = state.definition.id;
        parent.dataset.stage = String(state.stage);
        beacon.setVisible(snapshot.view.beacon);
        foreground.setVisible(snapshot.view.foreground && !station);
        delivered.setVisible(state.episode === 'cat' && state.deliveredItem);
        supplyCards.forEach((card, i) =>
          card.setVisible(
            state.episode === 'cat' && (i !== 2 || !state.deliveredItem),
          ),
        );
        const reference = state.reference;
        const indicated = reference?.objects.find(
          (object) => object.id === reference.indicatedId,
        );
        const referenceDelivered = indicated?.location === 'bag';
        referenceMarker.setVisible(Boolean(indicated));
        referenceRing.setVisible(indicated?.display !== 'record');
        referenceLabel.setVisible(indicated?.display !== 'record');
        referenceArrow.setPosition(0, -31);
        if (reference && indicated) {
          // Object captions sit below the props, clear of the DOM message header.
          referenceLabel.setY(station ? 78 : -76);
          referenceLabel.setText(
            state.definition.reference?.markerLabel ?? 'Указанный предмет',
          );
          const index = reference.objects.findIndex(
            (object) => object.id === indicated.id,
          );
          referenceMarker.setPosition(
            referenceDelivered
              ? indicated.noun === 'apple'
                ? 680
                : 655
              : 360 + index * 90,
            referenceDelivered ? (indicated.noun === 'apple' ? 234 : 238) : 250,
          );
        }
        parent.dataset.referenceTarget = indicated?.id ?? '';
        parent.dataset.referenceLocation = indicated?.location ?? '';
        parent.dataset.referenceNoun = indicated?.noun ?? '';
        parent.dataset.referenceCard = String(indicated?.display === 'card');
        keySupplies.forEach((key, i) =>
          key.setVisible(
            episodes[state.episode].noun === 'key' &&
              (reference
                ? reference.objects[i]?.location === 'table'
                : i !== 2 || !state.deliveredItem),
          ),
        );
        appleSupplies.forEach((apple, i) =>
          apple
            .setTexture(
              reference?.objects[i]?.color === 'green'
                ? 'apple-green'
                : 'apple',
            )
            .setVisible(
              episodes[state.episode].noun === 'apple' &&
                (reference
                  ? reference.objects[i]?.location === 'table'
                  : i !== 2 || !state.deliveredItem),
            ),
        );
        bag.setVisible(state.episode !== 'cat' && !station);
        eggSupplies.forEach((egg, i) =>
          egg.setVisible(
            state.episode === 'egg' && (i !== 2 || !state.deliveredItem),
          ),
        );
        deliveredEgg.setVisible(state.episode === 'egg' && state.deliveredItem);
        deliveredKey.setVisible(
          state.episode === 'apple' ||
            state.episode === 'egg' ||
            state.episode === 'choiceApple' ||
            state.episode === 'theApple' ||
            (episodes[state.episode].noun === 'key' &&
              (reference ? referenceDelivered : state.deliveredItem)),
        );
        deliveredApple
          .setTexture(
            indicated?.noun === 'apple' && indicated.color === 'green'
              ? 'apple-green'
              : 'apple',
          )
          .setVisible(
            state.episode === 'egg' ||
              (episodes[state.episode].noun === 'apple' &&
                (reference ? referenceDelivered : state.deliveredItem)),
          );
        const authored = state.definition.presentation;
        waitingRobot.setVisible(
          station ||
            state.inventory.some(
              (object) =>
                object.noun === 'robot' &&
                object.location === 'door' &&
                !reference?.objects.some((current) => current.id === object.id),
            ),
        );
        childSprites.length = 0;
        parent.dataset.recordIllustrations = '';
        contextSprites.forEach((sprite) =>
          sprite.setVisible(false).setOrigin(0.5).setAngle(0).clearTint(),
        );
        contextCards.forEach((card) =>
          card.setVisible(false).setFillStyle(0xe7d19e, 1),
        );
        contextCaptions.forEach((caption) => caption.setVisible(false));
        if (authored && reference) {
          [
            ...keySupplies,
            ...appleSupplies,
            ...eggSupplies,
            ...supplyCards,
            deliveredKey,
            deliveredApple,
            deliveredEgg,
            delivered,
          ].forEach((object) => object.setVisible(false));
          const objectPosition = (index: number, location: string) =>
            location === 'selected'
              ? { x: 610, y: 305 }
              : location === 'bag'
                ? { x: 680, y: 234 }
                : location === 'door'
                  ? { x: 1000, y: 260 }
                  : station
                    ? { x: 330 + index * 210, y: 300 }
                    : { x: 360 + index * 90, y: 250 };
          reference.objects.forEach((object, index) => {
            const sprite = contextSprites[index * 2];
            if (!sprite) return;
            const pos = objectPosition(index, object.location);
            if (object.display === 'record') {
              const exchange = state.definition.message?.exchange;
              const baggage =
                object.id === 'departure-baggage' && exchange
                  ? {
                      ready: exchange.ready,
                      unknown: exchange.act === 'question' && !state.completed,
                    }
                  : undefined;
              const pictures = stationIllustrations(object, baggage);
              pictures.forEach((picture, item) => {
                const image = contextSprites[index * 2 + item]!;
                image
                  .setTexture(picture.texture, picture.frame)
                  .setOrigin(0.5, 1)
                  .setPosition(
                    pos.x +
                      (pictures.length === 2 ? (item === 0 ? -43 : 43) : 0),
                    pos.y + 55,
                  )
                  .setVisible(true);
                const frame = image.frame;
                const height =
                  pictures.length === 2 && picture.texture !== 'marta-emotes'
                    ? Math.min(
                        picture.height,
                        (82 * frame.height) / frame.width,
                      )
                    : Math.min(
                        picture.height,
                        (166 * frame.height) / frame.width,
                      );
                image.setDisplaySize(
                  (height * frame.width) / frame.height,
                  height,
                );
                if (picture.child)
                  childSprites.push({
                    sprite: image,
                    name: picture.child,
                    height,
                  });
                if (baggage?.unknown) image.setTint(0x777568);
              });
              contextCaptions[index]
                ?.setText(
                  baggage
                    ? baggage.unknown
                      ? 'Собран ли багаж?'
                      : baggage.ready
                        ? 'Багаж собран'
                        : 'Багаж не собран'
                    : (object.caption ?? object.label),
                )
                .setPosition(pos.x, pos.y + 79)
                .setFontSize(18)
                .setVisible(true);
              parent.dataset.recordIllustrations +=
                pictures.map((p) => p.texture).join(',') + ';';
              if (object.id === reference.indicatedId)
                referenceMarker.setPosition(pos.x, pos.y - 65);
              return;
            }
            if (object.display === 'card')
              contextCards[index]
                ?.setSize(116, 100)
                .setStrokeStyle(3, 0x765339)
                .setPosition(pos.x, pos.y)
                .setVisible(true);
            const size =
              propTextures[object.noun] === 'robot'
                ? 118
                : object.noun === 'umbrella'
                  ? 104
                  : propTextures[object.noun] === 'book'
                    ? 86
                    : 74;
            sprite
              .setTexture(propTextures[object.noun] ?? object.noun)
              .setDisplaySize(size, size)
              .setPosition(
                pos.x - (object.count === 2 ? (station ? 36 : 18) : 0),
                pos.y,
              )
              .setAngle(propTextures[object.noun] === 'brass-key' ? -40 : 0)
              .setVisible(true);
            if (object.count === 2)
              contextSprites[index * 2 + 1]!.setTexture(
                propTextures[object.noun] ?? object.noun,
              )
                .setDisplaySize(size, size)
                .setPosition(pos.x + (station ? 36 : 18), pos.y - 5)
                .setAngle(0)
                .setVisible(true);
            if (object.id === reference.indicatedId)
              referenceMarker.setPosition(pos.x, pos.y);
          });
        }
        if (state.revision !== lastRevision) {
          const initial = lastRevision < 0;
          quietSince = clock;
          if (!initial && state.feedback === 'success')
            celebrateUntil = clock + 1400;
          if (
            !initial &&
            [
              'context',
              'article',
              'agreement',
              'order',
              'mismatch',
              'hint',
            ].includes(state.feedback)
          )
            thinkUntil = clock + 1500;
          if (['undo', 'reset'].includes(state.feedback)) {
            celebrateUntil = 0;
            thinkUntil = 0;
          }
          lastRevision = state.revision;
          animation?.stop();
          animation = undefined;
          const target = world(state);
          const moving =
            !initial &&
            !motion.matches &&
            snapshot.view.animations &&
            !snapshot.view.reducedMotion &&
            !snapshot.paused &&
            (state.feedback === 'move' || state.feedback === 'push');
          if (moving) {
            const start = { x: actor.x, y: actor.y };
            const pieces = state.pieces.map((piece) => {
              const object = pieceObjects.get(piece.id)!;
              return {
                object,
                from: { x: object.x, y: object.y },
                to: world(piece),
              };
            });
            const progress = { value: 0 };
            animation = this.tweens.add({
              targets: progress,
              value: 1,
              duration: 240,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                const t = progress.value;
                const pose =
                  state.feedback === 'push'
                    ? t < 0.9
                      ? 3
                      : 0
                    : t < 0.45
                      ? 1
                      : t < 0.9
                        ? 2
                        : 0;
                setPose(state.facing, pose);
                actor
                  .setPosition(
                    Phaser.Math.Linear(start.x, target.x, t),
                    Phaser.Math.Linear(start.y, target.y + 43 * field.scale, t),
                  )
                  .setDepth(actor.y);
                shadow.setPosition(actor.x, actor.y - 5 * field.scale);
                for (const p of pieces)
                  p.object
                    .setPosition(
                      Phaser.Math.Linear(p.from.x, p.to.x, t),
                      Phaser.Math.Linear(p.from.y, p.to.y, t),
                    )
                    .setDepth(p.object.y + 5);
              },
              onComplete: settle,
            });
          } else settle();
        }
        if (snapshot.sceneSuspended) {
          celebrateUntil = 0;
          thinkUntil = 0;
          quietSince = clock;
          settle();
          // Synchronize immediately: ScenePlugin queues pause/resume until the
          // next frame, which can invert rapid React overlay transitions.
          if (this.sys.isActive()) this.sys.pause();
        } else if (this.sys.isPaused()) this.sys.resume();
        present(0, 0);
        layout();
      };
      const present = (_time: number, delta: number) => {
        const snapshot = session.getSnapshot(),
          state = snapshot.room;
        const animated =
          !snapshot.sceneSuspended &&
          snapshot.view.animations &&
          !snapshot.view.reducedMotion &&
          !motion.matches;
        if (animated) clock += Math.min(delta, 100);
        for (const { sprite, name, height } of childSprites) {
          const index = childFrame(name, clock, animated);
          const frame = childAtlas[name][index]!;
          const cellX = (index % 2) * 512;
          sprite
            .setFrame(String(index))
            .setOrigin((cellX + 256 - frame.x) / frame.width, 1)
            .setDisplaySize((height * frame.width) / frame.height, height);
          parent.dataset[name + 'Frame'] = String(index);
        }
        if (state.definition.message) {
          const speaker = parent.dataset.speaker;
          const mouth = animated ? getMouth() : 'rest';
          const martaFrame = stationFrame(
            'marta',
            clock,
            animated,
            speaker === 'marta' ? mouth : 'rest',
          );
          const tikFrame = stationFrame(
            'tik',
            clock + 900,
            animated,
            speaker === 'tik' ? mouth : 'rest',
          );
          // Feet stay planted. Only the upper silhouette gently breathes.
          const breath = animated ? Math.sin(clock / 850) : 0;
          marta
            .setFrame(String(martaFrame))
            .setDisplaySize(230, 230 + breath * 1.4);
          waitingRobot
            .setTexture('tik-emotes', String(tikFrame))
            .setOrigin(0.5, 0.945)
            .setPosition(1000, 418)
            .setDisplaySize(118, 118 + breath * 0.8);
          parent.dataset.martaFrame = String(martaFrame);
          parent.dataset.tikFrame = String(tikFrame);
        } else {
          waitingRobot
            .setTexture('robot')
            .setOrigin(0.5)
            .setPosition(1000, 260)
            .setDisplaySize(118, 118);
          parent.dataset.martaFrame = '0';
          parent.dataset.tikFrame = '0';
        }
        const status = frameFeedback(state);
        if (status !== previousFrame) {
          glowSince = clock;
          previousFrame = status;
        }
        parent.dataset.frameFeedback = status;
        frameGlow.clear();
        frameLabel.setVisible(status !== 'empty' && !animation);
        if (status !== 'empty' && !animation) {
          const first = world(state.definition.slots[0]!),
            last = world(state.definition.slots.at(-1)!);
          frameLabel
            .setText(
              status === 'success'
                ? state.definition.message
                  ? state.definition.message.exchange
                    ? state.definition.message.exchange.act === 'question'
                      ? '✓ Ответ получен'
                      : '✓ Сообщение записано'
                    : state.definition.message.intent === 'label-group'
                      ? '✓ Запись подписана'
                      : state.definition.message.intent === 'describe-object'
                        ? '✓ Описание записано'
                        : state.definition.message.subject
                          ? '✓ Сообщение записано'
                          : state.definition.message.intent.endsWith(
                                '-recipient',
                              )
                            ? '✓ Обращение записано'
                            : state.definition.message.intent ===
                                'describe-self'
                              ? '✓ Описание записано'
                              : '✓ Имя записано'
                  : '✓ Просьба выполнена'
                : 'Фраза собрана · проверь смысл',
            )
            .setPosition((first.x + last.x) / 2, first.y - field.height / 2 - 8)
            .setFontSize(21 * Math.max(0.8, field.scale));
          const pulse = animated
            ? Math.max(0, 1 - (clock - glowSince) / 800)
            : 0;
          for (const slot of state.definition.slots) {
            const p = world(slot);
            frameGlow
              .lineStyle(
                6 + pulse * 3,
                status === 'success' ? 0xffd483 : 0xb1e7d3,
                0.9,
              )
              .strokeRoundedRect(
                p.x - field.width / 2 - 4 - pulse * 5,
                p.y - field.height / 2 - 2 - pulse * 5,
                field.width + 8 + pulse * 10,
                field.height + 4 + pulse * 10,
                16,
              );
          }
        }
        if (animated && !animation) {
          let index: number | null = null;
          let mood = 'rest';
          if (clock < celebrateUntil) {
            index =
              8 +
              Math.min(3, Math.floor((1400 - celebrateUntil + clock) / 350));
            mood = 'joy';
          } else if (
            clock < thinkUntil ||
            (clock - quietSince > 14000 && (clock - quietSince) % 16000 < 1700)
          ) {
            index = 4 + (Math.floor(clock / 400) % 4);
            mood = 'thinking';
          } else if (clock - quietSince > 3500) {
            const t = (clock - quietSince) % 6000;
            index = t < 4500 ? 0 : t < 5000 ? 1 : t < 5200 ? 2 : 3;
            mood = 'idle';
          }
          if (index !== null)
            setEmote(actor, 'lumi-emotes', index, 156 * field.scale);
          else if (actor.texture.key !== 'lumi') setPose(state.facing, 0);
          parent.dataset.lumiMood = mood;
        } else if (!animated && !animation) {
          setPose(state.facing, 0);
          parent.dataset.lumiMood = 'still';
        }
        const catTime = clock % 6200;
        const catDialogue =
          !state.definition.message && parent.dataset.speaker === 'cat';
        const catMouth = animated && catDialogue ? getMouth() : 'rest';
        const catFrame = !animated
          ? 0
          : catDialogue
            ? catMouth === 'open'
              ? 5
              : catMouth === 'closed'
                ? 4
                : 0
            : clock < celebrateUntil
              ? 4 +
                Math.min(3, Math.floor((1400 - celebrateUntil + clock) / 350))
              : catTime < 4700
                ? 0
                : catTime < 4900
                  ? 1
                  : catTime < 5100
                    ? 2
                    : catTime < 5800
                      ? 3
                      : 0;
        setEmote(cat, 'cat-emotes', catFrame, 220);
        parent.dataset.catFrame = String(catFrame);
        parent.dataset.catMouth = catMouth;
      };
      this.events.on(Phaser.Scenes.Events.UPDATE, present);
      const off = session.subscribe(render);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.scale.off(Phaser.Scale.Events.RESIZE, layout);
        this.game.events.off('room-layout', layout);
        off();
        this.events.off(Phaser.Scenes.Events.UPDATE, present);
        motion.removeEventListener('change', onMotion);
        animation?.stop();
      });
      this.events.once(Phaser.Scenes.Events.CREATE, render);
      render();
      onLoadState('ready');
    }
  }
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: parent.clientWidth,
    height: parent.clientHeight,
    backgroundColor: '#30483e',
    pixelArt: false,
    antialias: true,
    scale: { mode: Phaser.Scale.RESIZE },
    scene: [WorkshopScene],
    input: { keyboard: false },
    audio: { noAudio: true },
    banner: false,
  });
}

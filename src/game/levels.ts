/**
 * Handmade levels and BFS pathfinding for Kale Runner
 */

export interface Point {
  x: number;
  y: number;
}

export interface LevelDef {
  number: number;
  name: string;
  teaser: string;
  width: number;
  height: number;
  layout: string[];
  enemies: Array<{ type: 'pizza' | 'soda' | 'donut' | 'cake'; delayWakeUp?: number }>;
  parTime: number; // for time bonus calculation
  veggiesRequired: number; // Number of veggies to eat to unlock the exit door
}

export const LEVELS: LevelDef[] = [
  // Level 1: 15x11, open beginner layout, Pizza + Donut
  {
    number: 1,
    name: 'Garden Gate',
    teaser: 'Level 2: things get greasy',
    width: 15,
    height: 11,
    parTime: 40,
    veggiesRequired: 15,
    enemies: [
      { type: 'pizza', delayWakeUp: 2 },
      { type: 'donut', delayWakeUp: 4 },
    ],
    layout: [
      '###############',
      '#P...........D#',
      '#.###.###.###.#',
      '#.o....1....o.#',
      '#.###.....###.#',
      '#o....###....o#',
      '#.###..3..###.#',
      '#.o.........o.#',
      '#.###.###.###.#',
      '#.............#',
      '###############',
    ],
  },
  // Level 2: 19x13, Pizza + Soda (Accessible flow, 18 veggies to unlock)
  {
    number: 2,
    name: 'Greasy Alley',
    teaser: 'Level 3: the donuts are organizing',
    width: 19,
    height: 13,
    parTime: 55,
    veggiesRequired: 18,
    enemies: [
      { type: 'pizza', delayWakeUp: 2 },
      { type: 'soda', delayWakeUp: 5 },
    ],
    layout: [
      '###################',
      '#P...............D#',
      '#.###.###.###.###.#',
      '#.o...#..1..#...o.#',
      '#.###.###.###.###.#',
      '#...#...#...#...#.#',
      '#o..###..2..###..o#',
      '#...#...#...#...#.#',
      '#.###.###.###.###.#',
      '#.o...#.....#...o.#',
      '#.###.###.###.###.#',
      '#.................#',
      '###################',
    ],
  },
  // Level 3: 21x15, Pizza + Soda + Donut, more dead ends
  {
    number: 3,
    name: 'Bakery Labyrinth',
    teaser: 'Level 4: full buffet',
    width: 21,
    height: 15,
    parTime: 70,
    veggiesRequired: 35,
    enemies: [{ type: 'pizza' }, { type: 'soda' }, { type: 'donut' }],
    layout: [
      '#####################',
      '#P......#...#......D#',
      '#.#####.#.#.#.#####.#',
      '#.o...#...#...#...o.#',
      '###.#.###.###.###.#.#',
      '#...#...1...2...#.#.#',
      '#.###.###.###.###.#.#',
      '#o........#........o#',
      '#.#####.#####.#####.#',
      '#...#.....#.....#...#',
      '###.#.###.#.###.#.###',
      '#...#...3.......#...#',
      '#.###.#######.###.#.#',
      '#o...............o..#',
      '#####################',
    ],
  },
  // Level 4: 23x15, all four enemies, slightly faster
  {
    number: 4,
    name: 'Sugar Rush Junction',
    teaser: 'Level 5: final boss energy',
    width: 23,
    height: 15,
    parTime: 85,
    veggiesRequired: 45,
    enemies: [{ type: 'pizza' }, { type: 'soda' }, { type: 'donut' }, { type: 'cake' }],
    layout: [
      '#######################',
      '#P........#.........D.#',
      '#.#######.#.#########.#',
      '#.o.....#.#.#.......o.#',
      '###.###.#.#.#.#####.###',
      '#...#...#.....#...#...#',
      '#.###.#.###.###.#.###.#',
      '#o....#..1...2..#....o#',
      '#.###.#.###.###.#.###.#',
      '#...#....3...4....#...#',
      '###.###.###.###.###.###',
      '#...#.............#...#',
      '#.###.###########.###.#',
      '#..o...............o..#',
      '#######################',
    ],
  },
  // Level 5: 25x17, all four enemies, fastest, longest route to the door
  {
    number: 5,
    name: 'The Mega Buffet',
    teaser: 'You escaped the buffet.',
    width: 25,
    height: 17,
    parTime: 100,
    veggiesRequired: 55,
    enemies: [{ type: 'pizza' }, { type: 'soda' }, { type: 'donut' }, { type: 'cake' }],
    layout: [
      '#########################',
      '#P........#...#........D#',
      '#.#######.#.#.#.#######.#',
      '#.o.....#...#...#.....o.#',
      '###.###.#####.#####.###.#',
      '#...#...#.........#...#.#',
      '#.###.#.###.###.###.#.#.#',
      '#.....#..1...2..#...#...#',
      '#.###.#.###.###.#.###.###',
      '#...#....3...4....#.....#',
      '###.###.#######.###.###.#',
      '#o....#.........#...#..o#',
      '#.###.#####.#####.#.#.#.#',
      '#...#.....#.#.....#.#.#.#',
      '#.#####.#.#.#.#####.#.#.#',
      '#o......#...........#..o#',
      '#########################',
    ],
  },
];

/**
 * BFS grid helper
 */
export class MazeBFS {
  public width: number;
  public height: number;
  public grid: boolean[][]; // true = walkable, false = wall

  constructor(layout: string[]) {
    this.height = layout.length;
    this.width = layout[0].length;
    this.grid = [];

    for (let y = 0; y < this.height; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < this.width; x++) {
        const char = layout[y][x];
        // '#' is wall, all others are walkable
        row.push(char !== '#');
      }
      this.grid.push(row);
    }
  }

  public isWalkable(x: number, y: number): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      return false;
    }
    return this.grid[y][x];
  }

  /**
   * Find shortest path distance from start to target. Returns -1 if unreachable.
   */
  public getDistance(start: Point, target: Point): number {
    if (start.x === target.x && start.y === target.y) return 0;
    if (!this.isWalkable(start.x, start.y) || !this.isWalkable(target.x, target.y)) return -1;

    const visited: boolean[][] = Array.from({ length: this.height }, () => Array(this.width).fill(false));
    const queue: Array<{ x: number; y: number; dist: number }> = [{ x: start.x, y: start.y, dist: 0 }];
    visited[start.y][start.x] = true;

    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.x === target.x && cur.y === target.y) {
        return cur.dist;
      }

      for (const d of dirs) {
        const nx = cur.x + d.x;
        const ny = cur.y + d.y;
        if (this.isWalkable(nx, ny) && !visited[ny][nx]) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny, dist: cur.dist + 1 });
        }
      }
    }

    return -1;
  }

  /**
   * Determine the next direction (dx, dy) from `from` towards `to`.
   * If reverse is forbidden, passes `forbiddenDx, forbiddenDy`.
   */
  public getNextStep(
    from: Point,
    to: Point,
    forbiddenDir?: { dx: number; dy: number },
  ): { dx: number; dy: number } | null {
    if (from.x === to.x && from.y === to.y) return null;

    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    // Check legal first steps
    const legalSteps = dirs.filter((d) => {
      const nx = from.x + d.dx;
      const ny = from.y + d.dy;
      if (!this.isWalkable(nx, ny)) return false;
      if (forbiddenDir && d.dx === forbiddenDir.dx && d.dy === forbiddenDir.dy) {
        return false;
      }
      return true;
    });

    if (legalSteps.length === 0) {
      // If no steps without forbidden, allow reversing if walkable
      if (forbiddenDir) {
        const nx = from.x + forbiddenDir.dx;
        const ny = from.y + forbiddenDir.dy;
        if (this.isWalkable(nx, ny)) return { dx: forbiddenDir.dx, dy: forbiddenDir.dy };
      }
      return null;
    }

    let bestDist = Infinity;
    let bestStep: { dx: number; dy: number } = legalSteps[0];

    for (const step of legalSteps) {
      const nextTile = { x: from.x + step.dx, y: from.y + step.dy };
      const dist = this.getDistance(nextTile, to);
      if (dist !== -1 && dist < bestDist) {
        bestDist = dist;
        bestStep = step;
      }
    }

    return bestStep;
  }

  /**
   * Find the step that moves FARTHEST from target (for frightened fleeing)
   */
  public getFleeStep(
    from: Point,
    target: Point,
    forbiddenDir?: { dx: number; dy: number },
  ): { dx: number; dy: number } | null {
    const dirs = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 },
    ];

    const legalSteps = dirs.filter((d) => {
      const nx = from.x + d.dx;
      const ny = from.y + d.dy;
      if (!this.isWalkable(nx, ny)) return false;
      if (forbiddenDir && d.dx === forbiddenDir.dx && d.dy === forbiddenDir.dy) {
        return false;
      }
      return true;
    });

    if (legalSteps.length === 0) {
      if (forbiddenDir && this.isWalkable(from.x + forbiddenDir.dx, from.y + forbiddenDir.dy)) {
        return { dx: forbiddenDir.dx, dy: forbiddenDir.dy };
      }
      return null;
    }

    let maxDist = -1;
    let bestStep: { dx: number; dy: number } = legalSteps[0];

    for (const step of legalSteps) {
      const nextTile = { x: from.x + step.dx, y: from.y + step.dy };
      const dist = this.getDistance(nextTile, target);
      if (dist > maxDist) {
        maxDist = dist;
        bestStep = step;
      }
    }

    return bestStep;
  }

  /**
   * Find nearest walkable point to a coordinate (e.g. for Donut ambushing)
   */
  public getNearestWalkable(target: Point): Point {
    if (this.isWalkable(target.x, target.y)) return target;

    for (let r = 1; r < Math.max(this.width, this.height); r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = target.x + dx;
          const ny = target.y + dy;
          if (this.isWalkable(nx, ny)) {
            return { x: nx, y: ny };
          }
        }
      }
    }
    return { x: 1, y: 1 };
  }
}

/**
 * Validate that player start can reach exit door and every pellet in the level
 */
export function validateLevelReachability(level: LevelDef): { valid: boolean; errors: string[] } {
  const bfs = new MazeBFS(level.layout);
  const errors: string[] = [];

  let playerStart: Point | null = null;
  let exitDoor: Point | null = null;
  const veggies: Point[] = [];
  const powerVeggies: Point[] = [];
  const enemySpawns: Array<{ id: string; pt: Point }> = [];

  for (let y = 0; y < level.height; y++) {
    for (let x = 0; x < level.width; x++) {
      const char = level.layout[y][x];
      if (char === 'P') playerStart = { x, y };
      else if (char === 'D') exitDoor = { x, y };
      else if (char === '.') veggies.push({ x, y });
      else if (char === 'o') powerVeggies.push({ x, y });
      else if (char === '1' || char === '2' || char === '3' || char === '4') {
        enemySpawns.push({ id: char, pt: { x, y } });
      }
    }
  }

  if (!playerStart) {
    errors.push(`Level ${level.number}: Missing player start 'P'`);
    return { valid: false, errors };
  }
  if (!exitDoor) {
    errors.push(`Level ${level.number}: Missing exit door 'D'`);
    return { valid: false, errors };
  }

  const doorDist = bfs.getDistance(playerStart, exitDoor);
  if (doorDist === -1) {
    errors.push(`Level ${level.number}: Exit door at (${exitDoor.x}, ${exitDoor.y}) is UNREACHABLE from player start (${playerStart.x}, ${playerStart.y})`);
  }

  let unreachablePellets = 0;
  for (const v of veggies) {
    if (bfs.getDistance(playerStart, v) === -1) {
      unreachablePellets++;
    }
  }
  for (const pv of powerVeggies) {
    if (bfs.getDistance(playerStart, pv) === -1) {
      unreachablePellets++;
    }
  }
  if (unreachablePellets > 0) {
    errors.push(`Level ${level.number}: ${unreachablePellets} pellets are unreachable!`);
  }

  for (const es of enemySpawns) {
    if (bfs.getDistance(playerStart, es.pt) === -1) {
      errors.push(`Level ${level.number}: Enemy spawn ${es.id} at (${es.pt.x}, ${es.pt.y}) is unreachable!`);
    }
  }

  const valid = errors.length === 0;
  // Only print level-check details while developing, never on the live site.
  if (import.meta.env.DEV) {
    if (valid) {
      console.log(
        `[Validation] Level ${level.number} (${level.name}) PASSED: Door reachable (${doorDist} steps), ${veggies.length} veggies, ${powerVeggies.length} power veggies.`
      );
    } else {
      console.error(`[Validation] Level ${level.number} FAILED:`, errors);
    }
  }

  return { valid, errors };
}

import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { db } from './firebase-config';
import { collection, query, where, deleteDoc, addDoc, updateDoc, setDoc, doc, onSnapshot } from "firebase/firestore";

type player = {
  x: number,
  y: number,
  matrix: number[][] | null;
}

type next = {
  one: number[][] | null,
  two: number[][] | null,
  three: number[][] | null,
}

const numRows = 15;
const numCols = 10;

const holdRows = 4;
const holdCols = 4;

const nextRows = 12;
const nextCols = 4;

const colors: string[] = [
  'black',
  'purple',
  'yellow',
  'orange',
  'blue',
  'cyan',
  'green',
  'red',
]

const useKey = (key: string, callback: () => void) => {
  const callbackRef = useRef<() => void>();
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  useEffect(() => {
    const downHandler = (e: KeyboardEvent) => {
      if (e.key === key) {
        callbackRef.current();
      }
    }
    window.addEventListener('keydown', downHandler);
    return () => {
      window.removeEventListener('keydown', downHandler);
    }
  }, [key]);
}

const App = () => {

  const canvasRef = useRef(null);
  const holdRef = useRef(null);
  const nextRef = useRef(null);
  const holdTextRef = useRef(null);
  const nextTextRef = useRef(null);
  const enemyRef = useRef(null);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState<player>({ x: 0, y: 0, matrix: null });
  const [arena, setArena] = useState<number[][]>(null);
  const [sumTime, setSumTime] = useState<number>(-1);
  const [dropTime, setDropTime] = useState<number>(500);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [gameOver, setGameOver] = useState(true);
  const [holdPieceArena, setHoldPieceArena] = useState<number[][]>(null);
  const [holdPiece, setHoldPiece] = useState<number[][] | null>(null);
  const [holdPieceCanvas, setHoldPieceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [holdPieceContext, setHoldPieceContext] = useState<CanvasRenderingContext2D | null>(null);
  const [nextPieceArena, setNextPieceArena] = useState<number[][]>(null);
  const [nextPiece, setNextPiece] = useState<next>({ one: null, two: null, three: null });
  const [nextPieceCanvas, setNextPieceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [nextPieceContext, setNextPieceContext] = useState<CanvasRenderingContext2D | null>(null);
  const [enemyCanvas, setEnemyCanvas] = useState<HTMLCanvasElement | null>(null);
  const [enemyContext, setEnemyContext] = useState<CanvasRenderingContext2D | null>(null);
  const [enemy, setEnemy] = useState({ score: 0, level: 1 });
  const [enemyArena, setEnemyArena] = useState<number[][]>(null);
  const [playerRef, setPlayerRef] = useState(null);
  const [playerString, setPlayerString] = useState<string>(null);
  const [ready, setReady] = useState<boolean>(false);
  const [enemyId, setEnemyId] = useState<string>(null);
  const [unsub, setUnsub] = useState<() => void>(null);

  useKey("ArrowLeft", () => player.matrix ? playerMove(-1) : null);
  useKey("ArrowRight", () => player.matrix ? playerMove(1) : null);
  useKey("ArrowDown", () => player.matrix ? drop() : null);
  useKey("ArrowUp", () => player.matrix ? hardDrop() : null);
  useKey("q", () => player.matrix ? playerRotate(-1) : null);
  useKey("w", () => player.matrix ? playerRotate(1) : null);
  useKey("e", () => player.matrix ? hold() : null);

  useEffect(() => {
    initArena();
    initText();
    setArena(generateBoard(numRows, numCols));
    setEnemyArena(generateBoard(numRows, numCols));
    setHoldPieceArena(generateBoard(holdRows, holdCols));
    setNextPieceArena(generateBoard(nextRows, nextCols));
  }, []);

  // const collectionRef = collection(db, "users");
  //     const playerInfo = { ready: true };
  //     const docRef = await addDoc(collectionRef, playerInfo);
  //     const q = query(collection(db, "users"), where("ready", "==", true));
  //     const unsub = onSnapshot(q, (snapshot) => {
  //       snapshot.docs.forEach(async (doc) => {
  //         if (doc.id === docRef.id) return;
  //         setEnemyId(doc.id);
  //         setUnsub(unsub);
  //         // await updateEnemy(doc.data().x, doc.data().y, doc.data().arena, doc.data().score, doc.data().level );
  //       });
  //     });

  useEffect(() => {
    if(!enemyId) return;
    const collectionRef = collection(db, "users");
    onSnapshot(collectionRef, (snapshot) => {
      snapshot.docs.forEach(async (doc) => {
        if(doc.id !== enemyId) return;
        await updateEnemy(doc.data().x, doc.data().y, doc.data().arena, doc.data().score, doc.data().level );
      });
    });
  }, [enemyId]);

  useEffect(() => {
    if (!nextPiece.one || !nextPiece.two || !nextPiece.three) return;
    setNextPieceArena(mergeNextReturn(nextPieceArena, [nextPiece.one, nextPiece.two, nextPiece.three], nextRows, nextCols));
  }, [nextPiece])

  useEffect(() => {
    if (!nextPieceArena) return;
    for (let i = 0; i < nextPieceArena.length; i++) {
      for (let j = 0; j < nextPieceArena[0].length; j++) {
        drawNextPiece(j, i, holdPiece);
      }
    }
  }, [nextPieceArena])

  useEffect(() => {
    if (!holdPiece) return;
    setHoldPieceArena(mergeHoldReturn(holdPieceArena, holdPiece, holdRows, holdCols));
  }, [holdPiece])

  useEffect(() => {
    if (!holdPieceArena) return;
    for (let i = 0; i < holdPieceArena.length; i++) {
      for (let j = 0; j < holdPieceArena[0].length; j++) {
        drawHoldPiece(j, i, holdPiece);
      }
    }
  }, [holdPieceArena])

  useEffect(() => {
    if (sumTime < 0) return;
    const interval = setInterval(() => {
      setSumTime(sumTime + 10);
    }, 10);
    if (sumTime > dropTime) {
      drop();
    }
    return () => clearInterval(interval);
  }, [sumTime])

  useEffect(() => {
    if (!arena) return;
    draw(context, arena);
    if (player.matrix) {
      const offset = hardPlayerDrop();
      for (let i = 0; i < player.matrix.length; i++) {
        for (let j = 0; j < player.matrix[i].length; j++) {
          if (player.matrix[i][j] != 0) {
            drawPlayer(j, i, { x: player.x, y: player.y }, context);
            drawPlayerDrop(j, i, { x: player.x, y: player.y + offset }, context);
          }
        }
      }
    }
    drawGrid(context);
  }, [arena])

  useEffect(() => {
    if (!enemyArena) return;
    draw(enemyContext, enemyArena);
    drawGrid(enemyContext);
  }, [enemyArena])

  useEffect(() => {
    if (!player.matrix) return;
    draw(context, arena);
    const offset = hardPlayerDrop();
    for (let i = 0; i < player.matrix.length; i++) {
      for (let j = 0; j < player.matrix[i].length; j++) {
        if (player.matrix[i][j] != 0) {
          drawPlayer(j, i, { x: player.x, y: player.y }, context);
          drawPlayerDrop(j, i, { x: player.x, y: player.y + offset }, context);
        }
      }
    }
    drawGrid(context);
    if (!playerRef || !enemyId) return;
    updateData();
  }, [player])

  const updateEnemy = (x: number, y: number, array: number[], score: number, level: number) => {
    if (!array) return;
    let newArena: number[][] = generateBoard(numRows, numCols);
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        newArena[i][j] = array[i * 10 + j];
      }
    }
    setEnemy({score, level})
    setEnemyArena(newArena);
  }

  const updateData = async () => {
    const tempArena = [];
    const newArena = arena.slice();
    newArena.forEach((_, y) => {
      newArena[y].forEach((value, x) => {
        tempArena.push(value);
      })
    })
    player.matrix.forEach((_, y) => {
      player.matrix[y].forEach((value, x) => {
        if(value != 0) {
          tempArena[(player.y + y) * numCols + player.x + x] = value;
        }
      })
    })
    const playerInfo = { x: player.x, y: player.y, arena: tempArena, score: score, level: level };
    await setDoc(playerRef, playerInfo);
  }

  const initText = () => {
    const holdTextCanvas = holdTextRef.current;
    const nextTextCanvas = nextTextRef.current;
    const holdTextContext = holdTextCanvas.getContext("2d");
    const nextTextContext = nextTextCanvas.getContext("2d");
    holdTextContext.canvas.width = 140;
    holdTextContext.canvas.height = 20;
    nextTextContext.canvas.width = 140;
    nextTextContext.canvas.height = 20;
    holdTextContext.font = "15px Arial";
    holdTextContext.fillStyle = "black";
    holdTextContext.fillText("Hold", 10, 15);
    nextTextContext.font = "15px Arial";
    nextTextContext.fillStyle = "black";
    nextTextContext.fillText("Next", 10, 15);
  }

  const initArena = () => {
    const canvas = canvasRef.current;
    setCanvas(canvas);
    const context = canvas.getContext('2d');
    setContext(context);
    const holdCanvas = holdRef.current;
    setHoldPieceCanvas(holdCanvas);
    const holdContext = holdCanvas.getContext('2d');
    setHoldPieceContext(holdContext);
    const nextCanvas = nextRef.current;
    setNextPieceCanvas(nextCanvas);
    const nextContext = nextCanvas.getContext('2d');
    setNextPieceContext(nextContext);
    context.canvas.width = numCols * 40;
    context.canvas.height = numRows * 40;
    context.scale(40, 40);
    holdContext.canvas.width = holdCols * 35;
    holdContext.canvas.height = holdRows * 35;
    holdContext.scale(35, 35);
    nextContext.canvas.width = nextCols * 35;
    nextContext.canvas.height = nextRows * 35;
    nextContext.scale(35, 35);
    const enemyCanvas = enemyRef.current;
    setEnemyCanvas(enemyCanvas);
    const enemyContext = enemyCanvas.getContext('2d');
    setEnemyContext(enemyContext);
    enemyContext.canvas.width = numCols * 40;
    enemyContext.canvas.height = numRows * 40;
    enemyContext.scale(40, 40);
  }

  const generateBoard = (row: number, col: number) => {
    const rows = [];
    for (let i = 0; i < row; i++) {
      rows.push(Array.from(Array(col), () => 0));
    }
    return rows;
  }

  const draw = (context: CanvasRenderingContext2D, arena: number[][]) => {
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        drawPiece(j, i, { x: 0, y: 0 }, context, arena);
      }
    }
  }

  const drop = () => {
    if (collide(arena, { x: player.x, y: player.y + 1, matrix: player.matrix })) {
      merge(arena, { x: player.x, y: player.y, matrix: player.matrix });
      setPlayer({ x: player.x, y: player.y, matrix: player.matrix });
      playerReset();
      arenaSweep();
    } else {
      setPlayer({ x: player.x, y: player.y + 1, matrix: player.matrix });
    }
    if (gameOver) return;
    setSumTime(0);
  }

  const hardPlayerDrop = () => {
    let count = 0;
    if (collide(arena, { x: player.x, y: player.y + 1, matrix: player.matrix })) return count;
    while (!collide(arena, { x: player.x, y: player.y + count, matrix: player.matrix })) {
      count++;
    }
    return count - 1;
  }

  const hardDrop = () => {
    let count = 0;
    while (!collide(arena, { x: player.x, y: player.y + count, matrix: player.matrix })) {
      count++;
    }
    setPlayer({ x: player.x, y: player.y + count - 1, matrix: player.matrix });
    merge(arena, { x: player.x, y: player.y + count - 1, matrix: player.matrix });
    playerReset();
    setSumTime(0);
    arenaSweep();

  }

  const playerRotate = (dir) => {
    let offset = 1;
    rotate(player.matrix, dir);
    let tempx = player.x;
    while (collide(arena, { x: tempx, y: player.y, matrix: player.matrix })) {
      tempx += offset;
      offset = -(offset + (offset > 0 ? 1 : -1));
      if (offset > player.matrix[0].length) {
        rotate(player.matrix, -dir);
        setPlayer({ x: player.x, y: player.y, matrix: player.matrix });
        return;
      }
    }
    setPlayer({ x: tempx, y: player.y, matrix: player.matrix });
  }

  const rotate = (matrix, dir) => {
    try {
      for (let y = 0; y < matrix.length; y++) {
        for (let x = 0; x < y; x++) {
          [
            matrix[x][y],
            matrix[y][x],
          ] = [
              matrix[y][x],
              matrix[x][y],
            ];

        }
      }
      if (dir > 0) {
        matrix.forEach(row => row.reverse());
      } else {
        matrix.reverse();
      }
    } catch (e) {
      return;
    }
  }

  const playerMove = (dir) => {
    if (collide(arena, { x: player.x + dir, y: player.y, matrix: player.matrix })) return;
    setPlayer({ x: player.x + dir, y: player.y, matrix: player.matrix });
  }

  const collide = (arena: number[][], player: player) => {
    const [m, o] = [player.matrix, { x: player.x, y: player.y }];
    for (let y = 0; y < m.length; y++) {
      for (let x = 0; x < m[y].length; x++) {
        if (m[y][x] != 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) != 0) {
          return true;
        }
      }
    }
    return false;
  }

  const mergeHoldReturn = (arena: number[][], matrix: number[][], row: number, col: number) => {
    const newArena: number[][] = generateBoard(row, col);
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value != 0 && value) {
          newArena[y][x] = value;
        }
      })
    })
    return newArena;
  }

  const mergeEnemy = (nope: number[][], matrix: number[][], offset: { x: number, y: number }) => {
    console.table(arena);
    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value != 0 && value) {
          nope[y + offset.y][x + offset.x] = value;
        }
      })
    })
    return nope;
  }

  const mergeNextReturn = (arena: number[][], matrix: [matrix1: number[][], matrix2: number[][], matrix3: number[][]], row: number, col: number) => {
    const newArena: number[][] = generateBoard(row, col);
    for (let i = 0; i < matrix.length; i++) {
      matrix[i].forEach((row, y) => {
        row.forEach((value, x) => {
          if (value != 0 && value) {
            newArena[i * 4 + y][x] = value;
          }
        })
      })
    }

    return newArena;
  }

  const merge = (arena: number[][], player: player) => {
    try {
      const newArena: number[][] = arena.slice();
      player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
          if (value != 0 && value) {
            if (newArena[y + player.y][x + player.x] != 0) throw new Error('error');
            newArena[y + player.y][x + player.x] = value;
          }
        })
      })
      setArena(newArena);
    } catch (error) {
      setGameOver(true);
      setSumTime(-1);
      setPlayer({ x: 0, y: 0, matrix: null });
      setArena(generateBoard(numRows, numCols));
    }
  }

  const arenaSweep = () => {
    const newArena: number[][] = arena.slice();
    let newScore = score;
    let rowCount = 1;
    outer: for (let y = newArena.length - 1; y > 0; y--) {
      for (let x = 0; x < newArena[y].length; x++) {
        if (newArena[y][x] === 0) {
          continue outer;
        }
      }
      const row = newArena.splice(y, 1)[0].fill(0);
      newArena.unshift(row);
      y++;
      newScore += rowCount * 10;
      rowCount *= 2;
    }
    updateLevel(newScore);
    setArena(newArena);
    setScore(newScore);
  }

  const updateLevel = (newScore: number) => {
    if(newScore > level * 100) {
      setLevel(level + 1);
      setDropTime(dropTime * 0.9);
    }
  }

  const drawGrid = (context: CanvasRenderingContext2D) => {
    context.globalAlpha = 0.5;
    context.strokeStyle = '#ccc';
    context.lineWidth = 0.01;
    for (let i = 0; i < numRows; i++) {
      context.beginPath();
      context.moveTo(0, i);
      context.lineTo(numCols, i);
      context.stroke();
    }
    for (let i = 0; i < numCols; i++) {
      context.beginPath();
      context.moveTo(i, 0);
      context.lineTo(i, numRows);
      context.stroke();
    }
  }

  const drawPlayerDrop = (x: number, y: number, offset: { x: number, y: number }, context: CanvasRenderingContext2D) => {
    context.globalAlpha = 0.2;
    context.fillStyle = colors[player.matrix[y][x]];
    context.fillRect(offset.x + x, offset.y + y, 1, 1);
  }

  const drawPlayer = (x: number, y: number, offset: { x: number, y: number }, context: CanvasRenderingContext2D) => {
    context.globalAlpha = 1;
    context.fillStyle = colors[player.matrix[y][x]];
    context.fillRect(offset.x + x, offset.y + y, 1, 1);
  }

  const playerReset = () => {
    const piece = nextPiece.one;
    setNextPiece({ one: nextPiece.two, two: nextPiece.three, three: createPiece(Math.floor(Math.random() * 7) + 1) });
    setPlayer({ x: (arena[0].length / 2 | 0) - (piece[0].length / 2 | 0), y: 0, matrix: piece });
  }

  const drawPiece = (x: number, y: number, offset: { x: number, y: number }, context: CanvasRenderingContext2D, arena: number[][]) => {
    context.globalAlpha = 1;
    context.fillStyle = colors[arena[y][x]];
    context.fillRect(offset.x + x, offset.y + y, 1, 1);
  }

  const drawHoldPiece = (x: number, y: number, matrix: number[][]) => {
    holdPieceContext.fillStyle = colors[holdPieceArena[y][x]];
    holdPieceContext.fillRect(x, y, 1, 1);
  }

  const drawNextPiece = (x: number, y: number, matrix: number[][]) => {
    nextPieceContext.fillStyle = colors[nextPieceArena[y][x]];
    nextPieceContext.fillRect(x, y, 1, 1);
  }

  const hold = () => {
    if (holdPiece) {
      const piece = holdPiece;
      setHoldPiece(player.matrix);
      setPlayer({ x: (arena[0].length / 2 | 0) - (piece[0].length / 2 | 0), y: 0, matrix: piece });
    } else {
      setHoldPiece(player.matrix);
      playerReset();
    }
  }

  const createPieces = () => {
    setNextPiece({ one: createPiece(Math.floor(Math.random() * 7) + 1), two: createPiece(Math.floor(Math.random() * 7) + 1), three: createPiece(Math.floor(Math.random() * 7) + 1) });
  }

  const playerResetStart = () => {
    const piece = createPiece(Math.floor(Math.random() * 7) + 1);
    setPlayer({ x: (arena[0].length / 2 | 0) - (piece[0].length / 2 | 0), y: 0, matrix: piece });
    setArena(generateBoard(numRows, numCols));
    setSumTime(0);
    setScore(0);
    setLevel(1);
    setDropTime(500);
  }

  const start = () => {
    setGameOver(false);
    createPieces();
    draw(context, arena);
    playerResetStart();
  }

  const readyUp = async () => {
    if (!ready) {
      const collectionRef = collection(db, "users");
      const playerInfo = { ready: true };
      const docRef = await addDoc(collectionRef, playerInfo);
      const q = query(collection(db, "users"), where("ready", "==", true));
      const unsub = onSnapshot(q, (snapshot) => {
        snapshot.docs.forEach(async (doc) => {
          if (doc.id === docRef.id) return;
          setEnemyId(doc.id);
          setUnsub(unsub);
          // await updateEnemy(doc.data().x, doc.data().y, doc.data().arena, doc.data().score, doc.data().level );
        });
      });
      setPlayerString(docRef.id);
      setPlayerRef(docRef);
    } else {
      const docRef = doc(db, "users", playerString);
      await deleteDoc(docRef);
      setEnemyArena(generateBoard(numRows, numCols));
      setEnemy({score: 0, level: 1})
    }
    setReady(!ready);
  }

  const createPiece = (type: number) => {
    switch (type) {
      case 1:
        return [
          [0, 0, 0, 0],
          [1, 1, 1, 0],
          [0, 1, 0, 0],
          [0, 0, 0, 0],
        ];
      case 2:
        return [
          [0, 0, 0, 0],
          [0, 2, 2, 0],
          [0, 2, 2, 0],
          [0, 0, 0, 0],
        ];
      case 3:
        return [
          [0, 3, 0, 0],
          [0, 3, 0, 0],
          [0, 3, 3, 0],
          [0, 0, 0, 0],
        ];
      case 4:
        return [
          [0, 0, 4, 0],
          [0, 0, 4, 0],
          [0, 4, 4, 0],
          [0, 0, 0, 0],
        ];
      case 5:
        return [
          [0, 5, 0, 0],
          [0, 5, 0, 0],
          [0, 5, 0, 0],
          [0, 5, 0, 0],
        ];
      case 6:
        return [
          [0, 0, 0, 0],
          [0, 6, 6, 0],
          [6, 6, 0, 0],
          [0, 0, 0, 0],
        ];
      case 7:
        return [
          [0, 0, 0, 0],
          [7, 7, 0, 0],
          [0, 7, 7, 0],
          [0, 0, 0, 0],
        ];
      default: return null;
    }
  }

  return (
    <div className="App">
      <div>
        <canvas className="app-tetris" ref={canvasRef}></canvas>
        <div className="hold-next">
          <canvas className="hold-text" ref={holdTextRef}></canvas>
          <canvas className="hold" ref={holdRef}></canvas>
          <canvas className="next-text" ref={nextTextRef}></canvas>
          <canvas className="next" ref={nextRef}></canvas>
        </div>
        <canvas className="enemy-tetris" ref={enemyRef}></canvas>
      </div>
      <div>
        {`Score: ${score} \t Level: ${level}`}
        {`Score: ${enemy.score} \t Level: ${enemy.level}`}
      </div>
      <button onClick={() => start()}>Start</button>
      <button onClick={() => readyUp()}>{ready ? "Ready" : "Not Ready"}</button>
    </div>
  );
}

export default App;

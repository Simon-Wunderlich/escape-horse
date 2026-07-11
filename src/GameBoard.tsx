import {useContext, useEffect, useRef, useState} from "react";
import type Tile from "./interfaces/tile.tsx";
import {Canvas, FabricImage} from 'fabric'
import MQTTContext from "./MQTTContext.tsx";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
enum Directions {
    N = "a",
    NE = "b",
    SE = "c",
    S = "d",
    SW = "e",
    NW = "f"
}

const opposites = {
    "a": "d",
    "b": "e",
    "c": "f",
    "d": "a",
    "e": "b",
    "f": "c"
}

function getNextTileOffset(direction: Directions) {
    const X_OFFSET = TILE_WIDTH / 2 + 20
    const Y_OFFSET = TILE_HEIGHT / 2 + 5
    switch (direction) {
        case Directions.N:
            return [0, TILE_HEIGHT + 10]
        case Directions.NE:
            return [X_OFFSET, Y_OFFSET]
        case Directions.SE:
            return [X_OFFSET, -Y_OFFSET]
        case Directions.S:
            return [0, -TILE_HEIGHT - 10]
        case Directions.SW:
            return [-X_OFFSET, -Y_OFFSET]
        case Directions.NW:
            return [-X_OFFSET, Y_OFFSET]
    }
}

const directionList = [Directions.N, Directions.NE, Directions.SE, Directions.S, Directions.SW, Directions.NW]

const TILE_WIDTH = 45
const TILE_HEIGHT = 40

export default function GameBoard({id, mode, blocks}: { id: string, mode: "horse" | "blocker", blocks: string[] }) {
    const [waiting, setWaiting] = useState(mode == "blocker")
    const [horseTile, sethorseTile] = useState<Tile | null>()
    const [tilePositions] = useState<Map<string, string>>(new Map)
    const [tileMap] = useState<Map<string, Tile>>(new Map)
    const [disposers, setDisposers] = useState<VoidFunction[]>([])
    const [winner, setWinner] = useState("")
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);

    const context = useContext(MQTTContext)
    if (context === null)
        throw new Error('MQTTContext must be used within MQTTProvider');

    const {subscribe, sendMessage, unsubscribe} = context

    function findAvailableTiles(tile: Tile) {
        const neighbours: Tile[] = [];
        [...tile.neighbours.values()].map((neighbour) => {
            if (neighbour.state != "blocked") {
                neighbours.push(neighbour)
            }
        })
        return neighbours
    }


    function onMessage(message: string) {
        if (!fabricCanvasRef) return
        const canvas = fabricCanvasRef.current
        if (!canvas) return;
        const body = JSON.parse(message)
        const tile = tileMap.get(body["id"])
        if (!tile)
            return

        setWaiting(false)

        if (mode == "blocker") {
            moveHorse(tile, canvas)
        } else
            placeBlock(tile, canvas)
    }


    async function handleClick(tile: Tile) {
        if (!fabricCanvasRef) return
        if (waiting) return
        const canvas = fabricCanvasRef.current

        const topic = `${id}/${mode == "horse" ? "blocker" : "horse"}`

        if (!canvas) return;

        if (mode == "horse") {
            if (await moveHorse(tile, canvas)) {
                setWaiting(true)
                sendMessage(topic, JSON.stringify({"id": tile.id}))
            }
        } else if (await placeBlock(tile, canvas)) {
            setWaiting(true)
            sendMessage(topic, JSON.stringify({"id": tile.id}))
        }

        canvas.renderAll()
    }

    async function moveHorse(tile: Tile, canvas: Canvas) {
        if (tile.state != "available")
            return false
        if (tile == horseTile)
            return false
        if (horseTile) {
            horseTile.state = "empty"
            await horseTile.image.setSrc("/tile.png")
            const currentAvailable = findAvailableTiles(horseTile);
            for (const _tile of currentAvailable) {
                if (_tile.state == "available") {
                    _tile.state = "empty";
                    _tile.available.opacity = 0
                }
            }
        }
        tile.state = "horse"
        await tile.image.setSrc("/tile-horse.png")

        const nextAvailable = findAvailableTiles(tile);
        for (const _tile of nextAvailable) {
            _tile.state = "available";
            if (mode == "horse") {
                _tile.available.opacity = 100
            }
        }
        canvas.renderAll()
        console.log("setting horse to ", tile)
        sethorseTile(tile)
        return true
    }

    async function placeBlock(tile: Tile, canvas: Canvas) {
        if (tile.state == "blocked" || tile.state == "horse")
            return false
        await tile.image.setSrc("/tile-blocked.png")
        tile.state = "blocked"
        canvas.renderAll()
        return true
    }

    function toggleShowAvailability(canvas: Canvas) {
        if (mode != "horse")
            return
        for (const tile of [...tileMap.values()]) {
            if (tile.state != "available")
                continue
            tile.available.opacity = waiting ? 0 : 100
        }
        canvas.renderAll()
    }

    useEffect(() => {
        if (!fabricCanvasRef) return
        const canvas = fabricCanvasRef.current
        if (!canvas) return;

        toggleShowAvailability(canvas)

        for (const disposer of disposers) {
            disposer()
        }
        const _disposers: VoidFunction[] = []
        for (const tile of [...tileMap.values()]) {
            let disposer: VoidFunction = tile.available.on("mousedown", async () => {
                await handleClick(tile)
            })
            _disposers.push(disposer)

            disposer = tile.available.on("mouseover", async () => {
                await handleHover(tile, true, canvas)
            })
            _disposers.push(disposer)

            disposer = tile.available.on("mouseout", async () => {
                await handleHover(tile, false, canvas)
            })
            _disposers.push(disposer)
        }
        setDisposers(_disposers)
        unsubscribe(id + "/" + mode)
        subscribe(id + "/" + mode, onMessage)
    }, [horseTile, waiting]);

    async function handleHover(tile: Tile, focused: boolean, canvas: Canvas) {
        if (tile.state != "available") {
            return
        }
        if (mode == "horse" && !waiting) {
            if (focused) {
                tile.available.set({
                    scaleX: tile.available.scaleX * 1.1,
                    scaleY: tile.available.scaleY * 1.1
                });
                tile.image.set({
                    scaleX: tile.image.scaleX * 1.1,
                    scaleY: tile.image.scaleY * 1.1
                });
            } else {
                tile.available.set({
                    scaleX: tile.available.scaleX / 1.1,
                    scaleY: tile.available.scaleY / 1.1
                });
                tile.image.set({
                    scaleX: tile.image.scaleX / 1.1,
                    scaleY: tile.image.scaleY / 1.1
                });
            }

        }
        canvas.renderAll()
    }

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = new Canvas(canvasRef.current, {
            width: window.innerWidth,
            height: window.innerHeight,
        });
        fabricCanvasRef.current = canvas;

        const renderTile = (x: number, y: number) => {
            const imgElement = document.getElementById("tile") as HTMLImageElement;
            if (!imgElement) return;

            const scaleFactor = Math.min(
                TILE_WIDTH / imgElement.naturalWidth,
                TILE_HEIGHT / imgElement.naturalHeight
            );

            const fabricImage = new FabricImage(imgElement, {
                width: imgElement.naturalWidth,
                height: imgElement.naturalHeight,
                scaleX: scaleFactor,
                scaleY: scaleFactor,
                left: x,
                top: y,
                selectable: false,
                hasControls: false,
                hasBorders: false,
                lockMovementX: true,
                lockMovementY: true,
                lockScalingX: true,
                lockScalingY: true,
                lockRotation: true,
            });
            canvas.add(fabricImage);
            return fabricImage
        };

        async function generateGrid() {
            const queue: Tile[] = []
            const visited: Tile[] = []

            const emptyTile = renderTile(canvas.width / 2 - TILE_WIDTH / 2, canvas.height / 2 - TILE_HEIGHT / 2)
            const firstImage = renderTile(canvas.width / 2 - TILE_WIDTH / 2, canvas.height / 2 - TILE_HEIGHT / 2)
            const available = renderTile(canvas.width / 2 - TILE_WIDTH / 2, canvas.height / 2 - TILE_HEIGHT / 2)
            if (!emptyTile || !firstImage || !available)
                return
            await available.setSrc("/tile-available.png")
            available.opacity = 0
            await firstImage.setSrc("/tile-horse.png")
            const firstElem: Tile = {
                id: "s",
                state: "available",
                x: canvas.width / 2 - TILE_WIDTH / 2,
                y: canvas.height / 2 - TILE_HEIGHT / 2,
                neighbours: new Map<string, Tile>(),
                image: firstImage,
                available: available
            }
            tileMap.set("s", firstElem)
            tilePositions.set(`${firstElem.x} ${firstElem.y}`, "s")

            let tile: Tile | undefined = firstElem;


            while (tile != null) {
                if (visited.find(_ => _.x == tile?.x && _.y == tile?.y)) {
                    tile = queue.shift()
                    continue
                }
                visited.push(tile)
                for (let i = 0; i < directionList.length; i++) {
                    const direction = directionList[i]
                    if (!tile)
                        continue;
                    const newId = tile.id + direction;
                    if (newId.length > 8)
                        continue

                    const offsets = getNextTileOffset(direction)
                    const pos = `${tile.x + offsets[0]} ${tile.y + offsets[1]}`
                    const _id = tilePositions.get(pos)
                    if (_id) {
                        tile.neighbours.set(direction, tileMap.get(_id) as Tile)
                        tileMap.get(_id)?.neighbours.set(opposites[direction], tile)
                        continue;
                    }

                    const img = await emptyTile.clone();
                    img.set({
                        left: tile.x + offsets[0],
                        top: tile.y + offsets[1],
                        selectable: false,
                        hasControls: false,
                        hasBorders: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockRotation: true,
                    })

                    const avail = await available.clone();
                    avail.set({
                        left: tile.x + offsets[0],
                        top: tile.y + offsets[1],
                        selectable: false,
                        hasControls: false,
                        hasBorders: false,
                        lockMovementX: true,
                        lockMovementY: true,
                        lockScalingX: true,
                        lockScalingY: true,
                        lockRotation: true,
                        opacity: 0
                    })

                    canvas.add(img)
                    canvas.add(avail)
                    if (!img)
                        continue

                    const newTile: Tile = {
                        id: newId,
                        state: "empty",
                        x: tile.x + offsets[0],
                        y: tile.y + offsets[1],
                        neighbours: new Map<string, Tile>(),
                        image: img,
                        available: avail
                    }
                    newTile.neighbours.set(opposites[direction], tile)
                    tile.neighbours.set(direction, newTile)
                    tileMap.set(newId, newTile)
                    tilePositions.set(pos, newId)
                    queue.push(newTile)
                    if (blocks.includes(newId)) {
                        await newTile.image.setSrc("/tile-blocked.png")
                        newTile.state = "blocked"
                    }
                }
                tile = queue.shift()
            }
            canvas.renderAll()
            moveHorse(firstElem, canvas)
        }

        const imgElement = document.getElementById("tile") as HTMLImageElement;
        if (imgElement) {
            if (imgElement.complete && imgElement.naturalWidth !== 0) {
                generateGrid()
            } else {
                imgElement.addEventListener("load", () => {
                    generateGrid()
                }, {once: true});
            }
        }

        return () => {
            if (fabricCanvasRef.current) {
                fabricCanvasRef.current.dispose();
                fabricCanvasRef.current = null;
            }
        };
    }, []);

    if (winner == "horse") {
        return <div className={"container"}
                    style={{
                        backgroundSize: "cover",
                        backgroundImage: mode == "horse" ? "url('/horse-win.jpg')" : "url('/brick-lose.jpg')"
                    }}/>
    }
    if (winner == "blocker") {
        return <div className={"container"}
                    style={{
                        backgroundSize: "cover",
                        backgroundImage: mode == "blocker" ? "url('/brick-win.png')" : "url('/horse-lose.png')"
                    }}/>
    }

    return <>
        <img src={waiting ? "/turn-opponent.png" : "/turn-you.png"}
             style={{height: "50px", position: "absolute"}}
        />
        <canvas style={{width: "100vw", height: "100vh"}} id={"board"} ref={canvasRef}/>
        <div style={{display: "none"}}>
            <img src={"/tile.png"} id="tile"/>
        </div>
    </>
}
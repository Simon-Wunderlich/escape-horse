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

const powerSprites: { [key: string]: string } = {
    "portal": "/tile-portal.png",
    "invis": "/tile-invis.png",
    "knight": "/tile-knight.png",
    "bomb": "/tile-bomb.png"
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

export default function GameBoard({id, mode, blocks, powerups}: {
    id: string,
    mode: "horse" | "blocker",
    blocks: string[],
    powerups: { [key: string]: string }
}) {
    const [waiting, setWaiting] = useState(mode == "blocker")
    const [horseTile, sethorseTile] = useState<Tile | null>()
    const [tilePositions] = useState<Map<string, string>>(new Map)
    const [tileMap] = useState<Map<string, Tile>>(new Map)
    const [disposers, setDisposers] = useState<VoidFunction[]>([])
    const [winner, setWinner] = useState("")
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fabricCanvasRef = useRef<Canvas | null>(null);
    const [portals, setPortals] = useState<Tile[]>([])

    const [currentPower, setCurrentPower] = useState("")
    const [powerTurnsRemaining, setpowerTurnsRemaining] = useState(0)

    const context = useContext(MQTTContext)
    if (context === null)
        throw new Error('MQTTContext must be used within MQTTProvider');

    const {subscribe, sendMessage, unsubscribe} = context

    function findAvailableTiles(tile: Tile, knight: boolean = false) {
        const neighbours: Tile[] = [];
        console.log(currentPower)
        if (currentPower == "knight" || knight) {
            getKnightPositions(tile).map((neighbour) => {
                if (neighbour && neighbour.state != "blocked") {
                    neighbours.push(neighbour)
                }
            })
            return neighbours
        }
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
        if (message == "RESIGNED") {
            setWinner("blocker")
            return;
        }
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
        if (currentPower == "bomb") {
            if (tile.state == "blocked") {
                tile.state = "empty"
                await tile.image.setSrc("/tile.png")
            }
            for (const neighbour of [...tile.neighbours.values()]) {
                if (neighbour.state == "blocked") {
                    neighbour.state = "empty"
                    await neighbour.image.setSrc("/tile.png")
                }
            }
            setCurrentPower("")
            canvas.renderAll()
            return true
        }

        if (tile.state != "available")
            return false
        if (tile == horseTile)
            return false
        if (horseTile) {
            horseTile.state = "empty"
            await horseTile.image.setSrc("/tile.png")
        }

        let power = ""
        if (tile.powerup) {
            setCurrentPower(tile.powerup)
            power = tile.powerup
            if (tile.powerup == "invis") {
                setpowerTurnsRemaining(2)
            } else
                setpowerTurnsRemaining(0)

            if (tile.powerup == "portal") {
                tile.powerup = ""
                tile.state = "empty"
                await tile.image.setSrc("/tile.png")
                tile = portals.filter(_ => _ != tile)[0]
            }
            tile.powerup = ""
        } else if (powerTurnsRemaining > 0) {
            setpowerTurnsRemaining(prevState => prevState - 1)
        } else setCurrentPower("")

        tile.state = "horse"
        if (currentPower != "invis")
            await tile.image.setSrc("/tile-horse.png")
        if (power == "knight")
            await tile.image.setSrc("/tile-knight.png")

        canvas.renderAll()
        sethorseTile(tile)
        checkHorseWin(tile)
        resetAvailability(canvas)
        return true
    }

    function checkHorseWin(tile: Tile) {
        if ([...tile.neighbours.values()].length != 6) {
            console.log([...tile.neighbours.values()].length)
            setWinner("horse")
        }
    }

    function getKnightPositions(tile: Tile) {
        return [
            tile.neighbours.get(Directions.N)?.neighbours.get(Directions.NE),
            tile.neighbours.get(Directions.N)?.neighbours.get(Directions.NW),
            tile.neighbours.get(Directions.NE)?.neighbours.get(Directions.SE),
            tile.neighbours.get(Directions.SE)?.neighbours.get(Directions.S),
            tile.neighbours.get(Directions.S)?.neighbours.get(Directions.SW),
            tile.neighbours.get(Directions.SW)?.neighbours.get(Directions.NW),
        ]
    }

    function checkBlockerWin() {
        const queue: Tile[] = []
        const visited: Tile[] = []

        let tile = horseTile
        while (tile) {
            visited.push(tile)

            if ([...tile.neighbours.values()].length != 6) {
                return
            }

            if (tile.powerup == "bomb")
                return
            else if (tile.powerup == "knight") {
                const positions = getKnightPositions(tile).filter(_ => _ && !visited.includes(_))
                for (const pos of positions) {
                    if (!pos || visited.includes(pos) || pos.state == "blocked") {
                        continue
                    }
                    queue.push(pos)
                }
            } else if (tile.powerup == "portal") {
                console.log("portal at", tile)
                for (const portal of portals) {
                    if (!visited.includes(portal))
                        queue.push(portal)
                }
                for (const pos of [...tile.neighbours.values()]) {
                    if (!visited.includes(pos) && pos.state != "blocked")
                        queue.push(pos)
                }
            } else {
                for (const pos of [...tile.neighbours.values()]) {
                    if (!visited.includes(pos) && pos.state != "blocked")
                        queue.push(pos)
                }
            }
            tile = queue.shift()
        }
        setWinner("blocker")
    }

    async function placeBlock(tile: Tile, canvas: Canvas) {
        console.log(tile.state, tile.powerup)
        if ((tile.state != "empty" && tile.state != "available") || tile.powerup)
            return false
        await tile.image.setSrc("/tile-blocked.png")
        tile.state = "blocked"
        if (currentPower != "bomb")
            showAvailability(canvas)
        checkBlockerWin()
        canvas.renderAll()
        return true
    }

    function showAvailability(canvas: Canvas, tile: Tile | null = null) {
        if (!horseTile && !tile)
            return

        const nextAvailable = findAvailableTiles((horseTile || tile) as Tile);
        for (const _tile of nextAvailable) {
            _tile.state = "available";
            if (mode == "horse") {
                console.log("available")
                _tile.available.opacity = 100
            }
        }
        canvas.renderAll()
    }

    function resetAvailability(canvas: Canvas) {
        console.log("resetting")
        if (mode != "horse")
            return
        for (const tile of [...tileMap.values()]) {
            tile.available.opacity = 0
            if (tile.state != "blocked")
                tile.state = "empty"
        }
        canvas.renderAll()
    }

    useEffect(() => {
        if (!fabricCanvasRef) return
        const canvas = fabricCanvasRef.current
        if (!canvas) return;

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
    }, [horseTile, waiting, powerTurnsRemaining]);

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
                available: available,
                powerup: ""
            }
            tileMap.set("s", firstElem)
            tilePositions.set(`${firstElem.x} ${firstElem.y}`, "s")

            let tile: Tile | undefined = firstElem;

            const _portals = []

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
                        available: avail,
                        powerup: ""
                    }
                    newTile.neighbours.set(opposites[direction], tile)
                    tile.neighbours.set(direction, newTile)
                    tileMap.set(newId, newTile)
                    tilePositions.set(pos, newId)
                    queue.push(newTile)
                    if (blocks.includes(newId)) {
                        await newTile.image.setSrc("/tile-blocked.png")
                        newTile.state = "blocked"
                    } else if (powerups[newId]) {
                        newTile.powerup = powerups[newId]
                        await newTile.image.setSrc(powerSprites[newTile.powerup])
                        if (powerups[newId] == "portal") {
                            _portals.push(newTile)
                        }
                    }
                }
                tile = queue.shift()
            }
            canvas.renderAll()
            setPortals(_portals)
            await moveHorse(firstElem, canvas)
            showAvailability(canvas, firstElem)
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

    function resign() {
        setWinner("blocker")
        const topic = `${id}/${mode == "horse" ? "blocker" : "horse"}`

        sendMessage(topic, "RESIGNED")
    }


    return <>
        {winner == "horse"
            ? <div className={"container"}
                   style={{
                       backgroundSize: "cover",
                       backgroundImage: mode == "horse" ? "url('/horse-win.jpg')" : "url('/brick-lose.jpg')"
                   }}/>
            : winner == "blocker"
                ? <div className={"container"}
                       style={{
                           backgroundSize: "cover",
                           backgroundImage: mode == "blocker" ? "url('/brick-win.png')" : "url('/horse-lose.png')"
                       }}/>
                : <></>}
        <div style={{position: "absolute", margin: "15px"}}>
            <img src={waiting ? "/turn-opponent.png" : "/turn-you.png"}
                 style={{height: "50px"}}/>
            {currentPower
                ? <img
                    src={currentPower == "knight" ? "/knight-tip.png" : currentPower == "invis" ? "/invis-tip.png" : currentPower == "bomb" ? "/bomb-tip.png" : "/blank.png"}
                    style={{height: "50px", display: "block"}}/>
                : <></>}
            <button onClick={resign}
                    style={{display: mode == "horse" ? "block" : "none", zIndex: 1000, position: "relative"}}>Resign
            </button>
        </div>

        <canvas style={{width: "100vw", height: "100vh"}} id={"board"} ref={canvasRef}/>
        <div style={{display: "none"}}>
            <img src={"/tile.png"} id="tile"/>
        </div>
    </>
}
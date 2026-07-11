import {FabricImage} from "fabric"

export default interface Tile {
    id: string,
    state: "empty" | "blocked" | "horse" | "available",
    x: number,
    y: number,
    neighbours: Map<string, Tile>,
    image: FabricImage,
    available: FabricImage
}
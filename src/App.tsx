import CreateLobby from "./CreateLobby.tsx";
import {useState} from "react";
import Title from "./Title.tsx";
import GameBoard from "./GameBoard.tsx";
import Browse from "./Browse.tsx";

export type Page = "Title" | "Create" | "Browse" | "Game"

function App() {
    const [page, setPage] = useState<Page>("Title")
    const [id, setId] = useState<string>("")
    const [mode, setMode] = useState<"horse" | "blocker">("horse")
    const [blocks, setBlocks] = useState<string[]>([])

    switch (page) {
        case "Title":
            return <Title setPage={setPage}/>
        case "Create":
            return <CreateLobby setPage={setPage} setId={setId} setMode={setMode} setBlocks={setBlocks}/>
        case "Browse":
            return <Browse setPage={setPage} setRole={setMode} setId={setId} setBlocks={setBlocks}/>
        case "Game":
            return <GameBoard id={id} mode={mode} blocks={blocks}/>
    }
}

export default App

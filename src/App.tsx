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
    const [powerups, setPowerups] = useState<{ [key: string]: string }>({})

    switch (page) {
        case "Title":
            return <Title setPage={setPage}/>
        case "Create":
            return <CreateLobby setPage={setPage} setId={setId} setMode={setMode} setBlocks={setBlocks}
                                setPowerups={setPowerups}/>
        case "Browse":
            return <Browse setPage={setPage} setRole={setMode} setId={setId} setBlocks={setBlocks}
                           setPowerups={setPowerups}/>
        case "Game":
            return <GameBoard id={id} mode={mode} blocks={blocks} powerups={powerups}/>
    }
}

export default App

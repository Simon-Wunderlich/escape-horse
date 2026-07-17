import {type Dispatch, type SetStateAction, useContext, useEffect, useState} from "react";
import type {Page} from "./App.tsx";
import MQTTContext from "./MQTTContext.tsx";

interface Lobby {
    id: string,
    name: string,
    role: "horse" | "blocker",
    blocks: string[],
    powerups: { [key: string]: string }
}

const SERVER_URL = "https://escapeserver.sorry.horse/lobbies"

export default function Browse({setPage, setRole, setId, setBlocks, setPowerups}: {
    setPage: Dispatch<SetStateAction<Page>>,
    setRole: Dispatch<SetStateAction<"horse" | "blocker">>
    setId: Dispatch<SetStateAction<string>>
    setBlocks: Dispatch<SetStateAction<string[]>>
    setPowerups: Dispatch<SetStateAction<{ [key: string]: string }>>
}) {
    const [lobbies, setLobbies] = useState<Lobby[]>([])
    const [loading, setLoading] = useState(false)
    const context = useContext(MQTTContext)
    if (context === null)
        throw new Error('MQTTContext must be used within MQTTProvider');
    const {sendMessage} = context

    function fetchData() {
        fetch(SERVER_URL)
            .then(response => {
                return response.json()
            })
            .then(data => {
                setLobbies(data)
            })
    }

    useEffect(() => {
        fetchData()
    }, []);

    async function join(lobby: Lobby) {
        setLoading(true)
        await sendMessage(lobby.id, JSON.stringify({
            "message": "joined",
            "id": lobby.id
        }))
        setRole(lobby.role)
        setId(lobby.id)
        setBlocks(lobby.blocks)
        setPowerups(lobby.powerups)
        setPage("Game")
    }

    function joinGame(lobby: Lobby) {
        fetch(SERVER_URL + "/" + lobby.id, {method: "DELETE"})
            .then(async response => {
                if (!response.ok)
                    throw Error("Lmao")
                await join(lobby)
            })
            .catch(() => {
                fetchData()
            })
    }

    if (loading) {
        return <div className={"container"}>
            <h1>
                Loading...
            </h1>
        </div>
    }

    return (<>
        <div className={"container"}>
            <div className={"menu"}>
                <div className={"hStack"}>
                    <h1>Lobbies</h1>
                    <button onClick={fetchData}>⟳</button>
                </div>
                {lobbies.map(lobby => {
                    return <div
                        style={{display: "flex", width: "500px", justifyContent: "space-between", alignItems: "center"}}
                        key={lobby.id}>
                        <div>
                            <h4>{lobby.name} {lobby.role == "blocker" ? "🧱" : "🐎"}</h4>
                            <p>{lobby.id}</p>
                        </div>
                        <button style={{height: "fit-content"}}
                                onClick={() => joinGame(lobby)}>Join
                        </button>
                    </div>
                })}
            </div>
        </div>
    </>)
}
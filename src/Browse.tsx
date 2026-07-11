import {type Dispatch, type SetStateAction, useContext, useEffect, useState} from "react";
import type {Page} from "./App.tsx";
import MQTTContext from "./MQTTContext.tsx";

interface Lobby {
    id: string,
    name: string,
    role: "horse" | "blocker",
    blocks: string[]
}

const SERVER_URL = "http://127.0.0.1:5000/lobbies"

export default function Browse({setPage, setRole, setId, setBlocks}: {
    setPage: Dispatch<SetStateAction<Page>>,
    setRole: Dispatch<SetStateAction<"horse" | "blocker">>
    setId: Dispatch<SetStateAction<string>>
    setBlocks: Dispatch<SetStateAction<string[]>>
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

    async function join(id: string, role: "horse" | "blocker", blocks: string[]) {
        setLoading(true)
        await sendMessage(id, JSON.stringify({
            "message": "joined",
            "id": id
        }))
        setRole(role)
        setId(id)
        setBlocks(blocks)
        setPage("Game")
    }

    function joinGame(id: string, role: "horse" | "blocker", blocks: string[]) {
        fetch(SERVER_URL + "/" + id, {method: "DELETE"})
            .then(async response => {
                if (!response.ok)
                    throw Error("Lmao")
                await join(id, role, blocks)
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
                                onClick={() => joinGame(lobby.id, lobby.role, lobby.blocks)}>Join
                        </button>
                    </div>
                })}
            </div>
        </div>
    </>)
}
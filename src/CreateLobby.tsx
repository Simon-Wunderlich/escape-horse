import {type Dispatch, type SetStateAction, type SubmitEvent, useContext, useState} from "react";
import type {Page} from "./App.tsx";
import MQTTContext from "./MQTTContext.tsx";
import {tileList} from "./interfaces/TileList.tsx";

const SERVER_URL = "http://127.0.0.1:5000/lobbies"

function shuffle(array: string[]) {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}


export default function CreateLobby({setPage, setId, setMode, setBlocks}: {
    setPage: Dispatch<SetStateAction<Page>>,
    setId: Dispatch<SetStateAction<string>>,
    setBlocks: Dispatch<SetStateAction<string[]>>,
    setMode: Dispatch<SetStateAction<"horse" | "blocker">>,
}) {
    const [name, setName] = useState("")
    const [role, setRole] = useState<"horse" | "blocker">("blocker")
    const [waiting, setWaiting] = useState(false)
    const context = useContext(MQTTContext)
    if (context === null)
        throw new Error('MQTTContext must be used within MQTTProvider');
    const {subscribe, unsubscribe} = context

    function receiveMessage(payload: string) {
        const body = JSON.parse(payload)
        if (body["message"] == "joined") {
            unsubscribe(body["id"])
            setPage("Game")
        }
    }

    function generateBlocks() {
        const ids = shuffle(tileList.slice(18))
        return ids.slice(0, 40)
    }

    function createLobby(e: SubmitEvent) {
        e.preventDefault()

        if (name == "")
            return

        const id = crypto.randomUUID()
        const blocks = generateBlocks()
        setWaiting(true)
        subscribe(id, receiveMessage)
            .then(() => {
                fetch(SERVER_URL, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json"
                    },
                    body: JSON.stringify({
                        name: name,
                        id: id,
                        role: role == "blocker" ? "horse" : "blocker",
                        blocks: blocks
                    })
                })
                    .then(() => {
                        setId(id)
                        setBlocks(blocks)
                        setMode(role)
                    })
            })

    }

    if (waiting) {
        return (<>
            <div style={{
                width: "100vw",
                height: "100vh",
                display: "flex",
                justifyContent: "center",
                placeItems: "center",
                flexDirection: "column"
            }}>
                <h1>Waiting for opponent...</h1>
            </div>
        </>)
    }

    return (<>
        <div style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            placeItems: "center",
            flexDirection: "column"
        }}>
            <h1>New lobby</h1>
            <form onSubmit={createLobby}>
                <input name={"name"} placeholder={"Lobby name"} onChange={(e) => setName(e.target.value)}></input>
                <button>Create lobby</button>
                <fieldset>
                    <legend>Choose your role</legend>
                    <div>
                        <input type="radio" id="blocker" name={"1"} defaultChecked/>
                        <label htmlFor="blocker" onChange={() => setRole("blocker")}>Blocker</label>
                        <input type="radio" id="horse" name={"1"} onChange={() => setRole("horse")}/>
                        <label htmlFor="horse">Horse</label>
                    </div>
                    <div>
                    </div>
                </fieldset>
            </form>
        </div>
    </>)
}
import type {Dispatch, SetStateAction} from "react";
import type {Page} from "./App.tsx";

export default function Title({setPage}: { setPage: Dispatch<SetStateAction<Page>> }) {
    return (<>
        <div style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            placeItems: "center",
            flexDirection: "column"
        }}>
            <h1>Horse</h1>
            <button onClick={() => setPage("Browse")}>Join lobby</button>
            <button onClick={() => setPage("Create")}>Create lobby</button>
        </div>
    </>)
}
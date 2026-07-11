import type {Dispatch, SetStateAction} from "react";
import type {Page} from "./App.tsx";

export default function Title({setPage}: { setPage: Dispatch<SetStateAction<Page>> }) {
    return (<>
        <div className={"container"}>
            <div className={"menu"}>
                <h1>Horse</h1>
                <button onClick={() => setPage("Browse")}>Join lobby</button>
                <button onClick={() => setPage("Create")}>Create lobby
                </button>
            </div>
        </div>
    </>)
}
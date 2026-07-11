import {createContext} from "react";

export default createContext<{
    subscribe: (topic: string, callback: (payload: string) => void) => Promise<void>,
    sendMessage: (topic: string, body: string) => Promise<void>,
    unsubscribe: (topic: string) => void
} | null>(null)
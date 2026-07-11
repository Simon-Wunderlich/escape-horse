import {type ReactNode, useEffect, useRef, useState} from "react";
import Paho, {Client, Message} from "paho-mqtt"
import MQTTContext from "./MQTTContext";

const waitUntil = (conditionCheck: () => boolean, intervalTime = 100) => {
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (conditionCheck()) {
                clearInterval(interval);
                resolve(true);
            }
        }, intervalTime);
    });
};

export function MQTTProvider({children}: { children: ReactNode }) {
    const clientRef = useRef<Client | null>(null)
    const [topics, setTopics] = useState<Record<string, (payload: string) => void>>({})
    useEffect(() => {
        const client = new Paho.Client(
            "broker.hivemq.com",
            8884,
            crypto.randomUUID(),
        );

        client.onConnectionLost = (responseObject) => {
            console.log("Connection Lost: " + responseObject.errorMessage);
        };

        client.connect({
            useSSL: true,
            onSuccess: () => {
                console.log("Connected to MQTT Broker");
            },
            onFailure: (message) => {
                console.log("Connection Failed: " + message.errorMessage);
            },
        });

        clientRef.current = client;
        return () => {
            if (client && client.isConnected()) {
                client.disconnect();
            }
        };
    }, []);


    function onMessageArrived(message: Message) {
        const topic = message.destinationName
        topics[topic](message.payloadString)
    }

    useEffect(() => {
        if (!clientRef.current)
            return
        clientRef.current.onMessageArrived = onMessageArrived
    }, [topics]);


    async function sendMessage(topic: string, body: string) {
        await waitUntil(() => (clientRef.current && clientRef.current.isConnected()) || false)
        console.log("sending message")
        if (clientRef.current && clientRef.current.isConnected()) {
            const message = new Paho.Message(body);
            message.destinationName = "686F727365/" + topic;
            clientRef.current.send(message);
        }
    }


    async function subscribe(topic: string, callback: (payload: string) => void) {
        await waitUntil(() => (clientRef.current && clientRef.current.isConnected()) || false)
        clientRef.current?.subscribe("686F727365/" + topic)
        setTopics(prevState => ({
            ...prevState,
            ["686F727365/" + topic]: callback
        }))
    }

    function unsubscribe(topic: string) {
        try {
            clientRef.current?.unsubscribe("686F727365/" + topic)
        } catch {
            console.log("Already unsubscribed")
        }
    }

    return (
        <MQTTContext.Provider value={{
            subscribe,
            sendMessage,
            unsubscribe
        }}>
            {children}
        </MQTTContext.Provider>
    );
}
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import App from './App.tsx'
import {MQTTProvider} from "./MQTT.tsx";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <MQTTProvider>
            <App/>
        </MQTTProvider>
    </StrictMode>,
)

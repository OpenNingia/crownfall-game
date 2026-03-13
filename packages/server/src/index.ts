import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import { CrownfallRoom } from "./rooms/CrownfallRoom.js";

const port = Number(process.env.PORT ?? 2567);

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(cors());
  },
});

gameServer.define("crownfall", CrownfallRoom);

gameServer.listen(port).then(() => {
  console.log(`Crownfall server listening on ws://localhost:${port}`);
});

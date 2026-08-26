import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { CrownfallRoom } from "./rooms/CrownfallRoom.js";

const port = Number(process.env.PORT ?? 2567);
const clientDist = process.env.CLIENT_DIST_PATH;

const gameServer = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.use(cors());
    if (clientDist) {
      app.use(express.static(clientDist));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientDist, "index.html"));
      });
    }
  },
});

gameServer.define("crownfall", CrownfallRoom);

gameServer.listen(port).then(() => {
  console.log(`Crownfall server listening on ws://localhost:${port}`);
});

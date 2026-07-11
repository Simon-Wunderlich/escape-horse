import json

from flask import Flask, request, make_response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


@app.route("/lobbies", methods=["POST"])
def createLobby():
    body = request.json
    with open("lobbies.json", "r") as f:
        lobbies = json.load(f)

    if len([l for l in lobbies if l.get("id") == body.get("id")]) > 0:
        return "Already exists"

    lobbies.append(body)

    with (open("lobbies.json", "w") as f):
        json.dump(lobbies, f, indent=4)

    return "Success"


@app.route("/lobbies", methods=["GET"])
def getLobbies():
    with (open("lobbies.json", "r") as f):
        return json.load(f)


@app.route("/lobbies/<id>", methods=["DELETE"])
def deleteLobby(id):
    with open("lobbies.json", "r") as f:
        lobbies = json.load(f)
    if len([l for l in lobbies if l.get("id") == id]) == 0:
        return make_response("success", 404)

    lobbies = [l for l in lobbies if l.get("id") != id]
    with (open("lobbies.json", "w") as f):
        json.dump(lobbies, f, indent=4)
    return make_response("success", 200)


app.run()

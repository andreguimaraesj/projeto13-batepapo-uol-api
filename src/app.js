import express from "express";
import cors from 'cors';
import { MongoClient } from "mongodb";
import joi from 'joi'
import dotenv from 'dotenv';
import DayJS from 'dayjs';
import 'dayjs/locale/pt-br.js';



const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();


const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))



 app.post('/participants', (req,res) =>{
    const {name} = req.body;

    const validation = joi.string().required().validate(name, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }


    db.collection("participants").findOne({ name: name })
    .then(participant => {
        if (participant) {
            return res.status(409).send("Nome já em uso.");
        }

        db.collection("participants").insertOne({
            name: name,
            lastStatus: Date.now()
        })
            .then(() => res.sendStatus(201))
            .catch(err => res.status(500).send(err.message))
    })
    .catch(err => res.status(500).send(err.message))

});

app.get('/participants', (req,res)=>{
    const users = db.collection("participants").find().toArray()
    .then(users => res.send(users))
    .catch(err => res.status(500).send(err.message))
});

//MESSAGES ROUTES

app.post('/messages', (req,res)=>{
    const {to, text, type} = req.body;
    const from = req.headers.user;

    const schema = joi.object({
        to: joi.string().required().min(1),
        text: joi.string().required().min(1),
        type: joi.string().valid('message', 'private_message').required(),
        from: joi.string().required()
    });

    const message = {
        to,
        text,
        type,
        from
    }

    const validation = schema.validate(message, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    db.collection("participants").findOne({ name: from })
    .then(participant => {
        if (!participant) {
            return res.status(422).send("Participante não existente.");
        }

        db.collection("messages").insertOne({message, time: DayJS().locale('pt-br').format('HH:mm:ss')})
            .then(() => res.sendStatus(201))
            .catch(err => res.status(500).send(err.message))
    })
    .catch(err => res.status(500).send(err.message))

});

app.get('/messages', (req, res) => {
    const messagesLimit = parseInt(req.query.limit);
    const {user} = req.headers;

    let messagesQuery;

    let queryParams = {
        $or: [
            { to: user },
            { from: user },
            { to: 'Todos' }
        ],
    };

    if (messagesLimit) {
        if (isNaN(messagesLimit) || messagesLimit <= 0) {
            return res.status(422).send('Limite de mensagens inválido.');
        }
        messagesQuery = db.collection('messages').find(queryParams).limit(messagesLimit);
    } else {
        messagesQuery = db.collection('messages').find(queryParams);
    }

    if (messagesQuery) {
        messagesQuery.toArray()
            .then((messages) => {
                res.status(200).send(messages);
            })
            .catch((error) => {
                res.status(500).send(error.message);
            });
    } else {
        res.status(500).send('Ocorreu um erro ao obter as mensagens.');
    }
});


app.listen(5000);
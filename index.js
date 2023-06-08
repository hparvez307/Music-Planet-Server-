const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');






// express middleware
app.use(cors());
app.use(express.json());







const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mb5zcck.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();

        const usersCollection = client.db('musicPlanetDB').collection('user');

        app.get('/', (req, res) => {
            res.send('music planet server is running.')
        })

        // json web  token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = await jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token });
        })


        // users

        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: req?.body?.email };
            const isExist = await usersCollection.findOne(query);
            if (isExist) {
                return res.send({ message: 'user already exist in database' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log(`music planet server is running on port: ${port}`);
})
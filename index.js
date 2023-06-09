const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const Stripe = require('stripe');
const stripe = Stripe(process.env.PAYMENT_SECRET_KEY);




// express middleware
app.use(cors());
app.use(express.json());




// jwt verify
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
    }

    // token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.TOKEN_SECRET, (er, decoded) => {
        if (er) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}





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
        const classesCollection = client.db('musicPlanetDB').collection('classes');
        const selectedClassesCollection = client.db('musicPlanetDB').collection('selectedClasses');
        const enrolledClassesCollection = client.db('musicPlanetDB').collection('enrolledClasses');
        const paymentsCollection = client.db('musicPlanetDB').collection('payments');




        app.get('/', (req, res) => {
            res.send('music planet server is running.')
        })



        //    verify admin & instructor
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const filter = { email: email };
            const user = await usersCollection.findOne(filter);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const filter = { email: email };
            const user = await usersCollection.findOne(filter);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }

        const verifyStudent = async (req, res, next) => {
            const email = req.decoded.email;
            const filter = { email: email };
            const user = await usersCollection.findOne(filter);
            if (user?.role !== 'student') {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }
            next();
        }





        // json web  token
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = await jwt.sign(user, process.env.TOKEN_SECRET, { expiresIn: '24h' });
            res.send({ token });
        })


        // users

        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })


        app.get('/checkUser', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
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



        // make admin and instructor
        app.patch('/makeAdmin/:id', verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateRole = {
                $set: { role: 'admin' }
            }
            const result = await usersCollection.updateOne(query, updateRole);
            res.send(result)

        })

        app.patch('/makeInstructor/:id', verifyJWT, verifyAdmin, async (req, res) => {

            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const updateRole = {
                $set: { role: 'instructor' }
            }
            const result = await usersCollection.updateOne(query, updateRole);
            res.send(result)

        })



        // public class api

        app.get('/allClass', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })



        // manage classes api for admin
        app.get('/classes', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })




        // approve classes
        app.patch('/approveClasses/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateStatus = {
                $set: { status: 'approved' }
            }
            const result = await classesCollection.updateOne(filter, updateStatus);
            res.send(result);
        })

        // deny classes
        app.patch('/denyClasses/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateStatus = {
                $set: { status: 'denied' }
            }
            const result = await classesCollection.updateOne(filter, updateStatus);
            res.send(result);
        })

        // update class feedback by admin
        app.patch('/feedback/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const feedback = req.body?.feedback;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateFeedback = {
                $set: { feedback: feedback }
            }
            const result = await classesCollection.updateOne(filter, updateFeedback, options);
            res.send(result);
        })



        // Popular classes
        app.get('/popularClasses', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })



        // api for instructors dashboard

        // add a class api
        app.post('/addClasses', verifyJWT, verifyInstructor, async (req, res) => {
            const classInfo = req.body;
            const result = await classesCollection.insertOne(classInfo);
            res.send(result);
        })

        // get classes for specific instructors
        app.get('/instructorsClasses', verifyJWT, verifyInstructor, async (req, res) => {

            const email = req.decoded.email;
            const filter = { instructorEmail: email };
            const result = await classesCollection.find(filter).toArray();
            res.send(result);

        })

        // specific class for update class
        app.get('/singleClass/:id', verifyJWT, verifyInstructor, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await classesCollection.findOne(query);
            res.send(result);

        })


        // update a class

        app.patch('/updateClass/:id', verifyJWT, verifyInstructor, async (req, res) => {
            const id = req.params.id;
            const classInfo = req.body;
            const filter = { _id: new ObjectId(id) }
            const options = { upsert: true };
            const updateFeedback = {
                $set: {
                    availableSeats: classInfo.availableSeats,
                    className: classInfo.className,
                    image: classInfo.image,
                    price: classInfo.price
                }
            }
            const result = await classesCollection.updateOne(filter, updateFeedback, options);
            res.send(result);
        })



        // student apis

        // post selected classes
        app.get('/bookClass', verifyJWT, verifyStudent, async (req, res) => {
            const email = req.decoded.email;
            const filter = { studentEmail: email };
            const result = await selectedClassesCollection.find(filter).toArray();
            res.send(result);
        })

        app.post('/bookClass', verifyJWT, verifyStudent, async (req, res) => {
            const bookedClass = req.body;
            const result = await selectedClassesCollection.insertOne(bookedClass);
            res.send(result);
        })

        app.delete('/deleteBookClass/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassesCollection.deleteOne(query);
            res.send(result);
        })











        // payment
        app.post('/create-payment-intent', verifyJWT, verifyStudent, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })



        app.post('/classPayments', async (req, res) => {
            const payment = req.body;

            const bookingId = payment?.classId;
            const query = { _id: new ObjectId(bookingId) };
            const deleteBooking = await selectedClassesCollection.deleteOne(query);

            const previousClsId = payment?.previousClassId;
            const previousClassQuery = { _id: new ObjectId(previousClsId) };
            const previousClass = await classesCollection.findOne(previousClassQuery);
            const previousSeat = previousClass?.availableSeats;
            if (parseFloat(previousSeat) > 0) {
                const newSeat = parseFloat(previousSeat) - 1;
                const updateDoc = {
                    $set: { availableSeats: newSeat }
                }
                const updateClassSeat = await classesCollection.updateOne(previousClassQuery, updateDoc)
            }


            const result = await paymentsCollection.insertOne(payment);
            res.send(result)
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
const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_ADMIN}:${process.env.DB_PASS}@cluster0.6nrjc.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).send({ message: 'unAuthorized access' })
  }
  const token = authHeader.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded
    next()
    // console.log(decoded.foo) // bar
  });
}

async function run() {
  try {
    await client.connect()
    const serviceCollection = client.db('doctors_portel').collection('services')
    const bookingCollection = client.db('doctors_portel').collection('booking')
    const userCollection = client.db('doctors_portel').collection('users')

    app.get('/service', async (req, res) => {
      const query = {}
      const cursor = serviceCollection.find(query).project({name:1})
      const services = await cursor.toArray()
      res.send(services)
    })

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray()
      res.send(users)
    })
    // admin verefide
    app.get('/admin/:email',async(req,res)=>{
      const email = req.params.email
      const user = await userCollection.findOne({email:email})
      const isAdmin = user.role === 'admin'
      res.send({admin: isAdmin})
    })

    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email
      const requester = req.decoded.email
      const requesterAccount = await userCollection.findOne({ email: requester })
      if (requesterAccount.role === 'admin') {
        const filter = { email: email }
        const updateDoc = {
          $set: { role: 'admin' },
        }
        const result = await userCollection.updateOne(filter, updateDoc)
        res.send(result)
      }
      else{
        res.status(403).send({message: 'forbidden'})
      }

    })
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const filter = { email: email }
      const options = { upsert: true }
      const updateDoc = {
        $set: user,
      }
      const result = await userCollection.updateOne(filter, updateDoc, options)
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ result, token })
    })

    app.get('/available', async (req, res) => {
      const date = req.query.date;


      const services = await serviceCollection.find().toArray()
      const query = { date: date }
      const bookings = await bookingCollection.find(query).toArray()


      services.forEach(service => {

        const serviceBookings = bookings.filter(book => book.treatment === service.name)
        const bookedSlots = serviceBookings.map(book => book.slot)
        const available = service.slots.filter(slot => !bookedSlots.includes(slot))
        service.slots = available

      })

      //find booking for that servic

      res.send(services)
    })

    /**
     * api namming conventrion
     * api(/booking)//get all booking in  this collection. or get more then one  or by filter
     *   
     * 
    */


    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient
      const decodedEmail = req.decoded.email

      if (patient === decodedEmail) {
        const query = { patient: patient }
        const bookings = await bookingCollection.find(query).toArray()
        return res.send(bookings)
      }
      else {
        return res.status(403).send({ message: "Fornidden access" })
      }
    })

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
      const exists = await bookingCollection.findOne(query)

      if (exists) {
        return res.send({ success: false, booking: exists })
      }

      const result = await bookingCollection.insertOne(booking)
      return res.send({ success: true, result })
    })

  }
  finally {

  }
} run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello')
})

app.listen(port, () => {
  console.log(`doctor app is connected on port ${port}`)
})
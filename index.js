const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
    
  });
}

async function run() {
  try {
    await client.connect()
    const serviceCollection = client.db('doctors_portel').collection('services')
    const bookingCollection = client.db('doctors_portel').collection('booking')
    const userCollection = client.db('doctors_portel').collection('users')
    const doctorCollection = client.db('doctors_portel').collection('doctors')

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else {
        res.status(403).send({ message: 'forbidden' });
      }
    }
    //payment intregretion
    app.post('/create-payment-intent', verifyJWT, async(req,res)=>{
      const service = req.body
      const price = service.price
      const amount= price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      req.send({clientSecret: paymentIntent.client_secret})

    })
// services api
    app.get('/service', async (req, res) => {
      const query = {}
      const cursor = serviceCollection.find(query).project({name:1})
      const services = await cursor.toArray()
      res.send(services)
    })
// user api
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray()
      res.send(users)
    })
    // admin verefide
    app.get('/admin/:email',async(req,res)=>{
      console.log('data');
      const email = req.params.email
      const user = await userCollection.findOne({email:email})
      const isAdmin = user.role === 'admin'
      res.send({admin: isAdmin})
    })
//user admin role
    app.put('/user/admin/:email', verifyJWT,verifyAdmin, async (req, res) => {
      const email = req.params.email
      const requester = req.decoded.email
      const requesterAccount = await userCollection.findOne({ email: requester })
   
        const updateDoc = {
          $set: { role: 'admin' },
        }
     

    })
    //user data save database
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
//avalabole apponment
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
     * api(/booking)//get all booking in  this collection. 
     * or get more then one  or by filter
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

    app.get('/booking/:id', verifyJWT,  async(req,res)=>{
      const id = req.params.id
      const query = {_id: ObjectId(id)}
      const booking = await bookingCollection.findOne(query)
      res.send(booking)
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

    app.get('/doctor',verifyJWT,verifyAdmin,async(req,res)=>{
      const doctors = await doctorCollection.find().toArray()
      res.send(doctors)
    })

    app.post('/doctor', verifyJWT, verifyAdmin, async(req,res)=>{
      const doctor = req.body
      const result = await doctorCollection.insertOne(doctor)
      res.send(result)
    })
    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async(req,res)=>{
      const doctor = req.params.email
      const filter = {email:doctor}

      const result = await doctorCollection.deleteOne(filter)
      res.send(result)
    })

  }
  finally {
    // console.log(error);
  }
} run().catch(console.dir)


app.get('/', (req, res) => {
  res.send('Hello Doctor')
})

app.listen(port, () => {
  console.log(`doctor app is connected on port ${port}`)
})


// pass=T!!3~Xxt;ywpdgC
